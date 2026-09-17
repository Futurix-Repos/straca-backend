/**
 * Répare les dégâts du premier import config sur products / productmeasureunits :
 *   1. Supprime les produits DOUBLONS créés par le seed (dont l'_id == id déterministe)
 *      quand un jumeau plus ancien existe déjà (même clé normalisée).
 *   2. Supprime les PMU ORPHELINES (dont le product n'existe plus / n'a jamais existé).
 *
 * Après ce nettoyage, relancer :
 *   node scripts/importConfigSeeds.js products productMeasureUnits
 * pour recréer les PMU correctement liées aux produits canoniques.
 *
 * LECTURE SEULE par défaut. Mutation uniquement avec APPLY=1.
 *   node scripts/repairConfigProducts.js           # dry-run (n'écrit rien)
 *   APPLY=1 node scripts/repairConfigProducts.js    # applique les suppressions
 */

require("dotenv").config();

const crypto = require("crypto");
const mongoose = require("mongoose");

const APPLY = process.env.APPLY === "1";
const detId = (ns, key) => crypto.createHash("md5").update(`${ns}::${key}`).digest("hex").slice(0, 24);
const productKey = (s) =>
  String(s).trim().toUpperCase().normalize("NFD").replace(/\p{M}/gu, "").replace(/_+/g, " ").replace(/\s+/g, " ").trim();

async function main() {
  if (!process.env.DB_URL) throw new Error("DB_URL est obligatoire.");
  await mongoose.connect(process.env.DB_URL);
  const db = mongoose.connection.db;

  const products = await db.collection("products").find({}, { projection: { name: 1 } }).toArray();

  // 1. Doublons : notre produit (id déterministe) alors qu'un jumeau plus ancien existe.
  const byKey = new Map();
  for (const p of products) {
    const k = productKey(p.name);
    if (!byKey.has(k)) byKey.set(k, []);
    byKey.get(k).push(p);
  }
  const duplicatesToDelete = [];
  for (const [k, group] of byKey) {
    if (group.length < 2) continue;
    const det = detId("product", k);
    const ours = group.filter((p) => p._id.toString() === det);
    const others = group.filter((p) => p._id.toString() !== det);
    if (ours.length && others.length) {
      for (const p of ours) duplicatesToDelete.push(p);
    }
  }

  console.log("Doublons produits à supprimer :");
  for (const p of duplicatesToDelete) console.log(`  ${p._id} ${JSON.stringify(p.name)}`);

  const survivingProductIds = new Set(
    products.filter((p) => !duplicatesToDelete.some((d) => d._id.equals(p._id))).map((p) => p._id.toString()),
  );

  // 2. PMU orphelines : product absent des produits survivants.
  const pmus = await db.collection("productmeasureunits").find({}, { projection: { product: 1 } }).toArray();
  const orphanPmus = pmus.filter((pmu) => !pmu.product || !survivingProductIds.has(pmu.product.toString()));
  console.log(`PMU orphelines à supprimer : ${orphanPmus.length} / ${pmus.length}`);

  if (!APPLY) {
    console.log("\n[DRY-RUN] Rien supprimé. Relance avec APPLY=1 pour appliquer.");
    await mongoose.disconnect();
    return;
  }

  if (duplicatesToDelete.length) {
    await db.collection("products").deleteMany({ _id: { $in: duplicatesToDelete.map((p) => p._id) } });
  }
  if (orphanPmus.length) {
    await db.collection("productmeasureunits").deleteMany({ _id: { $in: orphanPmus.map((p) => p._id) } });
  }
  console.log(`\n[APPLY] Supprimé : ${duplicatesToDelete.length} produit(s), ${orphanPmus.length} PMU.`);
  console.log("Relance maintenant : node scripts/importConfigSeeds.js products productMeasureUnits");
  await mongoose.disconnect();
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
