/**
 * Importe les seeds de configuration (générés par buildConfigSeeds.js) en base.
 *
 * Upsert IDEMPOTENT par CLÉ NATURELLE : les documents existants sont matchés par
 * leur clé métier et enrichis (leur _id est préservé) ; l'_id généré ne s'applique
 * qu'à l'insertion. Les sections voient leur `chantier` re-résolu par label après
 * import des locations, pour pointer vers l'_id réel de la location en base.
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

// Ordre = dépendances des références (parents avant enfants).
const COLLECTIONS = [
  { name: "vehicleBrands", file: "config.vehicleBrands.json", collection: "vehiclebrands", key: ["label"] },
  { name: "vehicleTypes", file: "config.vehicleTypes.json", collection: "vehicletypes", key: ["label"] },
  { name: "vehicleSources", file: "config.vehicleSources.json", collection: "vehiclesources", key: ["label"] },
  { name: "vehicleModels", file: "config.vehicleModels.json", collection: "vehiclemodels", key: ["label"] },
  { name: "transportTypes", file: "config.transportTypes.json", collection: "transporttypes", key: ["label"] },
  { name: "products", file: "config.products.json", collection: "products", key: ["name"] },
  { name: "productMeasureUnits", file: "config.productMeasureUnits.json", collection: "productmeasureunits", key: ["product", "measureUnit"] },
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
        update: {
          $set: rest,
          $setOnInsert: { _id, ...(createdAt ? { createdAt } : {}) },
        },
        upsert: true,
      },
    };
  });
}

async function resolveChantiers(docs) {
  // Remappe section.chantier vers l'_id réel de la location, par label.
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

async function importCollection(config) {
  let docs = readDocs(config.file);
  if (DRY_RUN) return { collection: config.name, documents: docs.length, dryRun: true };
  if (config.resolveChantier) docs = await resolveChantiers(docs);
  if (docs.length === 0) return { collection: config.name, documents: 0, inserted: 0, updated: 0 };

  const ops = buildOps(docs, config.key);
  const result = await mongoose.connection.db.collection(config.collection).bulkWrite(ops, { ordered: false });
  return {
    collection: config.name,
    documents: docs.length,
    inserted: result.upsertedCount,
    updated: result.modifiedCount,
  };
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

module.exports = { COLLECTIONS, buildOps };
