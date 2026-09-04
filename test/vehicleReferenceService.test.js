const assert = require("node:assert/strict");
const test = require("node:test");

const {
  prepareVehiclePayload,
  paginationFromQuery,
} = require("../services/vehicleReference");

test("prepares a vehicle payload from plateNumber", () => {
  const payload = prepareVehiclePayload({ plateNumber: " bn-4062 rb " });

  assert.equal(payload.plateRaw, "bn-4062 rb");
  assert.equal(payload.registrationNumber, "bn-4062 rb");
  assert.equal(payload.plateNormalized, "BN4062RB");
  assert.equal(payload.plateNumber, undefined);
});

test("caps pagination values used by reference lists", () => {
  assert.deepEqual(paginationFromQuery({ page: "3", perPage: "500" }), {
    limit: 100,
    page: 3,
    skip: 200,
  });
});
