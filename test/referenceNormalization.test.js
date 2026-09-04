const assert = require("node:assert/strict");
const test = require("node:test");

const {
  normalizeDriverKey,
  normalizePlate,
} = require("../helpers/referenceNormalization");

test("normalizes plate spacing, hyphens and case", () => {
  assert.equal(normalizePlate(" bn-4062 rb "), "BN4062RB");
});

test("normalizes driver accents and repeated spaces", () => {
  assert.equal(
    normalizeDriverKey(" Aïnonkanton   Symphorien "),
    "AINONKANTON SYMPHORIEN",
  );
});

test("rejects an empty plate", () => {
  assert.throws(() => normalizePlate("   "), /plaque/i);
});
