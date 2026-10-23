// scripts/trackfuelProbe.js
//
// Diagnostic de l'API trackfuel : login + appel de chaque endpoint pour un IMEI
// donné. À lancer depuis une IP autorisée par le prestataire (le port 5144 est
// filtré par whitelist). Ne modifie rien.
//
// Usage :
//   node scripts/trackfuelProbe.js [IMEI] [YYYY-MM-DD]
//   (IMEI par défaut : premier engin actif ; date par défaut : aujourd'hui)

require("dotenv").config();
const { trackfuelClient } = require("../services/trackfuel/client");

function todayUTC() {
  return new Date().toISOString().slice(0, 10);
}

async function main() {
  if (!trackfuelClient.isConfigured()) {
    throw new Error("TRACKFUEL_EMAIL / TRACKFUEL_PASSWORD manquants dans .env");
  }

  let imei = process.argv[2];
  const date = process.argv[3] || todayUTC();

  console.log("=== /login ===");
  await trackfuelClient.login();
  console.log("OK (token obtenu)");

  console.log("\n=== /trackers ===");
  const trackers = await trackfuelClient.listTrackers();
  console.log(`${trackers.length} engins. Exemples:`, trackers.slice(0, 3));
  if (!imei) imei = trackers[0]?.imei;
  console.log("IMEI testé:", imei);

  console.log("\n=== /trackers/latest ===");
  console.log(await trackfuelClient.latest(imei));

  console.log(`\n=== /history (date=${date}, page 1) ===`);
  const { points } = await trackfuelClient.history(imei, date, { page: 1 });
  console.log(`${points.length} points. 1er:`, points[0], "\ndernier:", points[points.length - 1]);

  console.log(`\n=== /events (${date} → ${todayUTC()}) ===`);
  const events = await trackfuelClient.events(imei, date, todayUTC());
  console.log(`${events.length} événements:`, events.slice(0, 5));
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error("ERREUR:", e.message);
    process.exit(1);
  });
