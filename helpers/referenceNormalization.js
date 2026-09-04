function requireText(value, fieldName) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new TypeError(`${fieldName} est obligatoire.`);
  }

  return value.trim();
}

function normalizePlate(value) {
  return requireText(value, "La plaque")
    .replace(/[\s-]+/g, "")
    .toUpperCase();
}

function normalizeDriverKey(value) {
  return requireText(value, "Le nom du chauffeur")
    .replace(/\s+/g, " ")
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toUpperCase();
}

module.exports = {
  normalizeDriverKey,
  normalizePlate,
};
