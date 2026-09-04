const assert = require("node:assert/strict");
const test = require("node:test");
const mongoose = require("mongoose");

const Vehicle = require("../models/vehicleModel");
const Driver = require("../models/driverModel");
const VehicleDriverAssignment = require("../models/vehicleDriverAssignmentModel");

const objectId = new mongoose.Types.ObjectId();

test("vehicle derives raw and normalized plates before validation", async () => {
  const vehicle = new Vehicle({
    registrationNumber: " bn-4062 rb ",
    model: objectId,
    type: objectId,
  });

  await assert.rejects(vehicle.validate(), /source/);
  assert.equal(vehicle.plateRaw, "bn-4062 rb");
  assert.equal(vehicle.plateNormalized, "BN4062RB");
  assert.equal(vehicle.status, "verified");
});

test("driver derives a normalized unique key", async () => {
  const driver = new Driver({ fullName: "Aïnonkanton Symphorien" });
  await driver.validate();
  assert.equal(driver.nameKey, "AINONKANTON SYMPHORIEN");
  assert.equal(driver.isActive, true);
});

test("assignment exposes partial uniqueness indexes for current and future drivers", () => {
  const indexes = VehicleDriverAssignment.schema.indexes();
  assert.ok(indexes.some(([keys, options]) => keys.vehicle === 1 && options.unique));
});
