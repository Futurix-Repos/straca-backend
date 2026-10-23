require("dotenv").config();

const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

/**
 * Met à jour l'email et le mot de passe d'un compte admin existant.
 *
 * Les identifiants ne sont PAS codés en dur : ils sont lus depuis
 * l'environnement pour éviter de committer un secret dans le dépôt.
 *
 * Variables d'environnement :
 *   DB_URL              (obligatoire) chaîne de connexion MongoDB
 *   CURRENT_ADMIN_EMAIL (optionnel)  email actuel à cibler, défaut "admin@gmail.com"
 *   NEW_ADMIN_EMAIL     (obligatoire) nouvel email
 *   NEW_ADMIN_PASSWORD  (obligatoire) nouveau mot de passe en clair (sera haché)
 *
 * Options :
 *   --dry-run   n'écrit rien, affiche seulement ce qui serait fait
 *
 * Exemple :
 *   CURRENT_ADMIN_EMAIL="admin@gmail.com" \
 *   NEW_ADMIN_EMAIL="nouvel.admin@exemple.com" \
 *   NEW_ADMIN_PASSWORD="motDePasseFort" \
 *   node scripts/updateAdminCredentials.js --dry-run
 */

const SALT_ROUNDS = 10;

async function run() {
  const dryRun = process.argv.includes("--dry-run");

  if (!process.env.DB_URL) throw new Error("DB_URL est obligatoire.");

  const currentEmail = (process.env.CURRENT_ADMIN_EMAIL || "admin@gmail.com").trim();
  const newEmail = (process.env.NEW_ADMIN_EMAIL || "").trim();
  const newPassword = process.env.NEW_ADMIN_PASSWORD || "";

  if (!newEmail) throw new Error("NEW_ADMIN_EMAIL est obligatoire.");
  if (!newPassword) throw new Error("NEW_ADMIN_PASSWORD est obligatoire.");
  if (newPassword.length < 12) {
    throw new Error("NEW_ADMIN_PASSWORD doit faire au moins 12 caractères.");
  }

  await mongoose.connect(process.env.DB_URL);
  const User = require("../models/userModel");

  const admin = await User.findOne({ email: currentEmail, type: "admin" });
  if (!admin) {
    throw new Error(
      `Aucun admin trouvé avec l'email "${currentEmail}" (type: "admin").`,
    );
  }

  // Si l'email change, s'assurer qu'aucun autre compte ne l'utilise déjà
  // (le champ email est unique côté schéma).
  if (newEmail !== currentEmail) {
    const clash = await User.findOne({
      email: newEmail,
      _id: { $ne: admin._id },
    });
    if (clash) {
      throw new Error(
        `L'email "${newEmail}" est déjà utilisé par un autre compte (_id: ${clash._id}).`,
      );
    }
  }

  console.log(`Admin ciblé      : ${admin.email} (_id: ${admin._id})`);
  console.log(`Nouvel email     : ${newEmail}`);
  console.log(`Nouveau password : (${newPassword.length} caractères, sera haché bcrypt)`);

  if (dryRun) {
    console.log("Simulation (--dry-run) : aucune écriture effectuée.");
    return;
  }

  const hashedPassword = await bcrypt.hash(newPassword, SALT_ROUNDS);
  admin.email = newEmail;
  admin.password = hashedPassword;
  await admin.save();

  console.log("Identifiants admin mis à jour avec succès.");
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
