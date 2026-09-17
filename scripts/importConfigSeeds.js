/**
 * Importe les seeds de configuration (générés par buildConfigSeeds.js) en base.
 *
 * Upsert IDEMPOTENT par CLÉ NATURELLE : les documents existants sont matchés par
 * leur clé métier et enrichis (leur _id est préservé) ; l'_id généré ne s'applique
 * qu'à l'insertion.
 *
 * Références vers des collections pouvant PRÉ-EXISTER (donc avec un _id différent
 * de celui du seed) résolues à l'import :
 *   - section.chantier   -> location, par label
 *   - productMeasureUnit.product -> product, par clé normalisée (productKey)
 * Les produits eux-mêmes sont rapprochés par clé normalisée pour éviter les
 * doublons ("SABLE_MARIN" == "SABLE MARIN").
 *
 * Usage :
 *   node scripts/importConfigSeeds.js            # toutes les collections, dans l'ordre
 *   node scripts/importConfigSeeds.js products drivers
 *   DRY_RUN=1 node scripts/importConfigSeeds.js  # n'écrit rien, affiche le plan
 */

require("dotenv").config();

const fs = require("fs");
const path = require("path");
const mongoose = require("mongoose");
const { fromExtendedJson } = require("./importReferenceJson");

const IMPORT_DIR = path.resolve(__dirname, "../imports/reference");
const DRY_RUN = process.env.DRY_RUN === "1";

// Clé de rapprochement produit (identique à buildConfigSeeds.js).
const productKey = (s) =>
  String(s).trim().toUpperCase().normalize("NFD").replace(/\p{M}/gu, "").replace(/_+/g, " ").replace(/\s+/g, " ").trim();

// Rempli lors de l'import des produits, consommé par les PMU.
let productIdByKey = new Map();

// Ordre = dépendances des références (parents avant enfants).
const COLLECTIONS = [
  { name: "vehicleBrands", file: "config.vehicleBrands.json", collection: "vehiclebrands", key: ["label"] },
  { name: "vehicleTypes", file: "config.vehicleTypes.json", collection: "vehicletypes", key: ["label"] },
  { name: "vehicleSources", file: "config.vehicleSources.json", collection: "vehiclesources", key: ["label"] },
  { name: "vehicleModels", file: "config.vehicleModels.json", collection: "vehiclemodels", key: ["label"] },
  { name: "transportTypes", file: "config.transportTypes.json", collection: "transporttypes", key: ["label"] },
  { name: "products", file: "config.products.json", collection: "products", importer: importProducts },
  { name: "productMeasureUnits", file: "config.productMeasureUnits.json", collection: "productmeasureunits", key: ["product", "measureUnit"], resolveProduct: true },
  { name: "locations", file: "config.locations.json", collection: "locations", key: ["label"] },
  { name: "sections", file: "config.sections.json", collection: "sections", key: ["label", "chantier"], resolveChantier: true },
  { name: "drivers", file: "config.drivers.json", collection: "drivers", key: ["nameKey"] },
  { name: "vehicles", file: "config.vehicles.json", collection: "vehicles", key: ["plateNormalized"] },
  { name: "pricing", file: "config.pricing.json", collection: "pricings", key: ["description"] },
];

function readDocs(file) {
  const full = path.join(IMPORT_DIR, file);
  if (!fs.existsSync(full)) return [];
  return fromExtendedJson(JSON.parse(fs.readFileSync(full, "utf8")));
}

function buildOps(docs, key) {
  return docs.map((doc) => {
    const { _id, createdAt, ...rest } = doc;
    const filter = Object.fromEntries(key.map((field) => [field, doc[field]]));
    return {
      updateOne: {
        filter,
        update: { $set: rest, $setOnInsert: { _id, ...(createdAt ? { createdAt } : {}) } },
        upsert: true,
      },
    };
  });
}

// Produits : rapproche par clé normalisée pour réutiliser un produit existant
// (peu importe l'orthographe exacte) et éviter les doublons.
async function importProducts(config) {
  const docs = readDocs(config.file);
  const col = mongoose.connection.db.collection(config.collection);
  const existing = await col.find({}, { projection: { name: 1 } }).toArray();

  productIdByKey = new Map();
  for (const row of existing) productIdByKey.set(productKey(row.name), row._id);

  const toInsert = [];
  const updates = [];
  for (const doc of docs) {
    const { _id, createdAt, ...rest } = doc;
    const k = productKey(doc.name);
    const found = productIdByKey.get(k);
    if (found) {
      // Produit déjà présent : on conserve son _id, on met à jour le type/description.
      updates.push({ updateOne: { filter: { _id: found }, update: { $set: rest } } });
    } else {
      toInsert.push(doc);
      productIdByKey.set(k, _id);
    }
  }

  const ops = [...updates, ...buildOps(toInsert, ["name"])];
  const result = ops.length ? await col.bulkWrite(ops, { ordered: false }) : { upsertedCount: 0, modifiedCount: 0 };
  return { collection: config.name, documents: docs.length, inserted: result.upsertedCount, updated: result.modifiedCount };
}

async function resolveChantiers(docs) {
  const rows = await mongoose.connection.db.collection("locations").find({}, { projection: { label: 1 } }).toArray();
  const byLabel = new Map(rows.map((row) => [String(row.label).trim().toUpperCase(), row._id]));
  const unresolved = [];
  const resolved = docs.map((doc) => {
    const { chantierLabel, ...rest } = doc;
    const target = byLabel.get(String(chantierLabel || "").trim().toUpperCase());
    if (target) rest.chantier = target;
    else unresolved.push(doc.label);
    return rest;
  });
  if (unresolved.length) console.warn(`Sections sans chantier résolu : ${unresolved.join(", ")}`);
  return resolved;
}

// PMU : re-résout product vers l'_id réel via la clé normalisée.
async function resolveProducts(docs) {
  if (productIdByKey.size === 0) {
    const rows = await mongoose.connection.db.collection("products").find({}, { projection: { name: 1 } }).toArray();
    for (const row of rows) productIdByKey.set(productKey(row.name), row._id);
  }
  const unresolved = [];
  const resolved = [];
  for (const doc of docs) {
    const { productKey: pk, ...rest } = doc;
    const target = productIdByKey.get(pk);
    if (target) {
      rest.product = target;
      resolved.push(rest);
    } else {
      unresolved.push(pk);
    }
  }
  if (unresolved.length) console.warn(`PMU sans produit résolu (ignorés) : ${unresolved.join(", ")}`);
  return resolved;
}

async function importCollection(config) {
  const docsPreview = readDocs(config.file);
  if (DRY_RUN) return { collection: config.name, documents: docsPreview.length, dryRun: true };
  if (config.importer) return config.importer(config);

  let docs = docsPreview;
  if (config.resolveChantier) docs = await resolveChantiers(docs);
  if (config.resolveProduct) docs = await resolveProducts(docs);
  if (docs.length === 0) return { collection: config.name, documents: 0, inserted: 0, updated: 0 };

  const ops = buildOps(docs, config.key);
  const result = await mongoose.connection.db.collection(config.collection).bulkWrite(ops, { ordered: false });
  return { collection: config.name, documents: docs.length, inserted: result.upsertedCount, updated: result.modifiedCount };
}

async function main() {
  const requested = process.argv.slice(2);
  const selected = requested.length > 0 ? COLLECTIONS.filter((c) => requested.includes(c.name)) : COLLECTIONS;
  if (selected.length === 0) throw new Error(`Aucune collection connue parmi : ${requested.join(", ")}`);

  if (!DRY_RUN) {
    if (!process.env.DB_URL) throw new Error("DB_URL est obligatoire.");
    await mongoose.connect(process.env.DB_URL);
  }
  const results = [];
  for (const config of selected) results.push(await importCollection(config));
  console.log(JSON.stringify(results, null, 2));
}

if (require.main === module) {
  main()
    .catch((error) => {
      console.error(error.message);
      process.exitCode = 1;
    })
    .finally(() => mongoose.disconnect());
}

module.exports = { COLLECTIONS, buildOps, productKey };
