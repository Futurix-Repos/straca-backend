// scripts/migrateTrackingProvider.js
//
// Migration one-shot vers le modèle de tracking multi-provider.
//
// Véhicules :
//   tracking.trackerImei  →  tracking.deviceId (provider = 'trackfuel')
//   tracking.id (legacy Wialon, si pas de trackerImei) → tracking.deviceId (provider = 'wialon')
//   $unset tracking.trackerImei, tracking.id, tracking.plate
//
// Livraisons :
//   tracking.trackerImei  →  tracking.deviceId (provider = 'trackfuel')
//   $unset tracking.trackerImei
//
// Idempotent : ne traite que les documents portant encore les champs legacy.
// Opère via le driver natif (les champs legacy ne sont plus dans le schéma).
//
// Usage :
//   node scripts/migrateTrackingProvider.js            # applique
//   node scripts/migrateTrackingProvider.js --dry-run  # simulation, sans écriture

require("dotenv").config();
const mongoose = require("mongoose");
const Vehicle = require("../models/vehicleModel");
const Delivery = require("../models/deliveryModel");

const DRY_RUN = process.argv.includes("--dry-run");

async function migrateVehicles() {
  const col = Vehicle.collection;
  const cursor = col.find({
    $or: [
      { "tracking.trackerImei": { $exists: true } },
      { "tracking.id": { $exists: true } },
      { "tracking.plate": { $exists: true } },
    ],
  });

  let migrated = 0;
  let ambiguous = 0;

  for await (const doc of cursor) {
    const t = doc.tracking || {};
    const deviceId = t.trackerImei || t.id || null;
    const provider = t.trackerImei ? "trackfuel" : t.id ? "wialon" : "trackfuel";

    if (!deviceId) {
      ambiguous += 1;
      console.warn(
        `  ⚠️  ${doc.registrationNumber || doc._id} : aucun identifiant device (plate seule) → provider='${provider}', pas de deviceId`,
      );
    } else {
      console.log(
        `  ${doc.registrationNumber || doc._id}  →  provider='${provider}', deviceId=${deviceId}`,
      );
    }

    const set = { "tracking.provider": provider };
    if (deviceId) set["tracking.deviceId"] = deviceId;

    if (!DRY_RUN) {
      await col.updateOne(
        { _id: doc._id },
        {
          $set: set,
          $unset: {
            "tracking.trackerImei": "",
            "tracking.id": "",
            "tracking.plate": "",
          },
        },
      );
    }
    migrated += 1;
  }

  return { migrated, ambiguous };
}

async function migrateDeliveries() {
  const col = Delivery.collection;
  const cursor = col.find({ "tracking.trackerImei": { $exists: true } });

  let migrated = 0;

  for await (const doc of cursor) {
    const deviceId = doc.tracking?.trackerImei || null;
    if (!DRY_RUN) {
      await col.updateOne(
        { _id: doc._id },
        {
          $set: { "tracking.provider": "trackfuel", "tracking.deviceId": deviceId },
          $unset: { "tracking.trackerImei": "" },
        },
      );
    }
    migrated += 1;
  }

  return { migrated };
}

/// Supprime les anciens index uniques devenus inutiles (sur champs supprimés).
async function dropLegacyIndexes() {
  const legacy = ["tracking.id_1", "tracking.plate_1", "tracking.trackerImei_1"];
  for (const name of legacy) {
    try {
      if (!DRY_RUN) await Vehicle.collection.dropIndex(name);
      console.log(`  index supprimé: ${name}`);
    } catch (e) {
      // index absent (déjà supprimé) → on ignore
      if (!/index not found/i.test(e.message)) {
        console.warn(`  index ${name}: ${e.message}`);
      }
    }
  }
}

async function main() {
  if (!process.env.DB_URL) throw new Error("DB_URL est obligatoire.");
  await mongoose.connect(process.env.DB_URL);
  console.log(`Mode: ${DRY_RUN ? "DRY-RUN (aucune écriture)" : "APPLICATION"}\n`);

  console.log("=== Véhicules ===");
  const v = await migrateVehicles();

  console.log("\n=== Livraisons ===");
  const d = await migrateDeliveries();

  console.log("\n=== Index legacy ===");
  await dropLegacyIndexes();

  console.log("\n=== Résumé ===");
  console.log(`véhicules migrés : ${v.migrated}${DRY_RUN ? " (simulé)" : ""}`);
  console.log(`véhicules ambigus (sans deviceId) : ${v.ambiguous}`);
  console.log(`livraisons migrées : ${d.migrated}${DRY_RUN ? " (simulé)" : ""}`);

  await mongoose.disconnect();
}

main().catch((e) => {
  console.error("ERREUR:", e.message);
  process.exit(1);
});
