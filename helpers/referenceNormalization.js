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

/// Clé de rapprochement pour les noms d'engins trackfuel (`nom_engin`), qui
/// utilisent des séparateurs variés (`BR_9855RB`, `BF_4584E.303`) là où nos
/// plaques normalisées ne gardent que l'alphanumérique (`BR9855RB`). On retire
/// donc TOUT caractère non alphanumérique pour comparer au `plateNormalized`.
/// Renvoie `null` si l'entrée ne contient aucun caractère alphanumérique.
function normalizeTrackerName(value) {
  if (typeof value !== "string") return null;
  const key = value
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^a-z0-9]/gi, "")
    .toUpperCase();
  return key.length > 0 ? key : null;
}

module.exports = {
  normalizeDriverKey,
  normalizePlate,
  normalizeTrackerName,
};
