require("dotenv").config();

const mongoose = require("mongoose");
const { normalizePlate } = require("../helpers/referenceNormalization");

function buildMigrationPlan(vehicles) {
  const byPlate = new Map();

  for (const vehicle of vehicles) {
    const rawPlate = vehicle.plateRaw || vehicle.registrationNumber;
    if (!rawPlate) continue;
    const plateNormalized = normalizePlate(rawPlate);
    const entries = byPlate.get(plateNormalized) || [];
    entries.push(vehicle._id);
    byPlate.set(plateNormalized, entries);
  }

  const collisions = [...byPlate.entries()]
    .filter(([, ids]) => ids.length > 1)
    .map(([plate]) => plate)
    .sort();

  if (collisions.length > 0) return { collisions, updates: [] };

  const updates = vehicles.flatMap((vehicle) => {
    const plateRaw = vehicle.plateRaw || vehicle.registrationNumber;
    if (!plateRaw) return [];
    const update = {
      plateRaw: plateRaw.trim(),
      plateNormalized: normalizePlate(plateRaw),
      ...(vehicle.status ? {} : { status: "verified" }),
    };
    const isAlreadyCurrent = Object.entries(update).every(
      ([key, value]) => vehicle[key] === value,
    );
    return isAlreadyCurrent ? [] : [{ _id: vehicle._id, update }];
  });

  return { collisions, updates };
}

async function run() {
  const dryRun = process.argv.includes("--dry-run");
  if (!process.env.DB_URL) throw new Error("DB_URL est obligatoire.");

  await mongoose.connect(process.env.DB_URL);
  const Vehicle = require("../models/vehicleModel");
  const vehicles = await Vehicle.find({}).lean();
  const plan = buildMigrationPlan(vehicles);

  console.log(`Véhicules analysés : ${vehicles.length}`);
  if (plan.collisions.length > 0) {
    console.error(`Collisions détectées : ${plan.collisions.join(", ")}`);
    process.exitCode = 1;
    return;
  }

  console.log(`Véhicules à mettre à jour : ${plan.updates.length}`);
  if (dryRun || plan.updates.length === 0) {
    console.log(dryRun ? "Simulation terminée, aucune écriture effectuée." : "Aucune écriture nécessaire.");
    return;
  }

  await Vehicle.bulkWrite(
    plan.updates.map(({ _id, update }) => ({ updateOne: { filter: { _id }, update: { $set: update } } })),
  );
  console.log("Migration terminée.");
}

if (require.main === module) {
  run()
    .catch((error) => {
      console.error(error.message);
      process.exitCode = 1;
    })
    .finally(() => mongoose.disconnect());
}

module.exports = { buildMigrationPlan };
