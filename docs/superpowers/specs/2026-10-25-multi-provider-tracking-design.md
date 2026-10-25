# Abstraction multi-provider de tracking

Date : 2026-10-25
Branche : `feat/trackfuel-delivery-tracking`

## Contexte

Le tracking véhicule est aujourd'hui **codé en dur sur trackfuel**. Les services
(`deliveryTracking.js`, `routes/vehicle.js`) importent directement
`services/trackfuel/client.js`. Un repli Wialon temporaire subsiste dans
`routes/vehicle.js`.

Objectif : introduire une **abstraction provider** pour pouvoir brancher d'autres
prestataires de tracking à l'avenir, sans réécrire la logique métier.

## Décisions cadrées avec l'utilisateur

- **Trackfuel** est le vrai provider actif ; **Wialon** est gardé « pour la
  forme » (provider de 1ère classe mais secondaire). D'autres viendront (API
  inconnues aujourd'hui).
- **1 véhicule = 1 provider** à un instant T, mais le modèle doit permettre d'en
  ajouter dans le temps.
- Opération qu'un provider ne sait pas faire → réponse **« non supporté »**
  structurée (`{ available: false, reason: 'unsupported' }`), jamais un throw.
- Modèle de données : **`provider` + `deviceId` générique** (on migre
  `trackerImei` → `deviceId`).
- **Migration complète maintenant** (véhicules + livraisons), via un script
  idempotent.

## Modèle de données

### `models/vehicleModel.js`
```js
tracking: {
  provider: { type: String, enum: ['trackfuel', 'wialon'], default: 'trackfuel' },
  deviceId: { type: String, unique: true, sparse: true, trim: true },
}
```
Les champs legacy `id` / `plate` (Wialon) sont supprimés du schéma.

### `models/deliveryModel.js`
```js
tracking: {
  provider:  { type: String, default: null },
  deviceId:  { type: String, default: null },
  departure: { type: trackingSnapshotSchema, default: null },
  arrival:   { type: trackingSnapshotSchema, default: null },
}
```
`provider` + `deviceId` sont figés au départ du voyage pour préserver
l'historique si le véhicule est re-mappé.

## Sous-système `services/tracking/`

### Contrat provider (interface commune)
```
key                                      → 'trackfuel' | 'wialon'
capabilities                             → { position, fuel, fuelEvents, temperature }
latest(deviceId)                         → position | null
historyRange(deviceId, from, to, opts)   → points[]
events(deviceId, start, end, type?)      → events[]  (unsupported() si pas de capacité)
listTrackers()                           → [{ deviceId, name }]
```
Format canonique d'une position : `{ imei/deviceId, vehicle, date, lat, lng,
ignitionOn, speed, batteryVoltage, fuelLevel, temperature }` (déjà produit par le
client trackfuel).

### Fichiers
- **`provider.js`** — helper `unsupported()` + forme des `capabilities` +
  documentation du contrat.
- **`registry.js`** — `getProvider(key)`, `resolveVehicleProvider(vehicle)`,
  `resolveDeliveryProvider(delivery)`. Provider inconnu → renvoie `null`
  (les consommateurs traduisent en `unknown_provider`).
- **`trackfuelProvider.js`** — adapte le `TrackfuelClient` existant à l'interface.
  `capabilities: { position: true, fuel: true, fuelEvents: true, temperature: false }`.
- **`wialonProvider.js`** — adapte Wialon.
  `capabilities: { position: true, fuel: false, fuelEvents: false, temperature: true }`.
  `events()` et `historyRange()` non fournis → `unsupported()`.

Le `services/trackfuel/client.js` HTTP ne change pas (couche transport isolée).

## Branchement des consommateurs

### `services/deliveryTracking.js`
- Ne require plus `trackfuel/client` en dur.
- `resolveTrackerImei` → `resolveDeviceAndProvider(delivery)` qui renvoie
  `{ provider, deviceId }` (figé sur la livraison, sinon via le véhicule).
- Les captures et lectures passent par l'instance provider résolue.
- Si le provider ne supporte pas `events` → `getDeliveryFuelEvents` remonte
  `{ available: false, reason: 'unsupported' }`, et `getDeliverySummary` met
  `fuelConsumedEstimate: null`.
- `attachDepartureSnapshot` fige `provider` + `deviceId` sur la livraison.

### `routes/vehicle.js` (`GET /:id/module`)
- Résout le provider depuis `vehicle.tracking` et appelle `latest()` générique.
- Le repli Wialon en dur disparaît : Wialon est un provider normal.
- `temp` renvoyé `null` si `!capabilities.temperature`.
- `source` dans la réponse = `vehicle.tracking.provider`.

### Codes `reason` normalisés
- `no_device_mapped` (ex-`no_tracker_mapped`)
- `unsupported`
- `unknown_provider`

## Migration — `scripts/migrateTrackingProvider.js`

Idempotent, lancé une fois en prod.

**Véhicules :**
- `provider = tracking.id ? 'wialon' : 'trackfuel'`
- `deviceId = tracking.trackerImei || tracking.id`
- `$unset` de `tracking.trackerImei`, `tracking.id`, `tracking.plate`
- Log des cas ambigus (aucun identifiant).

**Livraisons :**
- `provider = 'trackfuel'`, `deviceId = tracking.trackerImei`
- `$unset tracking.trackerImei`

## Scripts & tests

- `scripts/syncTrackfuelTrackers.js` : écrit `deviceId` + `provider: 'trackfuel'`.
- `scripts/trackfuelProbe.js` : inchangé.
- Tests : `test/trackfuelClient.test.js` conservé ; ajout
  `test/trackingRegistry.test.js` (résolution + convention `unsupported`).

## Gestion d'erreurs

- Provider inconnu → `{ available: false, reason: 'unknown_provider' }`.
- Device non mappé → `{ available: false, reason: 'no_device_mapped' }`.
- Capacité absente → `{ available: false, reason: 'unsupported' }`.
- Snapshots best-effort (jamais de throw sur le flux métier).

## Hors scope

- Multi-provider simultané sur un même véhicule (1 provider à la fois).
- Intégration concrète d'un 3e provider (API inconnues).
- Suppression définitive de Wialon / InfluxDB (phase ultérieure).
