const assert = require("node:assert/strict");
const test = require("node:test");

const { _internals } = require("../services/deliveryTracking");
const { haversineKm, pathDistanceKm, tripWindow, isStale } = _internals;

test("haversineKm ~ distance connue (Cotonou → ~1 deg nord ≈ 111 km)", () => {
  const d = haversineKm({ lat: 6.36, lng: 2.42 }, { lat: 7.36, lng: 2.42 });
  assert.ok(d > 110 && d < 112, `attendu ~111, obtenu ${d}`);
});

test("haversineKm renvoie 0 si une coordonnée manque", () => {
  assert.equal(haversineKm({ lat: null, lng: 2 }, { lat: 6, lng: 2 }), 0);
});

test("pathDistanceKm somme les segments", () => {
  const pts = [
    { lat: 6.36, lng: 2.42 },
    { lat: 6.37, lng: 2.42 },
    { lat: 6.38, lng: 2.42 },
  ];
  const d = pathDistanceKm(pts);
  assert.ok(d > 2 && d < 2.5, `obtenu ${d}`);
});

test("tripWindow: voyage en cours → fin ~ maintenant", () => {
  const start = new Date("2026-10-22T08:00:00Z");
  const { from, to } = tripWindow({ startedAt: start, status: "IN_PROGRESS" });
  assert.equal(new Date(from).toISOString(), start.toISOString());
  assert.ok(Date.now() - new Date(to).getTime() < 5000);
});

test("tripWindow: utilise le snapshot d'arrivée si présent", () => {
  const start = new Date("2026-10-22T08:00:00Z");
  const arrivedAt = new Date("2026-10-22T10:30:00Z");
  const { to } = tripWindow({
    startedAt: start,
    status: "DELIVERED",
    tracking: { arrival: { at: arrivedAt } },
  });
  assert.equal(new Date(to).toISOString(), arrivedAt.toISOString());
});

test("isStale vrai pour une date ancienne, faux pour une récente", () => {
  assert.equal(isStale("2026-08-19T11:47:31Z"), true);
  assert.equal(isStale(new Date().toISOString()), false);
});
