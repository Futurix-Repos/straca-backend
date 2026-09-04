const fs = require("fs");
const path = require("path");
const { normalizeDriverKey, normalizePlate } = require("../helpers/referenceNormalization");

const inputDirectory = "/Users/futurix/Downloads";
const outputDirectory = path.resolve(__dirname, "../imports/reference");

const files = {
  assignments: "vehicle_drivers_rows.csv",
  drivers: "drivers_rows.csv",
  prestataires: "prestataires_rows.csv",
  sites: "sites_rows.csv",
  vehicles: "vehicles_rows.csv",
};

const defaultReferences = {
  model: "679ca8fad2726f1975815dcf",
  source: "679ca925d2726f1975815dea",
  type: "67851a82adf7802231d9278e",
};

function parseCsv(content) {
  const rows = [];
  let row = [];
  let value = "";
  let quoted = false;

  for (let index = 0; index < content.length; index += 1) {
    const character = content[index];
    if (character === '"') {
      if (quoted && content[index + 1] === '"') {
        value += '"';
        index += 1;
      } else quoted = !quoted;
    } else if (character === "," && !quoted) {
      row.push(value);
      value = "";
    } else if ((character === "\n" || character === "\r") && !quoted) {
      if (character === "\r" && content[index + 1] === "\n") index += 1;
      row.push(value);
      if (row.some((cell) => cell !== "")) rows.push(row);
      row = [];
      value = "";
    } else value += character;
  }

  if (value || row.length > 0) {
    row.push(value);
    rows.push(row);
  }

  const [headers, ...records] = rows;
  return records.map((record) => Object.fromEntries(headers.map((header, index) => [header, record[index] ?? ""])));
}

function readCsv(filename) {
  return parseCsv(fs.readFileSync(path.join(inputDirectory, filename), "utf8"));
}

function objectId(prefix, legacyId) {
  return `${prefix}${Number.parseInt(legacyId, 10).toString(16).padStart(6, "0")}`;
}

function objectIdValue(value) {
  return { $oid: value };
}

function dateValue(value) {
  const isoValue = value.replace(" ", "T").replace(/\+00$/, "Z");
  const date = new Date(isoValue);
  if (Number.isNaN(date.getTime())) throw new TypeError(`Date invalide : ${value}`);
  return { $date: date.toISOString() };
}

function emptyToNull(value) {
  return value === "" ? null : value;
}

function parseMetadata(value) {
  return value ? JSON.parse(value) : {};
}

function writeJson(filename, documents) {
  fs.writeFileSync(path.join(outputDirectory, filename), `${JSON.stringify(documents, null, 2)}\n`);
}

function main() {
  const prestataireRows = readCsv(files.prestataires);
  const vehicleRows = readCsv(files.vehicles);
  const driverRows = readCsv(files.drivers);
  const assignmentRows = readCsv(files.assignments);
  const siteRows = readCsv(files.sites);

  const prestataireIds = new Set(prestataireRows.map((row) => row.id));
  const vehicleIds = new Set(vehicleRows.map((row) => row.id));
  const driverIds = new Set(driverRows.map((row) => row.id));
  const missingPrestataires = vehicleRows.filter((row) => row.prestataire_id && !prestataireIds.has(row.prestataire_id));
  const invalidAssignments = assignmentRows.filter((row) => !vehicleIds.has(row.vehicle_id) || !driverIds.has(row.driver_id));

  if (missingPrestataires.length > 0) {
    throw new Error(`Références invalides : ${missingPrestataires.length} prestataire(s).`);
  }

  const prestataires = prestataireRows.map((row) => ({
    _id: objectIdValue(objectId("710000000000000000", row.id)),
    name: row.name,
    type: emptyToNull(row.type),
    zone: emptyToNull(row.zone),
    ifu: emptyToNull(row.ifu),
    rccm: emptyToNull(row.rccm),
    phone: emptyToNull(row.phone),
    email: emptyToNull(row.email),
    address: emptyToNull(row.address),
    isActive: row.is_active === "true",
    odooId: row.odoo_id === "" ? null : Number(row.odoo_id),
    externalIds: {
      legacyId: Number(row.id),
      ...(row.odoo_id === "" ? {} : { odoo: Number(row.odoo_id) }),
    },
    createdAt: dateValue(row.created_at),
    updatedAt: dateValue(row.updated_at),
  }));

  const vehicles = vehicleRows.map((row) => {
    const metadata = parseMetadata(row.metadata);
    return {
      _id: objectIdValue(objectId("720000000000000000", row.id)),
      registrationNumber: row.plate_raw,
      plateRaw: row.plate_raw,
      plateNormalized: normalizePlate(row.plate_raw),
      model: objectIdValue(defaultReferences.model),
      type: objectIdValue(defaultReferences.type),
      source: objectIdValue(defaultReferences.source),
      prestataire: row.prestataire_id ? objectIdValue(objectId("710000000000000000", row.prestataire_id)) : null,
      status: row.status,
      externalIds: {
        legacyId: Number(row.id),
        ...(row.odoo_id === "" ? {} : { odoo: Number(row.odoo_id) }),
      },
      metadata: {
        ...metadata,
        legacyVehicleCategoryId: row.vehicle_category_id === "" ? null : Number(row.vehicle_category_id),
        vehicleKind: emptyToNull(row.vehicle_kind),
        modelName: emptyToNull(row.model_name),
      },
      createdAt: dateValue(row.created_at),
      updatedAt: dateValue(row.updated_at),
    };
  });

  const drivers = driverRows.map((row) => ({
    _id: objectIdValue(objectId("730000000000000000", row.id)),
    fullName: row.full_name.trim().replace(/\s+/g, " "),
    nameKey: normalizeDriverKey(row.full_name),
    isActive: true,
    createdAt: dateValue(row.created_at),
    updatedAt: dateValue(row.updated_at),
  }));

  const vehicleDriverAssignments = assignmentRows
    .filter((row) => vehicleIds.has(row.vehicle_id) && driverIds.has(row.driver_id))
    .map((row) => ({
    _id: objectIdValue(objectId("740000000000000000", row.id)),
    vehicle: objectIdValue(objectId("720000000000000000", row.vehicle_id)),
    driver: objectIdValue(objectId("730000000000000000", row.driver_id)),
    linkType: row.driver_link_type,
    startsAt: dateValue(row.created_at),
    endsAt: null,
    createdAt: dateValue(row.created_at),
    updatedAt: dateValue(row.updated_at),
    }));

  const unresolvedAssignments = invalidAssignments.map((row) => ({
    legacyAssignmentId: Number(row.id),
    legacyVehicleId: Number(row.vehicle_id),
    legacyDriverId: Number(row.driver_id),
    driverLinkType: row.driver_link_type,
    createdAt: dateValue(row.created_at),
    updatedAt: dateValue(row.updated_at),
    reason: vehicleIds.has(row.vehicle_id)
      ? "Chauffeur absent de drivers_rows.csv"
      : "Véhicule absent de vehicles_rows.csv",
  }));

  const sites = siteRows.map((row) => ({
    _id: objectIdValue(objectId("750000000000000000", row.id)),
    label: row.name,
    description: "Référentiel de site importé.",
    code: emptyToNull(row.code),
    isActive: true,
    externalIds: {
      legacyId: Number(row.id),
      ...(row.odoo_id === "" ? {} : { odoo: Number(row.odoo_id) }),
    },
    createdAt: dateValue(row.created_at),
    updatedAt: dateValue(row.updated_at),
  }));

  writeJson("prestataires.json", prestataires);
  writeJson("vehicles.json", vehicles);
  writeJson("drivers.json", drivers);
  writeJson("vehicleDriverAssignments.json", vehicleDriverAssignments);
  writeJson("vehicleDriverAssignments_unresolved.json", unresolvedAssignments);
  writeJson("sites.json", sites);
  writeJson("manifest.json", {
    collectionOrder: ["prestataires", "vehicles", "drivers", "vehicleDriverAssignments", "locations"],
    counts: {
      prestataires: prestataires.length,
      vehicles: vehicles.length,
      drivers: drivers.length,
      vehicleDriverAssignments: vehicleDriverAssignments.length,
      unresolvedVehicleDriverAssignments: unresolvedAssignments.length,
      locations: sites.length,
    },
    defaultVehicleReferences: defaultReferences,
  });

  console.log(JSON.stringify({
    prestataires: prestataires.length,
    vehicles: vehicles.length,
    drivers: drivers.length,
    vehicleDriverAssignments: vehicleDriverAssignments.length,
    unresolvedVehicleDriverAssignments: unresolvedAssignments.length,
    sites: sites.length,
  }));
}

main();
