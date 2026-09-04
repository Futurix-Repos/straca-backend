require("dotenv").config();

const fs = require("fs");
const mongoose = require("mongoose");
const { normalizeDriverKey, normalizePlate } = require("../helpers/referenceNormalization");

const inputFile = "imports/adjahe_athieme_assignments.json";
const period = {
  endsAt: new Date("2026-08-04T23:59:59.999Z"),
  startsAt: new Date("2026-07-27T00:00:00.000Z"),
};
const defaultReferences = {
  model: new mongoose.Types.ObjectId("679ca8fad2726f1975815dcf"),
  source: new mongoose.Types.ObjectId("679ca925d2726f1975815dea"),
  type: new mongoose.Types.ObjectId("67851a82adf7802231d9278e"),
};
const aliases = new Map([
  ["AHOUANGANSI CODJO PAMPHILE", "AHOUANGANSI C, PAMPHILE"],
  ["HODONOU SERGES", "HODONOU SERGE"],
  ["AWEDO MARCEL", "STRACA-SA, AWEDO MARCEL"],
  ["KOUVEGLO MODESTE", "KOUVEGLO ZIMMAVO MODESTE"],
  ["AZONSI EZECHIEL", "AZONSI EZEKIEL TONAKPON"],
  ["GNANHOUI CARMEL", "GNANHOUI CAMEL"],
]);

function inputRows() {
  return JSON.parse(fs.readFileSync(inputFile, "utf8"));
}

async function importSchedule({ dryRun = false } = {}) {
  const db = mongoose.connection.db;
  const rows = inputRows();
  const plateKeys = rows.map((row) => normalizePlate(row.immatriculation));
  const vehicles = await db.collection("vehicles").find(
    { plateNormalized: { $in: plateKeys } },
    { projection: { _id: 1, plateNormalized: 1 } },
  ).toArray();
  const vehicleByPlate = new Map(vehicles.map((vehicle) => [vehicle.plateNormalized, vehicle]));

  const drivers = await db.collection("drivers").find(
    {},
    { projection: { _id: 1, nameKey: 1 } },
  ).toArray();
  const driverByNameKey = new Map(drivers.map((driver) => [driver.nameKey, driver]));

  const missingVehicles = [];
  const missingDrivers = [];
  for (const row of rows) {
    const plate = normalizePlate(row.immatriculation);
    if (!vehicleByPlate.has(plate)) {
      const vehicle = {
        _id: new mongoose.Types.ObjectId(),
        registrationNumber: row.immatriculation,
        plateRaw: row.immatriculation,
        plateNormalized: plate,
        model: defaultReferences.model,
        type: defaultReferences.type,
        source: defaultReferences.source,
        prestataire: null,
        status: "verified",
        metadata: { importSource: "10 R & 12 R SUR ADJAHA-ATHIEME.xlsx" },
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      vehicleByPlate.set(plate, vehicle);
      missingVehicles.push(vehicle);
    }

    const expectedNameKey = normalizeDriverKey(row.conducteur);
    const aliasNameKey = aliases.get(expectedNameKey);
    if (!driverByNameKey.has(expectedNameKey) && !(aliasNameKey && driverByNameKey.has(aliasNameKey))) {
      const driver = {
        _id: new mongoose.Types.ObjectId(),
        fullName: row.conducteur.trim().replace(/\s+/g, " "),
        nameKey: expectedNameKey,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      driverByNameKey.set(expectedNameKey, driver);
      missingDrivers.push(driver);
    }
  }

  const assignments = rows.map((row) => {
    const expectedNameKey = normalizeDriverKey(row.conducteur);
    const aliasNameKey = aliases.get(expectedNameKey);
    const driver = driverByNameKey.get(expectedNameKey) || driverByNameKey.get(aliasNameKey);
    return {
      _id: new mongoose.Types.ObjectId(),
      vehicle: vehicleByPlate.get(normalizePlate(row.immatriculation))._id,
      driver: driver._id,
      linkType: "current",
      startsAt: period.startsAt,
      endsAt: period.endsAt,
      createdAt: period.startsAt,
      updatedAt: period.endsAt,
    };
  });

  const currentVehicles = [...vehicleByPlate.values()].filter((vehicle) => !missingVehicles.includes(vehicle));
  const existingAssignments = await db.collection("vehicleDriverAssignments").find(
    {
      vehicle: { $in: currentVehicles.map((vehicle) => vehicle._id) },
      startsAt: period.startsAt,
      endsAt: period.endsAt,
      linkType: "current",
    },
    { projection: { vehicle: 1, driver: 1 } },
  ).toArray();
  const existingKeys = new Set(existingAssignments.map((assignment) => `${assignment.vehicle}:${assignment.driver}`));
  const assignmentsToInsert = assignments.filter((assignment) => !existingKeys.has(`${assignment.vehicle}:${assignment.driver}`));

  const summary = {
    assignmentsAlreadyPresent: assignments.length - assignmentsToInsert.length,
    assignmentsToInsert: assignmentsToInsert.length,
    driversToInsert: missingDrivers.length,
    vehiclesToInsert: missingVehicles.length,
  };
  if (dryRun) return summary;

  if (missingVehicles.length) await db.collection("vehicles").insertMany(missingVehicles, { ordered: true });
  if (missingDrivers.length) await db.collection("drivers").insertMany(missingDrivers, { ordered: true });
  if (assignmentsToInsert.length) await db.collection("vehicleDriverAssignments").insertMany(assignmentsToInsert, { ordered: true });
  return summary;
}

async function main() {
  if (!process.env.DB_URL) throw new Error("DB_URL est obligatoire.");
  await mongoose.connect(process.env.DB_URL);
  const summary = await importSchedule({ dryRun: process.argv.includes("--dry-run") });
  console.log(JSON.stringify(summary));
}

if (require.main === module) {
  main()
    .catch((error) => {
      console.error(error.message);
      process.exitCode = 1;
    })
    .finally(() => mongoose.disconnect());
}

module.exports = { importSchedule };
