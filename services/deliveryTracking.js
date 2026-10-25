// services/deliveryTracking.js
//
// Service métier : relie une livraison (voyage) à son provider de tracking.
// Ne connaît ni le HTTP ni un provider en particulier : il résout le provider via
// services/tracking/registry et appelle l'interface commune. Expose :
//   - capture des snapshots carburant/position au départ et à l'arrivée
//   - lecture à la demande du trajet (historique) et des événements carburant
//
// Toutes les captures sont best-effort : une panne provider ne doit jamais
// casser le flux métier (création / réception d'un voyage).

const Vehicle = require("../models/vehicleModel");
const {
  getProvider,
  DEFAULT_PROVIDER_KEY,
} = require("./tracking/registry");

// Au-delà de ce délai sans remontée, la dernière position est jugée périmée.
const STALE_THRESHOLD_MS = 60 * 60 * 1000; // 1 h

/// Résout { key, provider, deviceId } d'une livraison : provider/device figés sur
/// la livraison en priorité, sinon via le véhicule rattaché. provider est null si
/// la clé est inconnue ; deviceId est null si aucun device n'est mappé.
async function resolveDeviceAndProvider(delivery) {
  let key = delivery?.tracking?.provider || null;
  let deviceId = delivery?.tracking?.deviceId || null;

  if (!deviceId) {
    const vehicleRef = delivery?.vehicle;
    // vehicle peut être un ObjectId ou un document peuplé.
    let tracking = vehicleRef?.tracking || null;
    if (!tracking && vehicleRef) {
      const vehicleId = vehicleRef?._id || vehicleRef;
      const vehicle = await Vehicle.findById(vehicleId).select("tracking");
      tracking = vehicle?.tracking || null;
    }
    deviceId = tracking?.deviceId || null;
    key = key || tracking?.provider || null;
  }

  key = key || DEFAULT_PROVIDER_KEY;
  return { key, provider: getProvider(key), deviceId };
}

function isStale(dateValue) {
  const ts = new Date(dateValue).getTime();
  if (!Number.isFinite(ts)) return true;
  return Date.now() - ts > STALE_THRESHOLD_MS;
}

/// Construit un snapshot {at, lat, lng, fuelLevel, source} via un provider.
/// Best-effort : renvoie toujours un objet, source="unavailable" si échec.
async function captureSnapshot(provider, deviceId) {
  const at = new Date();
  if (!provider || !deviceId) {
    return { at, lat: null, lng: null, fuelLevel: null, source: "unavailable" };
  }
  try {
    const pos = await provider.latest(deviceId);
    if (!pos) {
      return { at, lat: null, lng: null, fuelLevel: null, source: "unavailable" };
    }
    return {
      at,
      lat: pos.lat,
      lng: pos.lng,
      fuelLevel: pos.fuelLevel,
      source: `${provider.key}.latest`,
    };
  } catch (e) {
    console.warn(
      `[deliveryTracking] snapshot échoué pour ${deviceId}: ${e.message}`,
    );
    return { at, lat: null, lng: null, fuelLevel: null, source: "unavailable" };
  }
}

/// Mute delivery.tracking.departure (et fige provider + deviceId). Ne sauvegarde
/// pas : l'appelant persiste la livraison. Ne jette jamais.
async function attachDepartureSnapshot(delivery) {
  try {
    const { key, provider, deviceId } = await resolveDeviceAndProvider(delivery);
    const snapshot = await captureSnapshot(provider, deviceId);
    delivery.tracking = {
      ...(delivery.tracking?.toObject?.() || delivery.tracking || {}),
      provider: key || delivery.tracking?.provider || null,
      deviceId: deviceId || delivery.tracking?.deviceId || null,
      departure: snapshot,
    };
  } catch (e) {
    console.warn(`[deliveryTracking] attachDeparture échoué: ${e.message}`);
  }
  return delivery;
}

/// Mute delivery.tracking.arrival. Ne sauvegarde pas. Ne jette jamais.
async function attachArrivalSnapshot(delivery) {
  try {
    const { key, provider, deviceId } = await resolveDeviceAndProvider(delivery);
    const snapshot = await captureSnapshot(provider, deviceId);
    delivery.tracking = {
      ...(delivery.tracking?.toObject?.() || delivery.tracking || {}),
      provider: key || delivery.tracking?.provider || null,
      deviceId: deviceId || delivery.tracking?.deviceId || null,
      arrival: snapshot,
    };
  } catch (e) {
    console.warn(`[deliveryTracking] attachArrival échoué: ${e.message}`);
  }
  return delivery;
}

/// Fenêtre temporelle du voyage : du départ (startedAt) à l'arrivée connue,
/// sinon jusqu'à maintenant (voyage en cours).
function tripWindow(delivery) {
  const from = delivery.startedAt || delivery.createdAt;
  const to =
    delivery.tracking?.arrival?.at ||
    delivery.receiver?.receivedAt ||
    (delivery.status === "IN_PROGRESS" ? new Date() : delivery.updatedAt) ||
    new Date();
  return { from, to };
}

/// Distance haversine (km) entre deux points {lat,lng}.
function haversineKm(a, b) {
  if (a?.lat == null || a?.lng == null || b?.lat == null || b?.lng == null) return 0;
  const R = 6371;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

function pathDistanceKm(points) {
  let total = 0;
  for (let i = 1; i < points.length; i += 1) total += haversineKm(points[i - 1], points[i]);
  return Math.round(total * 100) / 100;
}

/// Trajet à la demande : points GPS + distance. Objet {available, ...}.
async function getDeliveryTrip(delivery, { maxPoints = 2000 } = {}) {
  const { key, provider, deviceId } = await resolveDeviceAndProvider(delivery);
  if (!deviceId) return { available: false, reason: "no_device_mapped" };
  if (!provider) return { available: false, reason: "unknown_provider", provider: key };
  if (!provider.capabilities.history) {
    return { available: false, reason: "unsupported", provider: key };
  }

  const { from, to } = tripWindow(delivery);
  const points = await provider.historyRange(deviceId, from, to, { maxPoints });
  return {
    available: true,
    provider: key,
    deviceId,
    from,
    to,
    pointCount: points.length,
    distanceKm: pathDistanceKm(points),
    path: points.map((p) => ({
      lat: p.lat,
      lng: p.lng,
      date: p.date,
      speed: p.speed,
      fuelLevel: p.fuelLevel,
    })),
  };
}

/// Événements carburant (refueling / levy) sur la période du voyage.
async function getDeliveryFuelEvents(delivery) {
  const { key, provider, deviceId } = await resolveDeviceAndProvider(delivery);
  if (!deviceId) return { available: false, reason: "no_device_mapped" };
  if (!provider) return { available: false, reason: "unknown_provider", provider: key };
  if (!provider.capabilities.fuelEvents) {
    return { available: false, reason: "unsupported", provider: key };
  }

  const { from, to } = tripWindow(delivery);
  const toDate = (d) => new Date(d).toISOString().slice(0, 10);
  const events = await provider.events(deviceId, toDate(from), toDate(to));
  const sumBy = (type) =>
    events
      .filter((e) => e.type === type)
      .reduce((acc, e) => acc + (Number(e.value) || 0), 0);
  return {
    available: true,
    provider: key,
    deviceId,
    events,
    refueledTotal: sumBy("refueling"),
    leviedTotal: sumBy("levy"),
  };
}

/// Résumé léger : snapshots stockés + distance + événements + conso estimée.
async function getDeliverySummary(delivery, { maxPoints = 1000 } = {}) {
  const { key, provider, deviceId } = await resolveDeviceAndProvider(delivery);
  if (!deviceId) return { available: false, reason: "no_device_mapped" };
  if (!provider) return { available: false, reason: "unknown_provider", provider: key };

  const departure = delivery.tracking?.departure || null;
  const arrival = delivery.tracking?.arrival || null;

  const [trip, fuel] = await Promise.all([
    getDeliveryTrip(delivery, { maxPoints }).catch((e) => ({
      available: false,
      error: e.message,
    })),
    getDeliveryFuelEvents(delivery).catch((e) => ({
      available: false,
      error: e.message,
    })),
  ]);

  // Conso estimée = (carburant départ + ravitaillé) − (carburant arrivée + prélevé)
  let fuelConsumedEstimate = null;
  if (
    departure?.fuelLevel != null &&
    arrival?.fuelLevel != null &&
    fuel.available
  ) {
    fuelConsumedEstimate =
      departure.fuelLevel +
      (fuel.refueledTotal || 0) -
      arrival.fuelLevel -
      (fuel.leviedTotal || 0);
  }

  // Dernière position pour signaler un device muet. date peut être absente selon
  // le provider (ex. Wialon) → on ne peut pas juger la péremption.
  let stale = null;
  try {
    const live = await provider.latest(deviceId);
    stale = live ? (live.date ? isStale(live.date) : null) : true;
  } catch (_e) {
    stale = null;
  }

  return {
    available: true,
    provider: key,
    deviceId,
    stale,
    departure,
    arrival,
    distanceKm: trip.available ? trip.distanceKm : null,
    pointCount: trip.available ? trip.pointCount : null,
    fuelEvents: fuel.available ? fuel.events : [],
    refueledTotal: fuel.available ? fuel.refueledTotal : null,
    leviedTotal: fuel.available ? fuel.leviedTotal : null,
    fuelConsumedEstimate,
  };
}

module.exports = {
  resolveDeviceAndProvider,
  captureSnapshot,
  attachDepartureSnapshot,
  attachArrivalSnapshot,
  getDeliveryTrip,
  getDeliveryFuelEvents,
  getDeliverySummary,
  _internals: { haversineKm, pathDistanceKm, tripWindow, isStale },
};
