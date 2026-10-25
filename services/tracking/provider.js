// services/tracking/provider.js
//
// Contrat commun à tous les providers de tracking. Chaque provider expose :
//   key          : identifiant stable ('trackfuel', 'wialon', ...)
//   capabilities : { position, history, fuel, fuelEvents, temperature }
//   latest(deviceId)                       -> position canonique | null
//   historyRange(deviceId, from, to, opts) -> points[]   (UNSUPPORTED si pas de capacité)
//   events(deviceId, start, end, type?)    -> events[]    (UNSUPPORTED si pas de capacité)
//   listTrackers()                         -> [{ deviceId, name }]
//
// Position canonique (format stable, indépendant du provider) :
//   { deviceId, vehicle, date, lat, lng, ignitionOn, speed, fuelLevel,
//     temperature, pinImg }
//
// Convention « non supporté » : une capacité absente renvoie UNSUPPORTED (objet
// gelé) au lieu de jeter. Les services le remontent tel quel sous la forme
// { available: false, reason: 'unsupported' }.

const UNSUPPORTED = Object.freeze({ available: false, reason: "unsupported" });

/// Forme par défaut des capacités (tout à false). Un provider surcharge ce qu'il
/// sait faire.
const NO_CAPABILITIES = Object.freeze({
  position: false,
  history: false,
  fuel: false,
  fuelEvents: false,
  temperature: false,
});

/// Déclare les capacités d'un provider en complétant les manquantes à false.
function capabilities(overrides = {}) {
  return { ...NO_CAPABILITIES, ...overrides };
}

/// true si le provider déclare la capacité demandée.
function supports(provider, capability) {
  return Boolean(provider?.capabilities?.[capability]);
}

module.exports = { UNSUPPORTED, NO_CAPABILITIES, capabilities, supports };
