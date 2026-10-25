// services/tracking/registry.js
//
// Registre des providers de tracking. Point d'entrée unique pour résoudre le
// provider actif d'un véhicule / d'une livraison à partir de sa clé
// (vehicle.tracking.provider). Ajouter un provider = l'importer et l'enregistrer
// dans PROVIDERS ; aucun autre fichier métier ne connaît les providers en dur.

const { trackfuelProvider } = require("./trackfuelProvider");
const { wialonProvider } = require("./wialonProvider");

const DEFAULT_PROVIDER_KEY = "trackfuel";

const PROVIDERS = {
  [trackfuelProvider.key]: trackfuelProvider,
  [wialonProvider.key]: wialonProvider,
};

/// Instance provider pour une clé. null si la clé est inconnue.
function getProvider(key) {
  return PROVIDERS[key] || null;
}

/// Résout { key, provider, deviceId } depuis le bloc tracking d'un véhicule
/// (document Mongoose ou objet peuplé). provider est null si la clé est inconnue ;
/// deviceId est null si aucun device n'est mappé.
function resolveVehicleProvider(vehicle) {
  const tracking = vehicle?.tracking || {};
  const key = tracking.provider || DEFAULT_PROVIDER_KEY;
  return { key, provider: getProvider(key), deviceId: tracking.deviceId || null };
}

module.exports = {
  PROVIDERS,
  DEFAULT_PROVIDER_KEY,
  getProvider,
  resolveVehicleProvider,
};
