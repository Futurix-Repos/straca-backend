require("dotenv").config();

const fs = require("fs");
const path = require("path");
const mongoose = require("mongoose");
const { normalizePlate } = require("../helpers/referenceNormalization");

// Comble les manques relevés entre « FLOTTE ATHIEME.xlsx » et la base straca :
//  - 41 camions de prestataires (feuille PRESTATAIRES) absents de `vehicles`
//  -  3 carrières (feuille CARRRIERES) absentes de `locations` (type expedition)
// Idempotent : n'insère que ce qui manque. Supporte --dry-run.

const vehiclesFile = path.join(__dirname, "../imports/athieme_prestataire_vehicles.json");
const carrieresFile = path.join(__dirname, "../imports/athieme_carrieres.json");

// Références par défaut pour un camion de prestataire dont on ne connaît ni la
// marque/modèle exacts : modèle « INCONNU 12 ROUES », type « 12 ROUES »,
// source externe « CAMION PRIVE » (isExternal: true).
const defaultReferences = {
  model: new mongoose.Types.ObjectId("b0b0ee4ab7214837829a849a"), // INCONNU 12 ROUES
  type: new mongoose.Types.ObjectId("713a042cae365a995861c70e"), // 12 ROUES
  source: new mongoose.Types.ObjectId("077a0d5e6ee80fbad27bd03a"), // CAMION PRIVE (externe)
};

// Nom court de l'Excel -> nom légal exact présent dans la collection `prestataires`.
const prestataireAliases = new Map([
  ["ATLANTIC BUSINESS", "ATLANTIC BUSINESS"],
  ["DINAS", "DINAS COMPANY"],
  ["JK TRANSPORT", "JK TRANSPORT"],
  ["SEMAG", "SEMAG SARL"],
  ["WILLS", "WILLS LOGISTICS"],
  ["NEW LIFE", "NEW LIFE POWER SARL"],
  ["MERVEILLE GROUP", "MERVEILLE GROUP DES SIGNES"],
]);

const IMPORT_SOURCE = "FLOTTE ATHIEME.xlsx";

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

async function importFlotte({ dryRun = false } = {}) {
  const db = mongoose.connection.db;

  // ---------- Prestataires : résolution nom -> _id ----------
  const legalNames = [...new Set([...prestataireAliases.values()])];
  const prestataires = await db
    .collection("prestataires")
    .find({ name: { $in: legalNames } }, { projection: { _id: 1, name: 1 } })
    .toArray();
  const prestataireByName = new Map(prestataires.map((p) => [p.name, p]));

  const unresolvedPrestataires = legalNames.filter((name) => !prestataireByName.has(name));
  if (unresolvedPrestataires.length) {
    throw new Error(
      `Prestataires introuvables en base : ${unresolvedPrestataires.join(", ")}`,
    );
  }

  // ---------- Camions ----------
  const vehicleRows = readJson(vehiclesFile);
  const plateKeys = vehicleRows.map((row) => normalizePlate(row.immatriculation));
  const existingVehicles = await db
    .collection("vehicles")
    .find({ plateNormalized: { $in: plateKeys } }, { projection: { plateNormalized: 1 } })
    .toArray();
  const existingPlates = new Set(existingVehicles.map((v) => v.plateNormalized));

  const now = new Date();
  const vehiclesToInsert = [];
  for (const row of vehicleRows) {
    const plate = normalizePlate(row.immatriculation);
    if (existingPlates.has(plate)) continue;

    const legalName = prestataireAliases.get(row.prestataire);
    if (!legalName) {
      throw new Error(`Alias prestataire inconnu : « ${row.prestataire} »`);
    }
    const prestataire = prestataireByName.get(legalName);

    vehiclesToInsert.push({
      _id: new mongoose.Types.ObjectId(),
      registrationNumber: row.immatriculation,
      plateRaw: row.immatriculation,
      plateNormalized: plate,
      model: defaultReferences.model,
      type: defaultReferences.type,
      source: defaultReferences.source,
      prestataire: prestataire._id,
      status: "verified",
      metadata: { importSource: IMPORT_SOURCE, prestataireLabel: row.prestataire },
      createdAt: now,
      updatedAt: now,
    });
    existingPlates.add(plate);
  }

  // ---------- Carrières (locations type expedition) ----------
  const carriereRows = readJson(carrieresFile);
  const labels = carriereRows.map((row) => row.label);
  const existingLocations = await db
    .collection("locations")
    .find({ label: { $in: labels } }, { projection: { label: 1 } })
    .toArray();
  const existingLabels = new Set(existingLocations.map((l) => l.label));

  const locationsToInsert = [];
  for (const row of carriereRows) {
    if (existingLabels.has(row.label)) continue;
    locationsToInsert.push({
      _id: new mongoose.Types.ObjectId(),
      label: row.label,
      description: "Référentiel de site importé.",
      type: "expedition",
      isActive: true,
      metadata: { importSource: IMPORT_SOURCE, produits: row.produits || [] },
      createdAt: now,
      updatedAt: now,
    });
    existingLabels.add(row.label);
  }

  const summary = {
    vehiclesInFile: vehicleRows.length,
    vehiclesAlreadyPresent: vehicleRows.length - vehiclesToInsert.length,
    vehiclesToInsert: vehiclesToInsert.length,
    carrieresInFile: carriereRows.length,
    carrieresAlreadyPresent: carriereRows.length - locationsToInsert.length,
    carrieresToInsert: locationsToInsert.length,
    newPlates: vehiclesToInsert.map((v) => v.registrationNumber),
    newCarrieres: locationsToInsert.map((l) => l.label),
  };

  if (dryRun) return summary;

  if (vehiclesToInsert.length) {
    await db.collection("vehicles").insertMany(vehiclesToInsert, { ordered: true });
  }
  if (locationsToInsert.length) {
    await db.collection("locations").insertMany(locationsToInsert, { ordered: true });
  }
  return summary;
}

async function main() {
  if (!process.env.DB_URL) throw new Error("DB_URL est obligatoire.");
  await mongoose.connect(process.env.DB_URL);
  const summary = await importFlotte({ dryRun: process.argv.includes("--dry-run") });
  console.log(JSON.stringify(summary, null, 2));
}

if (require.main === module) {
  main()
    .catch((error) => {
      console.error(error.message);
      process.exitCode = 1;
    })
    .finally(() => mongoose.disconnect());
}

module.exports = { importFlotte };
