const assert = require("node:assert/strict");
const test = require("node:test");

const { buildMigrationPlan } = require("../scripts/migrateVehicleReference");

test("reports normalized plate collisions without creating updates", () => {
  const result = buildMigrationPlan([
    { _id: "one", registrationNumber: "BN 4062 RB" },
    { _id: "two", registrationNumber: "bn-4062-rb" },
  ]);

  assert.deepEqual(result.collisions, ["BN4062RB"]);
  assert.equal(result.updates.length, 0);
});

test("builds a backfill update for a vehicle without reference fields", () => {
  const result = buildMigrationPlan([{ _id: "one", registrationNumber: "BN 4062 RB" }]);

  assert.deepEqual(result.collisions, []);
  assert.deepEqual(result.updates[0], {
    _id: "one",
    update: {
      plateRaw: "BN 4062 RB",
      plateNormalized: "BN4062RB",
      status: "verified",
    },
  });
});
