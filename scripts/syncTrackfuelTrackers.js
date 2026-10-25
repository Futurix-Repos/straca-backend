// scripts/syncTrackfuelTrackers.js
//
// Rapproche le parc trackfuel (/trackers) des véhicules Straca et écrit l'IMEI
// (`tracking.deviceId` + `tracking.provider = 'trackfuel'`) sur chaque véhicule
// apparié. Le rapprochement se fait sur la clé alphanumérique :
// normalizeTrackerName(nom_engin) === plateNormalized.
//
// Idempotent. Les non-appariés (dans les deux sens) sont listés pour traitement
// manuel.
//
// Usage :
//   node scripts/syncTrackfuelTrackers.js            # applique
//   node scripts/syncTrackfuelTrackers.js --dry-run  # simulation, sans écriture

require("dotenv").config();
const mongoose = require("mongoose");
const Vehicle = require("../models/vehicleModel");
const { trackfuelClient } = require("../services/trackfuel/client");
const { normalizeTrackerName } = require("../helpers/referenceNormalization");

const DRY_RUN = process.argv.includes("--dry-run");

async function main() {
  if (!process.env.DB_URL) throw new Error("DB_URL est obligatoire.");
  if (!trackfuelClient.isConfigured()) {
    throw new Error("TRACKFUEL_EMAIL / TRACKFUEL_PASSWORD manquants dans .env");
  }

  await mongoose.connect(process.env.DB_URL);
  console.log(`Mode: ${DRY_RUN ? "DRY-RUN (aucune écriture)" : "APPLICATION"}`);

  const trackers = await trackfuelClient.listTrackers();
  console.log(`trackfuel: ${trackers.length} engins`);

  // Index clé normalisée → tracker. Les doublons de clé sont signalés.
  const byKey = new Map();
  const dupKeys = [];
  for (const t of trackers) {
    const key = normalizeTrackerName(t.name);
    if (!key) continue;
    if (byKey.has(key)) dupKeys.push(key);
    else byKey.set(key, t);
  }
  if (dupKeys.length) {
    console.warn(`⚠️  clés de nom en double côté trackfuel: ${dupKeys.join(", ")}`);
  }

  const vehicles = await Vehicle.find({
    plateNormalized: { $type: "string" },
  }).select("registrationNumber plateNormalized tracking");

  let matched = 0;
  let updated = 0;
  const unmatchedVehicles = [];
  const usedKeys = new Set();

  for (const v of vehicles) {
    const tracker = byKey.get(v.plateNormalized);
    if (!tracker) {
      unmatchedVehicles.push(v.registrationNumber || v.plateNormalized);
      continue;
    }
    matched += 1;
    usedKeys.add(v.plateNormalized);

    if (v.tracking?.deviceId !== tracker.imei) {
      updated += 1;
      console.log(
        `  ${v.registrationNumber}  ←  IMEI ${tracker.imei} (${tracker.name})` +
          (v.tracking?.deviceId ? ` [remplace ${v.tracking.deviceId}]` : ""),
      );
      if (!DRY_RUN) {
        v.tracking = {
          ...(v.tracking?.toObject?.() || v.tracking || {}),
          provider: "trackfuel",
          deviceId: tracker.imei,
        };
        await v.save();
      }
    }
  }

  const unmatchedTrackers = trackers
    .filter((t) => {
      const key = normalizeTrackerName(t.name);
      return key && !usedKeys.has(key);
    })
    .map((t) => `${t.name} (${t.imei})`);

  console.log("\n=== Résumé ===");
  console.log(`véhicules appariés : ${matched}/${vehicles.length}`);
  console.log(`IMEI écrits/mis à jour : ${updated}${DRY_RUN ? " (simulé)" : ""}`);
  console.log(`\nVéhicules SANS tracker (${unmatchedVehicles.length}):`);
  console.log("  " + (unmatchedVehicles.join(", ") || "—"));
  console.log(`\nTrackers NON rattachés à un véhicule (${unmatchedTrackers.length}):`);
  console.log("  " + (unmatchedTrackers.join(", ") || "—"));

  await mongoose.disconnect();
}

main().catch((e) => {
  console.error("ERREUR:", e.message);
  process.exit(1);
});
