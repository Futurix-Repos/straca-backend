const assert = require("node:assert/strict");
const test = require("node:test");

const {
  getProvider,
  resolveVehicleProvider,
  DEFAULT_PROVIDER_KEY,
} = require("../services/tracking/registry");
const { UNSUPPORTED, capabilities, supports } = require("../services/tracking/provider");
const { trackfuelProvider } = require("../services/tracking/trackfuelProvider");
const { wialonProvider } = require("../services/tracking/wialonProvider");

test("getProvider renvoie les providers connus et null sinon", () => {
  assert.equal(getProvider("trackfuel"), trackfuelProvider);
  assert.equal(getProvider("wialon"), wialonProvider);
  assert.equal(getProvider("inconnu"), null);
  assert.equal(getProvider(undefined), null);
});

test("resolveVehicleProvider lit provider + deviceId du véhicule", () => {
  const r = resolveVehicleProvider({
    tracking: { provider: "trackfuel", deviceId: "868373077062026" },
  });
  assert.equal(r.key, "trackfuel");
  assert.equal(r.provider, trackfuelProvider);
  assert.equal(r.deviceId, "868373077062026");
});

test("resolveVehicleProvider applique le provider par défaut quand absent", () => {
  const r = resolveVehicleProvider({ tracking: { deviceId: "123" } });
  assert.equal(r.key, DEFAULT_PROVIDER_KEY);
  assert.equal(r.provider, trackfuelProvider);
  assert.equal(r.deviceId, "123");
});

test("resolveVehicleProvider renvoie provider=null si la clé est inconnue", () => {
  const r = resolveVehicleProvider({ tracking: { provider: "garmin", deviceId: "x" } });
  assert.equal(r.key, "garmin");
  assert.equal(r.provider, null);
});

test("resolveVehicleProvider sans device → deviceId null", () => {
  const r = resolveVehicleProvider({ tracking: {} });
  assert.equal(r.deviceId, null);
  assert.equal(r.provider, trackfuelProvider);
});

test("capabilities complète les manquantes à false", () => {
  const caps = capabilities({ position: true });
  assert.equal(caps.position, true);
  assert.equal(caps.history, false);
  assert.equal(caps.fuel, false);
  assert.equal(caps.fuelEvents, false);
  assert.equal(caps.temperature, false);
});

test("supports lit la capacité déclarée", () => {
  assert.equal(supports(trackfuelProvider, "fuelEvents"), true);
  assert.equal(supports(wialonProvider, "fuelEvents"), false);
  assert.equal(supports(wialonProvider, "temperature"), true);
  assert.equal(supports(null, "position"), false);
});

test("capacités déclarées par provider", () => {
  assert.deepEqual(trackfuelProvider.capabilities, {
    position: true,
    history: true,
    fuel: true,
    fuelEvents: true,
    temperature: false,
  });
  assert.deepEqual(wialonProvider.capabilities, {
    position: true,
    history: false,
    fuel: true,
    fuelEvents: false,
    temperature: true,
  });
});

test("Wialon : history et events renvoient UNSUPPORTED", async () => {
  assert.deepEqual(await wialonProvider.historyRange("x", 0, 1), UNSUPPORTED);
  assert.deepEqual(await wialonProvider.events("x", 0, 1), UNSUPPORTED);
});

test("Wialon toCanonicalPosition mappe l'item vers le format commun", () => {
  const pos = wialonProvider._internals.toCanonicalPosition({
    id: 12345,
    nm: "BR 9855 RB",
    pos: { y: 6.39, x: 2.25, s: 42 },
    prms: { io_239: { v: 1 }, io_26: { v: 3 } },
    uri: "/avl_library_image/x.png",
  });
  assert.equal(pos.deviceId, "12345");
  assert.equal(pos.lat, 6.39);
  assert.equal(pos.lng, 2.25);
  assert.equal(pos.speed, 42);
  assert.equal(pos.ignitionOn, true);
  assert.equal(pos.temperature, 30);
  assert.equal(pos.pinImg, "https://hst-api.wialon.eu/avl_library_image/x.png");
});
