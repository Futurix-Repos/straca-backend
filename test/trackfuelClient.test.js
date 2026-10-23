const assert = require("node:assert/strict");
const test = require("node:test");

const { _internals } = require("../services/trackfuel/client");
const {
  toCoordinate,
  normalizePosition,
  normalizeTracker,
  normalizeEvent,
  bodyError,
  eachDay,
  subsample,
} = _internals;

test("toCoordinate garde les décimaux et ramène les entiers bruts (÷1e7)", () => {
  assert.equal(toCoordinate(6.388726), 6.388726);
  assert.equal(toCoordinate(63885340), 6.388534);
  assert.equal(toCoordinate(null), null);
  assert.equal(toCoordinate("not-a-number"), null);
});

test("normalizePosition absorbe le format /trackers/latest", () => {
  const out = normalizePosition({
    id: "868373077062026",
    vehicle: "BR_9855RB",
    date: "2026-08-19T11:47:31",
    latitude: 6.388726,
    longitude: 2.255124,
    ignitionon: 0,
    speed: 0,
    batteryvoltage: 4,
    fuellevel: 397,
    temperature: 0,
  });
  assert.equal(out.imei, "868373077062026");
  assert.equal(out.vehicle, "BR_9855RB");
  assert.equal(out.lat, 6.388726);
  assert.equal(out.lng, 2.255124);
  assert.equal(out.ignitionOn, false);
  assert.equal(out.fuelLevel, 397);
});

test("normalizeTracker absorbe id_engin/nom_engin", () => {
  assert.deepEqual(normalizeTracker({ id_engin: "123", nom_engin: "BF_0257D203" }), {
    imei: "123",
    name: "BF_0257D203",
  });
});

test("normalizeEvent absorbe idtracker/vehiclename", () => {
  const out = normalizeEvent({
    date: "2026-10-02T12:12:59",
    idtracker: "863911060999228",
    type: "refueling",
    value: 297,
    vehiclename: "BF_0257D203",
  });
  assert.equal(out.imei, "863911060999228");
  assert.equal(out.vehicle, "BF_0257D203");
  assert.equal(out.type, "refueling");
  assert.equal(out.value, 297);
});

test("bodyError détecte une erreur body-level sur HTTP 200", () => {
  assert.ok(bodyError({ message: "invalid Choice", status_code: 422 }));
  assert.equal(bodyError({ access_token: "x" }), null);
  assert.equal(bodyError([{ a: 1 }]), null);
});

test("eachDay couvre les jours inclus", () => {
  assert.deepEqual(eachDay("2026-03-01T10:00:00Z", "2026-03-03T05:00:00Z"), [
    "2026-03-01",
    "2026-03-02",
    "2026-03-03",
  ]);
});

test("subsample conserve premier et dernier et borne la taille", () => {
  const arr = Array.from({ length: 100 }, (_, i) => i);
  const out = subsample(arr, 10);
  assert.equal(out.length, 10);
  assert.equal(out[0], 0);
  assert.equal(out[out.length - 1], 99);
  // en-dessous du seuil : inchangé
  assert.deepEqual(subsample([1, 2, 3], 10), [1, 2, 3]);
});
