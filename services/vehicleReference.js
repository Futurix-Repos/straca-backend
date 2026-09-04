const { normalizePlate } = require("../helpers/referenceNormalization");

function prepareVehiclePayload(body = {}) {
  const payload = { ...body };
  const plate = payload.plateRaw || payload.plateNumber || payload.registrationNumber;

  delete payload.plateNumber;

  if (!plate) return payload;

  payload.plateRaw = plate.trim();
  payload.registrationNumber = payload.plateRaw;
  payload.plateNormalized = normalizePlate(payload.plateRaw);

  return payload;
}

function paginationFromQuery(query = {}) {
  const page = Math.max(Number.parseInt(query.page, 10) || 1, 1);
  const limit = Math.min(Math.max(Number.parseInt(query.perPage, 10) || 25, 1), 100);

  return { page, limit, skip: (page - 1) * limit };
}

function isDuplicateKeyError(error) {
  return error && error.code === 11000;
}

module.exports = {
  isDuplicateKeyError,
  paginationFromQuery,
  prepareVehiclePayload,
};
