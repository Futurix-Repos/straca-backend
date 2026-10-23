# Intégration tracking trackfuel (gestafric) — Conception

Date : 2026-10-22
Branche : `feat/trackfuel-delivery-tracking`

## Contexte

Le tracking actuel repose sur **Wialon + InfluxDB**, piloté par un `setInterval`
en mémoire dans `services/vehicleTracking.js`. Fragile : l'état de tracking est
perdu à chaque redémarrage/redéploiement Docker, et le stockage des positions
est fait maison.

Le prestataire **gestafric / trackfuel** (`http://trackfuel.net:5144`) expose une
API qui couvre tous nos besoins et fournit **l'historique de trajet et les
événements carburant à la demande**, ce qui supprime le besoin de polling et de
stockage local.

Besoins métier : tracking au départ et à l'arrivée des livraisons, niveaux de
carburant au départ et à la livraison, et chemin parcouru par chaque camion.

## Décisions validées

1. **trackfuel remplace Wialon** (confirmé par tests live sur le parc réel).
2. **Interrogation à la demande** : aucun trajet n'est stocké côté Straca ;
   `/history` et `/events` sont appelés quand on consulte un voyage.
3. **Snapshots au moment de l'événement** : le carburant/position « au départ »
   et « à l'arrivée » sont lus via `/trackers/latest` à l'instant du départ
   (création du voyage) et de l'arrivée (réception), puis stockés sur la
   livraison (`/trackers/latest` ne donne que l'instant présent).
4. **Mapping véhicule ↔ IMEI** : script de synchronisation qui rapproche
   `nom_engin` du `plateNormalized`, stocke l'IMEI sur le véhicule, liste les
   non-appariés.
5. **Approche phasée (B)** : on ajoute trackfuel à côté de l'existant ; Wialon /
   InfluxDB ne sont plus sollicités par le nouveau flux et seront retirés en
   phase 2, après confirmation des points en suspens et validation prod.

## API trackfuel (validée par tests live)

- Auth : `POST /login` (body JSON `{email,password}`) → `{access_token, refresh_token}`.
  Auth des autres appels via header `Authorization: Bearer <access_token>`.
  Refresh : `GET /refresh?refresh_token=…`. Access token ~30 min.
- `GET /trackers` → `[{id_engin, nom_engin}]` (liste du parc).
- `GET /trackers/latest?tracker=<imei>` → `{id, vehicle, date, latitude, longitude,
  ignitionon, speed, batteryvoltage, fuellevel, temperature}`. GPS déjà décimal.
- `GET /history?tracker=&date=YYYY-MM-DD&page=&pagesize=` (max 100) →
  `{data:[ …points… ]}`.
- `GET /events?tracker=&start=&end=&type=refueling|levy` →
  `[{date, idtracker, type, value, vehiclename}]` (value en litres).

**Pièges confirmés** à absorber côté client :
- Nommage incohérent selon l'endpoint (`id_engin/nom_engin`, `id/vehicle`,
  `idtracker/vehiclename`) → normalisation vers un format canonique.
- `fuellevel` bruité d'une lecture à l'autre.
- `/history` volumineux, pagesize max 100 → pagination + sous-échantillonnage.
- Trackers parfois muets (pas de remontée depuis des semaines).
- Erreurs renvoyées dans le body avec HTTP 200 (ex. `{"status_code":422}`) ;
  `null` pour un tracker inconnu.

**À confirmer par le prestataire (non bloquant pour construire, bloquant pour
retirer Wialon)** : unité de `fuellevel` (litres ?), fuseau horaire des `date`,
liste complète des `type` d'événements.

## Architecture

### Modèle de données

`Vehicle.tracking.trackerImei` : `String`, unique, sparse.

`Delivery.tracking` (sous-document) :
```
tracking: {
  trackerImei: String,
  departure: { at, lat, lng, fuelLevel, source },
  arrival:   { at, lat, lng, fuelLevel, source },
}
```
`source` ∈ `"trackfuel.latest" | "unavailable"`.

### `services/trackfuel/client.js` — couche HTTP isolée

Responsabilité unique : parler à l'API trackfuel et normaliser.
- Gestion de token en mémoire : login à la première utilisation, auto-refresh sur
  401, re-login si le refresh échoue.
- Méthodes : `listTrackers()`, `latest(imei)`, `history(imei, date, {page,pageSize})`,
  `historyRange(imei, from, to, {maxPoints})`, `events(imei, start, end, type?)`.
- Normalisation : sortie canonique `{imei, vehicle, date, lat, lng, ignitionOn,
  speed, batteryVoltage, fuelLevel, temperature}`. Garde-fou GPS (÷1e7 si entier).
- Détection des erreurs body-level même en HTTP 200 ; `latest` renvoie `null` si
  tracker inconnu.

### `services/deliveryTracking.js` — service métier

Relie livraison ↔ tracker, sans connaître le HTTP :
- `captureDepartureSnapshot(delivery)` / `captureArrivalSnapshot(delivery)`.
- `getDeliveryTrip(delivery, {maxPoints})` → `{path[], distanceKm, pointCount}`
  (distance par haversine).
- `getDeliveryFuelEvents(delivery)` → refueling + levy sur la période du voyage.
- `getDeliverySummary(delivery)` → départ, arrivée, distance, événements.

### Points de capture (best-effort)

- Départ : `POST /delivery/sender`, après sauvegarde ; remplace l'appel
  `startDeliveryTracking`.
- Arrivée : `PUT /receiver/:voucherNumber` au passage `DELIVERED`, et à la
  validation admin ; remplace `stopDeliveryTracking`.
- Best-effort strict : try/catch, `source:"unavailable"` si l'API est down ; ne
  casse jamais le flux métier.

### Endpoints de lecture (à la demande)

- `GET /delivery/:id/tracking` → résumé.
- `GET /delivery/:id/trip` → points du trajet (`/history`).
- `GET /vehicle/:id/live` → position courante (`/trackers/latest`).
Tous derrière `authorizeJwt` + permissions existantes.

### `scripts/syncTrackfuelTrackers.js`

Appelle `/trackers`, rapproche `nom_engin` ↔ `plateNormalized`, écrit l'IMEI,
liste les non-appariés. Idempotent.

### `scripts/trackfuelProbe.js`

Script de diagnostic (login + appel de chaque endpoint pour un IMEI), pour
vérifier la connectivité et les données depuis une IP autorisée.

### Config `.env`

`TRACKFUEL_BASE_URL`, `TRACKFUEL_EMAIL`, `TRACKFUEL_PASSWORD`.

## Cas limites

- Véhicule sans IMEI → `{available:false, reason:"no_tracker_mapped"}`.
- Tracker muet (latest trop ancien) → flag `stale:true`.
- trackfuel indisponible → lecture gracieuse ; snapshots `source:"unavailable"`.
- Voyages déjà en cours sans snapshot départ : trajet/événements restent
  disponibles à la demande.

## Tests

- Unitaires : normalisation du client (3 conventions → canonique), garde-fou GPS,
  logique de refresh de token (mock), distance haversine.
- Diagnostic : `scripts/trackfuelProbe.js` (live, depuis IP autorisée).
- Best-effort : une panne trackfuel ne casse pas la création/réception.

## Phase 2 (ultérieure, après confirmations prestataire)

Retrait de `services/vehicleTracking.js` (Wialon + Influx), des appels
start/stop, de la position Wialon dans `routes/vehicle.js` (→ `latest`), et des
variables d'environnement `INFLUX_*` / `WIALON_TOKEN`.
