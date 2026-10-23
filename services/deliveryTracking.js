// services/deliveryTracking.js
//
// Service métier : relie une livraison (voyage) à son tracker trackfuel.
// Ne connaît pas le HTTP (délégué à services/trackfuel/client). Expose :
//   - capture des snapshots carburant/position au départ et à l'arrivée
//   - lecture à la demande du trajet (/history) et des événements (/events)
//
// Toutes les captures sont best-effort : une panne trackfuel ne doit jamais
// casser le flux métier (création / réception d'un voyage).

const Vehicle = require("../models/vehicleModel");
const { trackfuelClient } = require("./trackfuel/client");

// Au-delà de ce délai sans remontée, la dernière position est jugée périmée.
const STALE_THRESHOLD_MS = 60 * 60 * 1000; // 1 h

/// Retrouve l'IMEI tracker d'une livraison : d'abord figé sur la livraison
/// (tracking.trackerImei), sinon via le véhicule rattaché.
async function resolveTrackerImei(delivery) {
  if (delivery?.tracking?.trackerImei) return delivery.tracking.trackerImei;

  const vehicleRef = delivery?.vehicle;
  if (!vehicleRef) return null;

  // vehicle peut être un ObjectId ou un document peuplé.
  const imeiFromPopulated = vehicleRef?.tracking?.trackerImei;
  if (imeiFromPopulated) return imeiFromPopulated;

  const vehicleId = vehicleRef?._id || vehicleRef;
  const vehicle = await Vehicle.findById(vehicleId).select("tracking");
  return vehicle?.tracking?.trackerImei || null;
}

function isStale(dateValue) {
  const ts = new Date(dateValue).getTime();
  if (!Number.isFinite(ts)) return true;
  return Date.now() - ts > STALE_THRESHOLD_MS;
}

/// Construit un snapshot {at, lat, lng, fuelLevel, source} pour un IMEI.
/// Best-effort : renvoie toujours un objet, source="unavailable" si échec.
async function captureSnapshot(imei) {
  const at = new Date();
  if (!imei) {
    return { at, lat: null, lng: null, fuelLevel: null, source: "unavailable" };
  }
  try {
    const pos = await trackfuelClient.latest(imei);
    if (!pos) {
      return { at, lat: null, lng: null, fuelLevel: null, source: "unavailable" };
    }
    return {
      at,
      lat: pos.lat,
      lng: pos.lng,
      fuelLevel: pos.fuelLevel,
      source: "trackfuel.latest",
    };
  } catch (e) {
    console.warn(`[deliveryTracking] snapshot échoué pour ${imei}: ${e.message}`);
    return { at, lat: null, lng: null, fuelLevel: null, source: "unavailable" };
  }
}

/// Mute delivery.tracking.departure (et fige l'IMEI). Ne sauvegarde pas :
/// l'appelant persiste la livraison. Ne jette jamais.
async function attachDepartureSnapshot(delivery) {
  try {
    const imei = await resolveTrackerImei(delivery);
    const snapshot = await captureSnapshot(imei);
    delivery.tracking = {
      ...(delivery.tracking?.toObject?.() || delivery.tracking || {}),
      trackerImei: imei || delivery.tracking?.trackerImei || null,
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
    const imei = await resolveTrackerImei(delivery);
    const snapshot = await captureSnapshot(imei);
    delivery.tracking = {
      ...(delivery.tracking?.toObject?.() || delivery.tracking || {}),
      trackerImei: imei || delivery.tracking?.trackerImei || null,
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
  const imei = await resolveTrackerImei(delivery);
  if (!imei) return { available: false, reason: "no_tracker_mapped" };

  const { from, to } = tripWindow(delivery);
  const points = await trackfuelClient.historyRange(imei, from, to, { maxPoints });
  return {
    available: true,
    trackerImei: imei,
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
  const imei = await resolveTrackerImei(delivery);
  if (!imei) return { available: false, reason: "no_tracker_mapped" };

  const { from, to } = tripWindow(delivery);
  const toDate = (d) => new Date(d).toISOString().slice(0, 10);
  const events = await trackfuelClient.events(imei, toDate(from), toDate(to));
  const sumBy = (type) =>
    events
      .filter((e) => e.type === type)
      .reduce((acc, e) => acc + (Number(e.value) || 0), 0);
  return {
    available: true,
    trackerImei: imei,
    events,
    refueledTotal: sumBy("refueling"),
    leviedTotal: sumBy("levy"),
  };
}

/// Résumé léger : snapshots stockés + distance + événements + conso estimée.
async function getDeliverySummary(delivery, { maxPoints = 1000 } = {}) {
  const imei = await resolveTrackerImei(delivery);
  if (!imei) return { available: false, reason: "no_tracker_mapped" };

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

  // Dernière position pour signaler un tracker muet.
  let stale = null;
  try {
    const live = await trackfuelClient.latest(imei);
    stale = live ? isStale(live.date) : true;
  } catch (_e) {
    stale = null;
  }

  return {
    available: true,
    trackerImei: imei,
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
  resolveTrackerImei,
  captureSnapshot,
  attachDepartureSnapshot,
  attachArrivalSnapshot,
  getDeliveryTrip,
  getDeliveryFuelEvents,
  getDeliverySummary,
  _internals: { haversineKm, pathDistanceKm, tripWindow, isStale },
};
