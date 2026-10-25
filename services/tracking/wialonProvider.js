// services/tracking/wialonProvider.js
//
// Adapte Wialon au contrat provider commun. Gardé « pour la forme » : fournit la
// position courante (+ température et carburant via capteurs), mais pas
// l'historique de trajet ni les événements carburant façon trackfuel → ces
// capacités renvoient UNSUPPORTED.

const wialonServices = require("../../helpers/iotHelper");
const { computeFuelValue, getSensorByP } = require("../../helpers/iotModule");
const { capabilities, UNSUPPORTED } = require("./provider");

// 4294967295 = tous les flags (position + capteurs + valeurs). Repris du
// comportement historique de routes/vehicle.js.
const WIALON_ALL_FLAGS = 4294967295;

/// item Wialon -> position canonique (même forme que trackfuel + pinImg).
function toCanonicalPosition(item) {
  if (!item) return null;

  const tempRaw = item?.prms?.io_26?.v;

  const fuelRaw = item?.prms?.io_273?.v;
  const fuelSensor = getSensorByP(item?.sens, "io_273");
  const fuelLevel =
    fuelRaw !== undefined && Array.isArray(fuelSensor?.tbl)
      ? computeFuelValue(fuelRaw, fuelSensor.tbl)
      : fuelRaw ?? null;

  const ignition = item?.prms?.io_239?.v;

  return {
    deviceId: item.id != null ? String(item.id) : null,
    vehicle: item.nm ?? null,
    date: null,
    lat: item?.pos?.y ?? null,
    lng: item?.pos?.x ?? null,
    speed: item?.pos?.s ?? 0,
    ignitionOn: ignition != null ? ignition === 1 : null,
    fuelLevel,
    temperature: tempRaw !== undefined ? tempRaw * 10 : null,
    pinImg: item?.uri ? `https://hst-api.wialon.eu${item.uri}` : null,
  };
}

const wialonProvider = {
  key: "wialon",
  capabilities: capabilities({
    position: true,
    history: false,
    fuel: true,
    fuelEvents: false,
    temperature: true,
  }),
  isConfigured: () => true,
  latest: async (deviceId) => {
    const res = await wialonServices.searchItemById({
      itemId: deviceId,
      flags: WIALON_ALL_FLAGS,
    });
    if (res?.error || !res?.item) return null;
    return toCanonicalPosition(res.item);
  },
  historyRange: async () => UNSUPPORTED,
  events: async () => UNSUPPORTED,
  listTrackers: async () => [],
  _internals: { toCanonicalPosition },
};

module.exports = { wialonProvider };
