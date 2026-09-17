/**
 * Génère les fichiers seed de configuration prod à partir des 3 Excel de paramètres.
 *
 * Entrée  : les .xlsx de paramètres (voir INPUT_FILES).
 * Sortie  : imports/reference/*.json (JSON étendu {$oid,$date}) importables via
 *           scripts/importReferenceJson.js (upsert par clé naturelle).
 *
 * Règles :
 *  - Union des 3 fichiers, fichiers 2 & 3 prioritaires sur les conflits.
 *  - Vrais ObjectId générés ; idempotence assurée côté import par clé naturelle.
 *  - Réutilise les ObjectId existants pour ProductType et MeasureUnit.
 *
 * Usage : node scripts/buildConfigSeeds.js
 */

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const ExcelJS = require("exceljs");
const { normalizeDriverKey, normalizePlate } = require("../helpers/referenceNormalization");

const INPUT_DIR = process.env.CONFIG_INPUT_DIR || "/Users/futurix/Downloads";
const OUTPUT_DIR = path.resolve(__dirname, "../imports/reference");
const HEADER_ROW = 2;
const DATA_START = 3;
const NOW = new Date().toISOString();

const INPUT_FILES = [
  {
    tag: "F1",
    name: "Paramètre de configuration (5).xlsx",
    priority: 1,
    cols: { produit: 2, concasse: 4, chantier: 6, conducteur: 8, camion: 10, camionModele: 11, modeleList: 13 },
  },
  {
    tag: "F2",
    name: "PARAMETRE CAMIONS STRACA RDP-DOGBO-LALO-EIFFAGE PAC-KARTING ADOUNKO.xlsx",
    priority: 2,
    cols: { produit: 2, expedition: 4, chantier: 6, source: 8, typeProduit: 10, unite: 11, modeleList: 13, conducteur: 16, camion: 18, provenance: 19, camionModele: 20, marque: 21 },
  },
  {
    tag: "F3",
    name: "PARAMETRES TRAVAUX ADJAHA-ATHIEME ET AEP-LOKOSSA-ATHIEME.xlsx",
    priority: 2,
    cols: { produit: 2, expedition: 4, chantier: 6, source: 8, typeProduit: 10, unite: 11, modeleList: 13, conducteur: 14, camion: 15, provenance: 16, camionModele: 17, marque: 18 },
  },
];

// Référentiels déjà présents en base (ne pas recréer).
const REF = {
  productType: { standard: "678624dbb4352dbb8c35061b", concasse: "679cabe3d2726f19758160ce" },
  measureUnit: { tonnes: "67890afd1242e9fe7c4d8c73", m3: "67890ad91242e9fe7c4d8c5b" },
};

const SOURCE_IS_EXTERNAL = {
  "STRACA BENIN": false,
  "STRACA TOGO": false,
  "STRACA BURKINA": false,
  "CAMION PRIVE": true,
  "SATOM BENIN": true,
};
const DEFAULT_SOURCE = "STRACA BENIN";
const UNKNOWN = "INCONNU";

// Vocabulaire de bruit à exclure des colonnes produits / lieux.
const NOISE = new Set([
  ...Object.keys(SOURCE_IS_EXTERNAL),
  "M3", "METRES CUBES", "METRE CUBE", "TONNES", "TONNE", "UNITE",
  "TDL 10 ROUES", "TDL 12 ROUES", "TAXE MINIERE",
  "10 ROUES", "12 ROUES", "SEMI 3E", "SEMI 4E", "SEMI 5E", "SEMI 6E", "SEMI 7E",
  "PLATEAU", "PLATEAUX", "MODELE", "PRODUIT", "CHANTIER", "EXPEDITION",
]);

const CONFIG_LABELS = new Set([
  "10 ROUES", "12 ROUES", "SEMI 3E", "SEMI 4E", "SEMI 5E", "SEMI 6E", "SEMI 7E", "PLATEAU",
]);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const conflicts = [];
const notes = [];
const oid = (v) => ({ $oid: v });
const stamp = () => ({ createdAt: { $date: NOW }, updatedAt: { $date: NOW } });
// ObjectId déterministe (24 hex) dérivé de la clé naturelle : stable entre builds.
const detId = (ns, key) => crypto.createHash("md5").update(`${ns}::${key}`).digest("hex").slice(0, 24);
const clean = (s) => String(s).replace(/\s+/g, " ").trim();
const upper = (s) => clean(s).toUpperCase();
const isNumeric = (s) => /^\d+([.,]\d+)?$/.test(clean(s));

function normConfig(s) {
  const x = upper(s);
  return x === "PLATEAUX" ? "PLATEAU" : x;
}

// Clé de rapprochement produit : ignore accents, underscores et slashs d'espacement.
function productKey(s) {
  return upper(s).normalize("NFD").replace(/\p{M}/gu, "").replace(/[_]+/g, " ").replace(/\s+/g, " ").trim();
}

function cellText(ws, r, c) {
  const v = ws.getCell(r, c).value;
  if (v == null) return "";
  if (typeof v === "object") {
    if (v.result != null) return clean(v.result);
    if (Array.isArray(v.richText)) return clean(v.richText.map((t) => t.text).join(""));
    if (v.text != null) return clean(v.text);
    return "";
  }
  return clean(v);
}

function columnValues(ws, col) {
  const out = [];
  for (let r = DATA_START; r <= ws.rowCount; r += 1) {
    const t = cellText(ws, r, col);
    if (t) out.push({ row: r, text: t });
  }
  return out;
}

function safePlate(raw) {
  try {
    return normalizePlate(raw);
  } catch {
    return "";
  }
}

// Registre : clé naturelle -> document, _id déterministe pour une même clé.
function registry(namespace) {
  const map = new Map();
  return {
    ensure(key, factory) {
      if (!map.has(key)) map.set(key, factory(detId(namespace, key)));
      return map.get(key);
    },
    has: (key) => map.has(key),
    get: (key) => map.get(key),
    values: () => [...map.values()],
    size: () => map.size,
  };
}

// ---------------------------------------------------------------------------
// Chargement
// ---------------------------------------------------------------------------
async function loadSheets() {
  const sheets = [];
  for (const file of INPUT_FILES) {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile(path.join(INPUT_DIR, file.name));
    const ws = wb.worksheets[0];
    // Vérifie que la ligne d'en-tête correspond bien.
    const header = cellText(ws, HEADER_ROW, file.cols.produit).toUpperCase();
    if (header !== "PRODUIT") {
      throw new Error(`${file.tag} : en-tête PRODUIT introuvable en B${HEADER_ROW} (trouvé "${header}").`);
    }
    sheets.push({ file, ws });
  }
  return sheets;
}

// ---------------------------------------------------------------------------
// Produits + unités
// ---------------------------------------------------------------------------
function buildProducts(sheets) {
  const products = registry("product"); // key = productKey -> doc
  const unitByKey = new Map(); // productKey -> unitId

  // Carte produit -> unité depuis TYPE_PROUIT / UNITE (F2, F3).
  for (const { file, ws } of sheets) {
    if (!file.cols.typeProduit || !file.cols.unite) continue;
    for (let r = DATA_START; r <= ws.rowCount; r += 1) {
      const p = cellText(ws, r, file.cols.typeProduit);
      const u = upper(cellText(ws, r, file.cols.unite));
      if (!p) continue;
      const unitId = u.includes("M3") || u.includes("CUBE") ? REF.measureUnit.m3 : u.includes("TONNE") ? REF.measureUnit.tonnes : null;
      if (unitId) unitByKey.set(productKey(p), unitId);
    }
  }

  const isConcasse = (v) => /^CONCASSE\s+.+/.test(upper(v));
  const addProduct = (raw) => {
    const val = clean(raw);
    if (!val || isNumeric(val)) return;
    const u = upper(val);
    if (NOISE.has(u) || CONFIG_LABELS.has(u)) return;
    const key = productKey(val);
    if (!key) return;
    const concasse = isConcasse(val);
    products.ensure(key, (id) => ({
      _id: oid(id),
      name: val,
      description: `Produit importé (${concasse ? "concassé" : "standard"}).`,
      productType: oid(concasse ? REF.productType.concasse : REF.productType.standard),
      _key: key,
      _concasse: concasse,
      ...stamp(),
    }));
  };

  for (const { file, ws } of sheets) {
    for (const { text } of columnValues(ws, file.cols.produit)) addProduct(text);
    if (file.cols.concasse) for (const { text } of columnValues(ws, file.cols.concasse)) addProduct(text);
    if (file.cols.typeProduit) for (const { text } of columnValues(ws, file.cols.typeProduit)) addProduct(text);
  }

  // ProductMeasureUnit : une unité par défaut par produit.
  const productMeasureUnits = products.values().map((p) => {
    const unitId = unitByKey.get(p._key) || (p._concasse ? REF.measureUnit.tonnes : REF.measureUnit.m3);
    return {
      _id: oid(detId("pmu", `${p._id.$oid}:${unitId}`)),
      product: p._id,
      measureUnit: oid(unitId),
      amount: 0,
      isDefault: true,
      ...stamp(),
    };
  });
  notes.push("ProductMeasureUnit.amount=0 : aucun prix produit dans les Excel, à compléter.");

  return { products, productMeasureUnits };
}

// ---------------------------------------------------------------------------
// Conducteurs
// ---------------------------------------------------------------------------
function buildDrivers(sheets) {
  const drivers = registry("driver"); // key = nameKey
  for (const { ws, file } of sheets) {
    for (const { text } of columnValues(ws, file.cols.conducteur)) {
      let key;
      try {
        key = normalizeDriverKey(text);
      } catch {
        continue;
      }
      const fullName = clean(text);
      const existing = drivers.get(key);
      if (existing) {
        if (fullName.length > existing.fullName.length) existing.fullName = fullName; // garde le plus complet
        if (fullName !== existing.fullName && upper(fullName) !== upper(existing.fullName)) {
          conflicts.push({ kind: "driver", key, kept: existing.fullName, variant: fullName });
        }
        continue;
      }
      drivers.ensure(key, (id) => ({ _id: oid(id), fullName, nameKey: key, isActive: true, ...stamp() }));
    }
  }
  return drivers;
}

// ---------------------------------------------------------------------------
// Véhicules + taxonomie dérivée (marques, types, modèles, sources)
// ---------------------------------------------------------------------------
function buildVehicles(sheets) {
  const raw = new Map(); // plateNorm -> { plateRaw, config, marque, source, priority }

  const mergeField = (obj, field, value, priority, plate) => {
    if (!value) return;
    if (!obj[field]) {
      obj[field] = value;
      return;
    }
    if (obj[field] === value) return;
    if (priority > obj.priority) {
      conflicts.push({ kind: "vehicle", plate, field, kept: value, replaced: obj[field], reason: "priorité fichier" });
      obj[field] = value;
    } else {
      conflicts.push({ kind: "vehicle", plate, field, kept: obj[field], ignored: value });
    }
  };

  // F2/F3 (priorité 2) d'abord, puis F1 (priorité 1).
  const ordered = [...sheets].sort((a, b) => b.file.priority - a.file.priority);
  for (const { file, ws } of ordered) {
    const c = file.cols;
    for (let r = DATA_START; r <= ws.rowCount; r += 1) {
      const plateRaw = cellText(ws, r, c.camion);
      if (!plateRaw) continue;
      const plateNorm = safePlate(plateRaw);
      if (!plateNorm) continue;
      const config = c.camionModele ? normConfig(cellText(ws, r, c.camionModele)) : "";
      const marqueRaw = c.marque ? upper(cellText(ws, r, c.marque)) : "";
      const provenance = c.provenance ? upper(cellText(ws, r, c.provenance)) : "";
      const source = SOURCE_IS_EXTERNAL[provenance] !== undefined ? provenance : "";

      let obj = raw.get(plateNorm);
      if (!obj) {
        obj = { plateRaw: clean(plateRaw), plateNorm, config: "", marque: "", source: "", priority: file.priority };
        raw.set(plateNorm, obj);
      }
      obj.priority = Math.max(obj.priority, file.priority);
      mergeField(obj, "config", config && !CONFIG_LABELS.has(config) ? config : config, file.priority, plateNorm);
      mergeField(obj, "marque", marqueRaw, file.priority, plateNorm);
      mergeField(obj, "source", source, file.priority, plateNorm);
    }
  }

  const brands = registry("brand"); // key = label
  const types = registry("vtype");
  const models = registry("vmodel");
  const sources = registry("vsource");

  const ensureBrand = (label) => brands.ensure(label, (id) => ({ _id: oid(id), label, description: `Marque ${label}.`, ...stamp() }));
  const ensureType = (label) => types.ensure(label, (id) => ({ _id: oid(id), label, description: `Configuration ${label}.`, ...stamp() }));
  const ensureSource = (label) =>
    sources.ensure(label, (id) => ({ _id: oid(id), label, description: `Source ${label}.`, isExternal: !!SOURCE_IS_EXTERNAL[label], ...stamp() }));
  const ensureModel = (marque, config) => {
    const brand = ensureBrand(marque);
    const label = `${marque} ${config}`.trim();
    return models.ensure(label, (id) => ({ _id: oid(id), label, description: `Modèle ${label}.`, brand: brand._id, ...stamp() }));
  };

  // Sources canoniques + types depuis la colonne MODELE (liste).
  for (const label of Object.keys(SOURCE_IS_EXTERNAL)) ensureSource(label);
  for (const { file, ws } of sheets) {
    if (!file.cols.modeleList) continue;
    for (const { text } of columnValues(ws, file.cols.modeleList)) {
      const cfg = normConfig(text);
      if (CONFIG_LABELS.has(cfg)) ensureType(cfg);
    }
  }

  const vehicles = raw.size ? [] : [];
  for (const obj of raw.values()) {
    const marque = obj.marque || UNKNOWN;
    const config = obj.config || UNKNOWN;
    const source = obj.source || DEFAULT_SOURCE;
    if (!obj.marque || !obj.config || !obj.source) {
      conflicts.push({
        kind: "vehicle-incomplete",
        plate: obj.plateNorm,
        marque: obj.marque || null,
        config: obj.config || null,
        source: obj.source || null,
        applied: { marque, config, source },
      });
    }
    const type = ensureType(config);
    const model = ensureModel(marque, config);
    const src = ensureSource(source);
    vehicles.push({
      _id: oid(detId("vehicle", obj.plateNorm)),
      registrationNumber: obj.plateRaw,
      plateRaw: obj.plateRaw,
      plateNormalized: obj.plateNorm,
      model: model._id,
      type: type._id,
      source: src._id,
      status: "verified",
      metadata: { seedSource: "buildConfigSeeds", marque, config },
      ...stamp(),
    });
  }

  return { vehicles, brands, types, models, sources };
}

// ---------------------------------------------------------------------------
// Lieux : chantiers (destination), expéditions, sous-points (sections)
// ---------------------------------------------------------------------------
function buildLocations(sheets, productKeys) {
  const locations = registry("location"); // key = upper(label) -> doc
  const sectionsRaw = []; // { label, parentLabel }
  const SUBPOINT = /\b(PK|OA|LOT)\s*\d+/i;

  const isNoise = (val) => {
    const u = upper(val);
    if (!val || isNumeric(val) || NOISE.has(u) || CONFIG_LABELS.has(u)) return true;
    if (/^CONCASSE\s+.+/.test(u)) return true; // concassés pollués dans certaines colonnes
    if (productKeys.has(productKey(val))) return true; // produits pollués
    return false;
  };

  const ensureLocation = (label, type) => {
    const key = upper(label);
    const doc = locations.ensure(key, (id) => ({
      _id: oid(id),
      label: clean(label),
      description: "Référentiel de site importé.",
      type,
      isActive: true,
      ...stamp(),
    }));
    if (type === "expedition" && doc.type !== "expedition") {
      doc.type = "expedition"; // l'expédition est plus spécifique
    }
    return doc;
  };

  const consider = (val, defaultType) => {
    if (isNoise(val)) return;
    const m = val.match(/^(.*?)[\s-]*\b(PK|OA|LOT)\s*\d+/i);
    if (SUBPOINT.test(val) && m && clean(m[1]).length >= 3) {
      sectionsRaw.push({ label: clean(val), parentLabel: clean(m[1]) });
      return;
    }
    if (SUBPOINT.test(val)) {
      notes.push(`Sous-point sans parent identifiable, traité en Location : "${clean(val)}"`);
    }
    ensureLocation(val, defaultType);
  };

  for (const { file, ws } of sheets) {
    for (const { text } of columnValues(ws, file.cols.chantier)) consider(text, "destination");
    if (file.cols.expedition) for (const { text } of columnValues(ws, file.cols.expedition)) consider(text, "expedition");
  }

  // Sections : rattache au parent (créé en destination si absent).
  const sections = registry("section"); // key = upper(label)
  for (const { label, parentLabel } of sectionsRaw) {
    const parent = ensureLocation(parentLabel, "destination");
    sections.ensure(upper(label), (id) => ({
      _id: oid(id),
      label,
      description: "Sous-point importé.",
      chantier: parent._id,
      chantierLabel: parent.label, // résolu par l'importeur, non persisté
      ...stamp(),
    }));
  }

  return { locations, sections };
}

// ---------------------------------------------------------------------------
// TransportType + Pricing (secondaire)
// ---------------------------------------------------------------------------
function buildTransportAndPricing() {
  const transportTypes = registry("transport");
  const ensureTt = (label) => transportTypes.ensure(label, (id) => ({ _id: oid(id), label, description: `Transport ${label}.`, ...stamp() }));
  const tt10 = ensureTt("10 ROUES");
  const tt12 = ensureTt("12 ROUES");

  const pricing = [
    { price: 4000, transportType: tt10._id, description: "TDL 10 ROUES" },
    { price: 5000, transportType: tt12._id, description: "TDL 12 ROUES" },
    { price: 350, transportType: tt10._id, description: "TAXE MINIERE" },
  ].map((p) => ({
    _id: oid(detId("pricing", p.description)),
    price: p.price,
    transportType: p.transportType,
    typeColis: oid(REF.productType.standard),
    unit: oid(REF.measureUnit.tonnes),
    quantity: 1,
    status: "active",
    description: p.description,
    ...stamp(),
  }));
  notes.push("Pricing : valeurs par défaut (typeColis=STANDARD, unit=TONNES, qty=1). TAXE MINIERE rattachée à 10 ROUES par défaut.");

  return { transportTypes, pricing };
}

// ---------------------------------------------------------------------------
// Écriture
// ---------------------------------------------------------------------------
function stripInternal(docs) {
  return docs.map((d) => {
    const { _key, _concasse, ...rest } = d;
    return rest;
  });
}

function writeJson(name, docs) {
  fs.writeFileSync(path.join(OUTPUT_DIR, name), `${JSON.stringify(docs, null, 2)}\n`);
}

async function main() {
  const sheets = await loadSheets();

  const { products, productMeasureUnits } = buildProducts(sheets);
  const drivers = buildDrivers(sheets);
  const { vehicles, brands, types, models, sources } = buildVehicles(sheets);
  const productKeys = new Set(products.values().map((p) => p._key));
  const { locations, sections } = buildLocations(sheets, productKeys);
  const { transportTypes, pricing } = buildTransportAndPricing();

  const outputs = {
    "config.vehicleBrands.json": brands.values(),
    "config.vehicleTypes.json": types.values(),
    "config.vehicleSources.json": sources.values(),
    "config.vehicleModels.json": models.values(),
    "config.transportTypes.json": transportTypes.values(),
    "config.products.json": stripInternal(products.values()),
    "config.productMeasureUnits.json": productMeasureUnits,
    "config.locations.json": locations.values(),
    "config.sections.json": sections.values(),
    "config.drivers.json": drivers.values(),
    "config.vehicles.json": vehicles,
    "config.pricing.json": pricing,
  };

  for (const [name, docs] of Object.entries(outputs)) writeJson(name, docs);

  const counts = Object.fromEntries(Object.entries(outputs).map(([name, docs]) => [name.replace(/^config\.|\.json$/g, ""), docs.length]));

  writeJson("config.conflicts-report.json", { generatedAt: NOW, notes, counts, conflicts });
  writeJson("config.manifest.json", {
    collectionOrder: [
      "vehicleBrands", "vehicleTypes", "vehicleSources", "vehicleModels", "transportTypes",
      "products", "productMeasureUnits", "locations", "sections", "drivers", "vehicles", "pricing",
    ],
    counts,
    conflicts: conflicts.length,
    references: REF,
  });

  console.log(JSON.stringify({ counts, conflicts: conflicts.length, notes: notes.length }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
