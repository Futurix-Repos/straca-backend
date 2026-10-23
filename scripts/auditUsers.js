require("dotenv").config();

const mongoose = require("mongoose");

/**
 * Audit LECTURE SEULE des comptes utilisateurs — recherche de comptes
 * potentiellement créés via l'ancienne faille `POST /auth/signup`
 * (création non authentifiée avec `type` arbitraire et `confirmed: true`).
 *
 * N'écrit RIEN en base. Utilisation :
 *   node scripts/auditUsers.js
 */

function fmt(d) {
  return d ? new Date(d).toISOString() : "—";
}

async function run() {
  if (!process.env.DB_URL) throw new Error("DB_URL est obligatoire.");
  await mongoose.connect(process.env.DB_URL);

  const User = require("../models/userModel");
  const users = await User.find({})
    .select("email type role confirmed firstName lastName phone createdAt updatedAt")
    .lean();

  console.log(`\n=== Total comptes : ${users.length} ===`);

  // Répartition par type
  const byType = users.reduce((acc, u) => {
    acc[u.type || "(absent)"] = (acc[u.type || "(absent)"] || 0) + 1;
    return acc;
  }, {});
  console.log("Répartition par type :", byType);

  // 1. Tous les admins
  const admins = users.filter((u) => u.type === "admin");
  console.log(`\n=== Comptes ADMIN (${admins.length}) ===`);
  admins
    .sort((a, b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0))
    .forEach((u) => {
      console.log(
        `  ${u.email}  | _id=${u._id} | role=${u.role ? u.role : "AUCUN"} | ` +
          `confirmed=${u.confirmed} | créé=${fmt(u.createdAt)}`,
      );
    });

  // 2. Signaux suspects (heuristiques liées à la faille signup)
  //    - admin sans rôle attaché (le dashboard attache toujours un rôle)
  //    - comptes confirmés mais sans nom (signup minimal possible)
  const suspects = users.filter((u) => {
    const adminSansRole = u.type === "admin" && !u.role;
    const confirmeSansNom =
      u.confirmed === true && !u.firstName && !u.lastName && u.type !== "admin";
    return adminSansRole || confirmeSansNom;
  });
  console.log(`\n=== Comptes SUSPECTS (${suspects.length}) ===`);
  if (suspects.length === 0) {
    console.log("  Aucun signal évident.");
  } else {
    suspects.forEach((u) => {
      const raisons = [];
      if (u.type === "admin" && !u.role) raisons.push("admin sans rôle");
      if (u.confirmed === true && !u.firstName && !u.lastName && u.type !== "admin")
        raisons.push("confirmé sans nom");
      console.log(
        `  ${u.email} | type=${u.type} | _id=${u._id} | créé=${fmt(u.createdAt)} | ⚠ ${raisons.join(", ")}`,
      );
    });
  }

  // 3. 15 comptes les plus récents (une création surprise = piste)
  console.log("\n=== 15 comptes les plus récents ===");
  users
    .slice()
    .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
    .slice(0, 15)
    .forEach((u) => {
      console.log(`  ${fmt(u.createdAt)} | ${u.type} | ${u.email}`);
    });

  console.log("\nAudit terminé (lecture seule, aucune écriture).\n");
}

if (require.main === module) {
  run()
    .catch((error) => {
      console.error(error.message);
      process.exitCode = 1;
    })
    .finally(() => mongoose.disconnect());
}

module.exports = { run };
