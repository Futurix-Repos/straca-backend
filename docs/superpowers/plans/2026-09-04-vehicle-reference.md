# Vehicle Reference Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a backward-compatible vehicle, driver, prestataire, and site reference system to STRACA.

**Architecture:** Extend existing `Vehicle`, `Prestataire`, and `Location` documents; introduce standalone `Driver` and `VehicleDriverAssignment` collections. Centralize plate and driver-name normalization in a helper so API routes and database hooks apply identical uniqueness rules.

**Tech Stack:** Node.js, Express 4, Mongoose 8, Node built-in `node:test`.

**Spec:** `docs/superpowers/specs/2026-09-04-vehicle-reference-design.md`

## Global Constraints

- Preserve `Vehicle.registrationNumber`, `model`, `type`, `source`, `driver`, and `tracking` behavior.
- Store all timestamps as UTC `Date` values through Mongoose timestamps.
- Return `409` for normalized plate collisions and `404` for missing referenced entities.
- Do not physically delete vehicles, prestataires, or sites through the new API paths; set `isActive` or `status` instead.

---

### Task 1: Normalization helpers and unit tests

**Files:**
- Create: `helpers/referenceNormalization.js`
- Create: `test/referenceNormalization.test.js`
- Modify: `package.json`

**Interfaces:**
- Produces `normalizePlate(value: string): string`.
- Produces `normalizeDriverKey(value: string): string`.

- [ ] **Step 1: Write the failing normalization tests**

```js
test("normalizes plate spacing, hyphens and case", () => {
  assert.equal(normalizePlate(" bn-4062 rb "), "BN4062RB");
});

test("normalizes driver accents and repeated spaces", () => {
  assert.equal(normalizeDriverKey(" Aïnonkanton   Symphorien "), "AINONKANTON SYMPHORIEN");
});
```

- [ ] **Step 2: Run the tests to verify they fail because the helper is absent**

Run: `node --test test/referenceNormalization.test.js`

Expected: module resolution failure for `helpers/referenceNormalization.js`.

- [ ] **Step 3: Implement the two pure helper functions**

```js
function normalizePlate(value) {
  return value.trim().replace(/[\s-]+/g, "").toUpperCase();
}

function normalizeDriverKey(value) {
  return value.trim().replace(/\s+/g, " ").normalize("NFD")
    .replace(/\p{M}/gu, "").toUpperCase();
}
```

- [ ] **Step 4: Run normalization tests and the full test command**

Run: `node --test`

Expected: two passing tests and no failures.

- [ ] **Step 5: Commit the helper and tests**

```bash
git add helpers/referenceNormalization.js test/referenceNormalization.test.js package.json
git commit -m "feat: add vehicle reference normalization"
```

### Task 2: Reference Mongoose schemas and index tests

**Files:**
- Create: `models/driverModel.js`
- Create: `models/vehicleDriverAssignmentModel.js`
- Modify: `models/vehicleModel.js`
- Modify: `models/prestataireModel.js`
- Modify: `models/locationModel.js`
- Create: `test/referenceModels.test.js`

**Interfaces:**
- Produces models `Driver` and `VehicleDriverAssignment`.
- Adds `plateRaw`, `plateNormalized`, `prestataire`, `status`, `externalIds`, and `metadata` to `Vehicle`.

- [ ] **Step 1: Write failing schema tests**

```js
test("vehicle derives normalized plate from registrationNumber", () => {
  const vehicle = new Vehicle({ registrationNumber: "bn-4062 rb", model: id, type: id, source: id });
  assert.equal(vehicle.plateNormalized, "BN4062RB");
});

test("driver derives a unique nameKey", () => {
  const driver = new Driver({ fullName: "Aïnonkanton Symphorien" });
  assert.equal(driver.nameKey, "AINONKANTON SYMPHORIEN");
});
```

- [ ] **Step 2: Run the schema tests to verify they fail due to missing models or fields**

Run: `node --test test/referenceModels.test.js`

Expected: failure caused by missing `Driver` or missing normalized fields.

- [ ] **Step 3: Implement schemas, hooks and indexes**

Add `pre("validate")` normalization hooks to `Vehicle` and `Driver`; add the unique `plateNormalized` and `nameKey` indexes; add partial unique indexes on assignment `{ vehicle, linkType }`; add prestataire and location external-id/code indexes. Do not make new fields required for pre-existing documents.

- [ ] **Step 4: Run the schema and full test suite**

Run: `node --test`

Expected: all model and normalization tests pass.

- [ ] **Step 5: Commit reference schema changes**

```bash
git add models test/referenceModels.test.js
git commit -m "feat: add vehicle reference schemas"
```

### Task 3: Vehicle, driver, prestataire and site routes

**Files:**
- Create: `routes/drivers.js`
- Create: `routes/vehicleDriverAssignments.js`
- Modify: `routes/vehicle.js`
- Modify: `routes/prestataires.js`
- Modify: `routes/location.js`
- Modify: `app.js`
- Create: `test/referenceRoutes.test.js`

**Interfaces:**
- `PATCH /vehicles/:id/driver` accepts `{ fullName, linkType? }`.
- `GET /drivers?q=&page=&perPage=` lists drivers.
- `GET /vehicle-driver-assignments?vehicleId=` lists assignment history.

- [ ] **Step 1: Write failing route tests for plate conflict and driver replacement**

```js
test("vehicle creation returns 409 for an existing normalized plate", async () => {
  const response = await request(app).post("/vehicles").send({ plateNumber: "bn-4062-rb" });
  assert.equal(response.status, 409);
});

test("replacing a current driver closes the previous assignment", async () => {
  const response = await request(app).patch(`/vehicles/${vehicleId}/driver`).send({ fullName: "Jean Koffi" });
  assert.equal(response.status, 200);
  assert.equal(await currentAssignmentCount(vehicleId), 1);
});
```

- [ ] **Step 2: Run route tests to verify they fail because the endpoints are absent**

Run: `node --test test/referenceRoutes.test.js`

Expected: failing route assertions for missing endpoint behavior.

- [ ] **Step 3: Implement routes with validation and Mongoose transactions**

Use `findOneAndUpdate`/`updateOne` with `runValidators: true`; check referenced prestataires before vehicle writes; create drivers through `findOneAndUpdate({ nameKey }, { $setOnInsert: ... }, { upsert: true, new: true })`; close an existing current assignment before creating the replacement. Fall back to the same ordered writes when transaction startup is unavailable.

- [ ] **Step 4: Run route and full test suite**

Run: `node --test`

Expected: all route tests pass, including `409`, `404`, and current-assignment replacement cases.

- [ ] **Step 5: Commit API changes**

```bash
git add routes app.js test/referenceRoutes.test.js
git commit -m "feat: expose vehicle reference APIs"
```

### Task 4: Data migration and import verification

**Files:**
- Create: `scripts/migrateVehicleReference.js`
- Create: `test/migrateVehicleReference.test.js`
- Modify: `package.json`

**Interfaces:**
- `npm run migrate:vehicle-reference -- --dry-run` reports plate collisions without writing.
- `npm run migrate:vehicle-reference` backfills normalized fields and status.

- [ ] **Step 1: Write failing migration tests**

```js
test("migration reports normalized plate collisions without updating documents", async () => {
  const result = await migrateVehicles([{ registrationNumber: "BN 4062 RB" }, { registrationNumber: "bn-4062-rb" }], { dryRun: true });
  assert.deepEqual(result.collisions, ["BN4062RB"]);
});
```

- [ ] **Step 2: Run migration tests to verify they fail because the migration module is absent**

Run: `node --test test/migrateVehicleReference.test.js`

Expected: module resolution failure for `scripts/migrateVehicleReference.js`.

- [ ] **Step 3: Implement the dry-run-first migration**

For every existing vehicle, derive `plateRaw` from `plateRaw || registrationNumber`, derive `plateNormalized`, and default missing `status` to `verified`. Abort the write run if any normalized collision exists. Print the number scanned, updated and colliding. Never delete documents.

- [ ] **Step 4: Run migration unit tests and a dry run against the configured database**

Run: `node --test && npm run migrate:vehicle-reference -- --dry-run`

Expected: unit tests pass; the command prints a collision report or an explicit zero-collision result without modifying MongoDB.

- [ ] **Step 5: Commit migration tooling**

```bash
git add scripts/migrateVehicleReference.js test/migrateVehicleReference.test.js package.json
git commit -m "feat: add vehicle reference migration"
```
