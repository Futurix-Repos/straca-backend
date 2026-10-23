// services/trackfuel/client.js
//
// Couche HTTP isolée pour l'API de tracking gestafric / trackfuel
// (http://trackfuel.net:5144). Responsabilité unique : s'authentifier, appeler
// les endpoints, et NORMALISER les réponses vers un format canonique stable —
// l'API expose des noms de champs incohérents selon l'endpoint
// (id_engin/nom_engin, id/vehicle, idtracker/vehiclename) et renvoie parfois une
// erreur dans le body avec un HTTP 200.
//
// Les coordonnées GPS sont déjà décimales sur l'API actuelle ; un garde-fou
// divise par 1e7 au cas où un entier brut reviendrait (régression côté
// prestataire).

const axios = require("axios");

const BASE_URL = process.env.TRACKFUEL_BASE_URL || "http://trackfuel.net:5144";
const EMAIL = process.env.TRACKFUEL_EMAIL;
const PASSWORD = process.env.TRACKFUEL_PASSWORD;

const HISTORY_PAGE_SIZE = 100; // max accepté par l'API
const HISTORY_MAX_PAGES_PER_DAY = 200; // garde-fou (20 000 points/jour)
const DEFAULT_TIMEOUT_MS = 15000;

// GARDE-FOU FUSEAU HORAIRE : l'API renvoie des `date` naïves (sans 'Z'). Tant
// que le fuseau n'est pas confirmé par le prestataire (UTC vs UTC+1 Bénin), on
// élargit la fenêtre de filtrage de cette marge pour ne pas couper le début/fin
// d'un trajet à cause d'un décalage. À réduire/retirer une fois le fuseau connu.
const WINDOW_MARGIN_MS = 2 * 60 * 60 * 1000; // 2 h

// ---------------------------------------------------------------------------
// Normalisation (exportée pour tests unitaires)
// ---------------------------------------------------------------------------

/// Convertit une coordonnée en décimal. L'API renvoie déjà des décimaux ; si un
/// entier brut (ex. 63885340) réapparaît, on le ramène en degrés (÷1e7).
function toCoordinate(value) {
  // Number(null)===0 et Number("")===0 : on écarte explicitement les vides pour
  // ne pas transformer une absence de position en (0,0).
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return Math.abs(n) > 180 ? n / 1e7 : n;
}

function firstDefined(...values) {
  for (const v of values) if (v !== undefined && v !== null) return v;
  return null;
}

/// Un point de position (latest ou point d'historique) → format canonique.
function normalizePosition(raw) {
  if (!raw || typeof raw !== "object") return null;
  return {
    imei: firstDefined(raw.id, raw.id_engin, raw.idtracker),
    vehicle: firstDefined(raw.vehicle, raw.nom_engin, raw.vehiclename),
    date: firstDefined(raw.date),
    lat: toCoordinate(raw.latitude),
    lng: toCoordinate(raw.longitude),
    ignitionOn: firstDefined(raw.ignitionon) === 1,
    speed: Number(firstDefined(raw.speed) ?? 0),
    batteryVoltage: firstDefined(raw.batteryvoltage, raw.batterie),
    fuelLevel: firstDefined(raw.fuellevel),
    temperature: firstDefined(raw.temperature),
  };
}

/// Un engin de la liste /trackers → format canonique.
function normalizeTracker(raw) {
  if (!raw || typeof raw !== "object") return null;
  return {
    imei: firstDefined(raw.id_engin, raw.id, raw.idtracker),
    name: firstDefined(raw.nom_engin, raw.vehicle, raw.vehiclename),
  };
}

/// Un événement /events (refueling / levy) → format canonique.
function normalizeEvent(raw) {
  if (!raw || typeof raw !== "object") return null;
  return {
    date: firstDefined(raw.date),
    type: firstDefined(raw.type),
    value: firstDefined(raw.value),
    imei: firstDefined(raw.idtracker, raw.id, raw.id_engin),
    vehicle: firstDefined(raw.vehiclename, raw.vehicle, raw.nom_engin),
  };
}

/// Détecte les erreurs renvoyées dans le body même avec un HTTP 200
/// (ex. { "message":"invalid Choice", "status_code":422 }).
function bodyError(data) {
  if (data && typeof data === "object" && !Array.isArray(data)) {
    const code = Number(data.status_code);
    if (Number.isFinite(code) && code >= 400) {
      return new Error(
        `trackfuel body error ${code}: ${data.message || "unknown"}`,
      );
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Client
// ---------------------------------------------------------------------------

class TrackfuelClient {
  constructor({ baseUrl = BASE_URL, email = EMAIL, password = PASSWORD } = {}) {
    this.baseUrl = baseUrl.replace(/\/+$/, "");
    this.email = email;
    this.password = password;
    this.accessToken = null;
    this.refreshToken = null;
    this.http = axios.create({ baseURL: this.baseUrl, timeout: DEFAULT_TIMEOUT_MS });
    this._loginPromise = null; // évite les logins concurrents
  }

  isConfigured() {
    return Boolean(this.email && this.password);
  }

  async login() {
    if (!this.isConfigured()) {
      throw new Error(
        "trackfuel non configuré (TRACKFUEL_EMAIL / TRACKFUEL_PASSWORD manquants)",
      );
    }
    // Dédoublonne les logins concurrents.
    if (this._loginPromise) return this._loginPromise;
    this._loginPromise = (async () => {
      const { data } = await this.http.post("/login", {
        email: this.email,
        password: this.password,
      });
      const err = bodyError(data);
      if (err) throw err;
      this.accessToken = data.access_token;
      this.refreshToken = data.refresh_token;
      return this.accessToken;
    })();
    try {
      return await this._loginPromise;
    } finally {
      this._loginPromise = null;
    }
  }

  async refreshAccessToken() {
    if (!this.refreshToken) return this.login();
    try {
      const { data } = await this.http.get("/refresh", {
        params: { refresh_token: this.refreshToken },
      });
      const err = bodyError(data);
      if (err) throw err;
      if (data.access_token) this.accessToken = data.access_token;
      if (data.refresh_token) this.refreshToken = data.refresh_token;
      return this.accessToken;
    } catch (_e) {
      // refresh invalide → nouveau login complet
      this.refreshToken = null;
      return this.login();
    }
  }

  /// GET authentifié avec un seul retry sur 401 (refresh puis rejoue).
  async authedGet(path, params = {}) {
    if (!this.accessToken) await this.login();
    const doGet = () =>
      this.http.get(path, {
        params,
        headers: { Authorization: `Bearer ${this.accessToken}` },
      });
    let res;
    try {
      res = await doGet();
    } catch (e) {
      if (e.response?.status === 401) {
        await this.refreshAccessToken();
        res = await doGet();
      } else {
        throw e;
      }
    }
    const err = bodyError(res.data);
    if (err) throw err;
    return res.data;
  }

  // --- Endpoints ---------------------------------------------------------

  /// Liste des engins du parc. → [{imei, name}]
  async listTrackers() {
    const data = await this.authedGet("/trackers");
    return (Array.isArray(data) ? data : []).map(normalizeTracker).filter(Boolean);
  }

  /// Dernière position connue d'un engin. → position canonique ou null.
  async latest(imei) {
    const data = await this.authedGet("/trackers/latest", { tracker: imei });
    // Tracker inconnu → l'API renvoie 200 + null.
    if (data == null) return null;
    return normalizePosition(data);
  }

  /// Une page d'historique pour une journée donnée. → { points, page }
  async history(imei, date, { page = 1, pageSize = HISTORY_PAGE_SIZE } = {}) {
    const data = await this.authedGet("/history", {
      tracker: imei,
      date,
      page,
      pagesize: pageSize,
    });
    const rows = Array.isArray(data) ? data : data?.data || [];
    return { points: rows.map(normalizePosition).filter(Boolean), page };
  }

  /// Historique agrégé entre deux instants (plusieurs jours, paginé), filtré sur
  /// la fenêtre [from, to] et sous-échantillonné à `maxPoints`.
  async historyRange(imei, from, to, { maxPoints = 2000 } = {}) {
    const fromTs = new Date(from).getTime() - WINDOW_MARGIN_MS;
    const toTs = new Date(to).getTime() + WINDOW_MARGIN_MS;
    const points = [];
    for (const date of eachDay(from, to)) {
      for (let page = 1; page <= HISTORY_MAX_PAGES_PER_DAY; page += 1) {
        const { points: pagePoints } = await this.history(imei, date, { page });
        for (const p of pagePoints) {
          const ts = new Date(p.date).getTime();
          if (Number.isFinite(ts) && ts >= fromTs && ts <= toTs) points.push(p);
        }
        if (pagePoints.length < HISTORY_PAGE_SIZE) break; // dernière page
      }
    }
    points.sort((a, b) => new Date(a.date) - new Date(b.date));
    return subsample(points, maxPoints);
  }

  /// Événements (refueling / levy) sur une période. type optionnel.
  async events(imei, start, end, type) {
    const params = { tracker: imei, start, end };
    if (type) params.type = type;
    const data = await this.authedGet("/events", params);
    return (Array.isArray(data) ? data : []).map(normalizeEvent).filter(Boolean);
  }
}

// ---------------------------------------------------------------------------
// Helpers date / échantillonnage (exportés pour tests)
// ---------------------------------------------------------------------------

/// Liste des dates "YYYY-MM-DD" couvrant [from, to] inclus (UTC).
function eachDay(from, to) {
  const days = [];
  const d = new Date(from);
  d.setUTCHours(0, 0, 0, 0);
  const endDay = new Date(to);
  endDay.setUTCHours(0, 0, 0, 0);
  while (d.getTime() <= endDay.getTime()) {
    days.push(d.toISOString().slice(0, 10));
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return days;
}

/// Réduit un tableau à au plus `max` éléments en gardant un pas régulier et en
/// conservant toujours le premier et le dernier.
function subsample(arr, max) {
  if (!Array.isArray(arr) || arr.length <= max || max <= 2) return arr.slice(0, max > 0 ? max : arr.length);
  const step = (arr.length - 1) / (max - 1);
  const out = [];
  for (let i = 0; i < max; i += 1) out.push(arr[Math.round(i * step)]);
  return out;
}

module.exports = {
  TrackfuelClient,
  // singleton prêt à l'emploi
  trackfuelClient: new TrackfuelClient(),
  // internes exportés pour tests
  _internals: {
    toCoordinate,
    normalizePosition,
    normalizeTracker,
    normalizeEvent,
    bodyError,
    eachDay,
    subsample,
  },
};
