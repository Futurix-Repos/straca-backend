require("dotenv").config();

const fs = require("fs");
const path = require("path");
const mongoose = require("mongoose");

const importDirectory = path.resolve(__dirname, "../imports/reference");
const imports = {
  drivers: { collection: "drivers", file: "drivers.json" },
  vehicleDriverAssignments: {
    collection: "vehicleDriverAssignments",
    file: "vehicleDriverAssignments.json",
  },
};

function fromExtendedJson(value) {
  if (Array.isArray(value)) return value.map(fromExtendedJson);
  if (!value || typeof value !== "object") return value;
  if (Object.keys(value).length === 1 && value.$oid) return new mongoose.Types.ObjectId(value.$oid);
  if (Object.keys(value).length === 1 && value.$date) return new Date(value.$date);
  return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, fromExtendedJson(child)]));
}

async function importCollection(name) {
  const config = imports[name];
  if (!config) throw new Error(`Import inconnu : ${name}`);
  const documents = fromExtendedJson(JSON.parse(fs.readFileSync(path.join(importDirectory, config.file), "utf8")));
  const result = await mongoose.connection.db.collection(config.collection).bulkWrite(
    documents.map((document) => ({
      replaceOne: { filter: { _id: document._id }, replacement: document, upsert: true },
    })),
    { ordered: true },
  );
  return { collection: config.collection, documents: documents.length, result };
}

async function main() {
  const requested = process.argv.slice(2);
  const names = requested.length > 0 ? requested : Object.keys(imports);
  if (!process.env.DB_URL) throw new Error("DB_URL est obligatoire.");

  await mongoose.connect(process.env.DB_URL);
  const results = [];
  for (const name of names) results.push(await importCollection(name));
  console.log(JSON.stringify(results.map(({ collection, documents, result }) => ({
    collection,
    documents,
    inserted: result.upsertedCount,
    updated: result.modifiedCount,
  }))));
}

if (require.main === module) {
  main()
    .catch((error) => {
      console.error(error.message);
      process.exitCode = 1;
    })
    .finally(() => mongoose.disconnect());
}

module.exports = { fromExtendedJson };
