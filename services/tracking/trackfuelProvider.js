// services/tracking/trackfuelProvider.js
//
// Adapte le TrackfuelClient HTTP (services/trackfuel/client.js) au contrat
// provider commun. La couche transport/normalisation reste dans le client ; ici
// on se contente d'exposer l'interface et les capacités.

const { trackfuelClient } = require("../trackfuel/client");
const { capabilities } = require("./provider");

const trackfuelProvider = {
  key: "trackfuel",
  capabilities: capabilities({
    position: true,
    history: true,
    fuel: true,
    fuelEvents: true,
    temperature: false, // trackfuel ne fournit pas la température.
  }),
  isConfigured: () => trackfuelClient.isConfigured(),
  latest: (deviceId) => trackfuelClient.latest(deviceId),
  historyRange: (deviceId, from, to, opts) =>
    trackfuelClient.historyRange(deviceId, from, to, opts),
  events: (deviceId, start, end, type) =>
    trackfuelClient.events(deviceId, start, end, type),
  // Le client renvoie [{imei, name}] ; on expose la clé générique deviceId.
  listTrackers: async () =>
    (await trackfuelClient.listTrackers()).map((t) => ({
      deviceId: t.imei,
      name: t.name,
    })),
};

module.exports = { trackfuelProvider };
