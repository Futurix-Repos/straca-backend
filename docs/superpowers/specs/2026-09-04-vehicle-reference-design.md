# Référentiel véhicules, chauffeurs, sites et prestataires

**Statut :** validé pour implémentation

## Objectif

Faire évoluer le backend STRACA pour gérer les véhicules, prestataires, chauffeurs et sites avec des identifiants MongoDB, des règles d'unicité fiables et une migration sans rupture des livraisons ni du suivi GPS existants.

## Décision

Faire évoluer les collections existantes plutôt que créer un second référentiel. `Vehicle` garde ses références actuelles (`model`, `type`, `source`, `tracking`, `driver`) et reçoit les champs de normalisation, de prestataire et de statut. Les chauffeurs sont introduits dans une nouvelle collection `drivers`; les relations temporelles chauffeur-véhicule sont stockées dans `vehicleDriverAssignments`.

`Location` reste la collection des sites : elle est enrichie avec `code`, `externalIds` et `isActive`. `Prestataire` est enrichi avec `externalIds`, sans supprimer le champ historique `odooId`.

## Modèles

### Vehicle

Champs ajoutés :

- `plateRaw` : plaque affichée, obligatoire pour les nouveaux véhicules.
- `plateNormalized` : plaque sans espaces ni tirets, en majuscules, unique.
- `prestataire` : référence facultative vers `Prestataire`.
- `status` : `pending`, `verified` ou `inactive`; défaut `verified` pour préserver le comportement des véhicules existants.
- `externalIds` et `metadata` : objets facultatifs.

`registrationNumber` est conservé pendant la migration. À la création ou modification, il est synchronisé avec `plateRaw`; `plateNormalized` est calculé à partir de la plaque disponible.

### Driver

```js
{ fullName, nameKey, user?, isActive, timestamps }
```

`nameKey` normalise les espaces, accents et la casse. Il est unique. `user` relie facultativement un chauffeur à un compte employé existant.

### VehicleDriverAssignment

```js
{ vehicle, driver, linkType, startsAt?, endsAt?, assignedBy?, timestamps }
```

`linkType` vaut `current` ou `future`. Les index partiels garantissent au plus une affectation de chaque type par véhicule. Lors d'un remplacement de chauffeur actuel, l'ancienne affectation est clôturée avec `endsAt`, puis la nouvelle est créée.

### Prestataire et Location

`Prestataire` reçoit `externalIds`. `Location` reçoit `code`, `externalIds` et `isActive`; `label` et `description` restent inchangés pour les routes et sections existantes.

## API

- Les routes véhicules normalisent les plaques et renvoient `409` lors d'un doublon.
- `GET /vehicles` accepte `q`, `page`, `perPage`, `prestataireId` et `status`.
- `POST /vehicles` peut accepter un chauffeur sous la forme `{ fullName }`; le chauffeur est créé ou retrouvé avec un upsert, puis affecté en `current`.
- `PATCH /vehicles/:id/driver` remplace le chauffeur actuel.
- Nouvelles routes `/drivers` et `/vehicle-driver-assignments` pour la lecture des référentiels et de l'historique.
- Les routes prestataires et locations utilisent `PATCH` pour les mises à jour partielles et la désactivation par `isActive: false`; les suppressions physiques sont retirées de ce périmètre.

## Migration

1. Créer les index et les modèles sans supprimer de champs existants.
2. Parcourir `vehicles` pour renseigner `plateRaw`, `plateNormalized` et `status`.
3. Détecter les collisions de plaques normalisées avant l'index unique, puis les exclure ou les corriger manuellement.
4. Créer les chauffeurs par upsert sur `nameKey` et les affectations depuis les imports Excel.
5. Conserver temporairement `Vehicle.driver` pour les consommateurs existants; il est synchronisé pour les chauffeurs ayant un `user` associé.

## Contraintes et erreurs

- Toutes les dates sont stockées en UTC.
- Les références `prestataire`, `vehicle` et `driver` sont vérifiées avant écriture.
- Les erreurs de validation retournent `400` ou `422`; les ressources absentes retournent `404`; les conflits d'unicité retournent `409`.
- Les affectations multi-collections utilisent une transaction lorsque MongoDB est configuré en replica set. Sinon, les index uniques et une compensation applicative protègent l'intégrité.

## Tests d'acceptation

- Deux variantes de la même plaque sont rejetées.
- Un véhicule peut être créé sans prestataire ni chauffeur.
- Un prestataire peut être associé à plusieurs véhicules.
- Un chauffeur peut être associé à plusieurs véhicules.
- Changer le chauffeur actuel clôture l'affectation précédente et conserve l'historique.
- Il est impossible d'avoir deux affectations `current` ou deux `future` pour le même véhicule.
- Un site peut être créé, désactivé et référencé sans dépendre d'un véhicule.
