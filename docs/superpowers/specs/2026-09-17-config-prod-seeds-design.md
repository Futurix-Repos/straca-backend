# Spec — Seeds de configuration prod (STRACA)

**Date :** 2026-09-17
**Statut :** implémenté
**Périmètre :** transformer les 3 Excel de paramètres en fichiers seed importables, enrichissant le référentiel de prod de façon idempotente. Pas de config déploiement/env.

---

## 1. Contexte

STRACA a fourni 3 classeurs Excel de paramètres opérationnels (master data) :

| Fichier | Rôle |
|---|---|
| `Paramètre de configuration (5).xlsx` | Config générale (produits, chantiers, ~260 conducteurs, camions + modèle) |
| `PARAMETRE CAMIONS ... RDP-DOGBO-LALO-EIFFAGE PAC-KARTING ADOUNKO.xlsx` | Projet RDP/DOGBO/LALO : + source, provenance, marque, unités, tarifs TDL |
| `PARAMETRES TRAVAUX ADJAHA-ATHIEME ET AEP-LOKOSSA-ATHIEME.xlsx` | Projets ADJAHA-ATHIEME / AEP-LOKOSSA : + STERILE, DEBLAIS, sous-points PK/OA |

Les fichiers **se chevauchent et se contredisent** (variantes d'orthographe de conducteurs, marque/modèle divergents pour une même plaque). Un premier import CSV a déjà peuplé la prod (100 véhicules/conducteurs) avec une taxonomie **placeholder** ; les Excel apportent la vraie taxonomie (marque, config, source).

**Objectif :** générer des fichiers seed vérifiables + un importeur idempotent qui enrichit l'existant sans doublon.

---

## 2. Décisions (validées avec le métier)

| Sujet | Décision |
|---|---|
| Autorité en cas de conflit | **Fichiers 2 & 3 prioritaires** ; fichier 1 comble les trous ; résidus → rapport |
| Données existantes | **Enrichir par clé naturelle** (upsert, `_id` préservé) |
| Taxonomie véhicule | MARQUE → `VehicleBrand`, config (10/12 ROUES, SEMI…) → `VehicleType`, `VehicleModel` = « MARQUE config » |
| Produits | Chaque valeur = un `Product` ; `productType` = STANDARD (`678624dbb4352dbb8c35061b`) ou CONCASSE (`679cabe3d2726f19758160ce`) |
| Lieux | Chantier → `Location(type:destination)`, sous-points → `Section`, expédition → `Location(type:expedition)` |
| Unités | Réutilise les IDs existants : TONNES `67890afd1242e9fe7c4d8c73`, M3 `67890ad91242e9fe7c4d8c5b` |
| Tarifs | `Pricing` forcé avec valeurs par défaut (secondaire, non utilisé côté app). L'essentiel = `ProductMeasureUnit` |
| IDs | **ObjectId déterministes** (hash md5 de la clé naturelle → 24 hex) : stables entre builds |

---

## 3. Architecture

### 3.1 Modèle modifié — `models/locationModel.js`
Ajout du champ :
```js
type: { type: String, enum: ["expedition", "destination"], default: "destination" }
```

### 3.2 Route modifiée — `routes/location.js` (GET `/`)
Filtre optionnel `?type=expedition|destination` (validé, 400 sinon). Cumulable avec `search` et la pagination existante.

### 3.3 Script de build — `scripts/buildConfigSeeds.js`
- Lit les 3 `.xlsx` avec `exceljs` (déjà dépendance), colonnes mappées par position (voir `INPUT_FILES`).
- Réconcilie (union, priorité fichiers 2&3), classe, normalise (`normalizePlate`, `normalizeDriverKey`).
- Écrit `imports/reference/config.*.json` (JSON étendu `{$oid}`, `{$date}`) + rapport.
- `detId(namespace, key)` = ObjectId déterministe → idempotence, jamais de référence orpheline.
- Entrée : `CONFIG_INPUT_DIR` (défaut `/Users/futurix/Downloads`).

### 3.4 Importeur — `scripts/importConfigSeeds.js`
- Upsert **par clé naturelle** (pas par `_id`) : `updateOne({filter: clé}, {$set: champs, $setOnInsert: {_id}}, upsert)`.
- Docs existants matchés et enrichis, `_id` d'origine préservé.
- Ordre parent → enfant (voir `COLLECTIONS`).
- `section.chantier` **re-résolu par label** après import des locations (pointe vers l'`_id` réel en base).
- `DRY_RUN=1` : affiche le plan sans écrire ni se connecter.
- Réutilise `fromExtendedJson` de `scripts/importReferenceJson.js`.

---

## 4. Clés naturelles (upsert)

| Collection | Fichier | Clé |
|---|---|---|
| vehicleBrands / Types / Sources / Models | `config.vehicle*.json` | `label` |
| transportTypes | `config.transportTypes.json` | `label` |
| products | `config.products.json` | `name` |
| productMeasureUnits | `config.productMeasureUnits.json` | `product` + `measureUnit` |
| locations | `config.locations.json` | `label` |
| sections | `config.sections.json` | `label` + `chantier` (résolu) |
| drivers | `config.drivers.json` | `nameKey` |
| vehicles | `config.vehicles.json` | `plateNormalized` |
| pricing | `config.pricing.json` | `description` |

MeasureUnit & ProductType : **pas de fichier** — IDs existants réutilisés.

---

## 5. Règles de réconciliation

- **Union** des 3 fichiers ; en cas de conflit, la priorité fichier l'emporte (2&3 > 1), sinon conservation du premier + log.
- **Conducteurs** : dédup par `normalizeDriverKey` ; garde le `fullName` le plus complet ; variantes → rapport.
- **Véhicules** : dédup par `normalizePlate` ; `config`/`marque`/`source` remplis champ par champ ; conflit → rapport. Véhicule sans marque/config/source (fichier 1 seul) → fallback `INCONNU` / `STRACA BENIN` + rapport.
- **Produits** : valeur `^CONCASSE\s+…` → type CONCASSE, sinon STANDARD. Bruit exclu (sources, unités, TDL, configs, produits pollués dans colonnes lieux).
- **Lieux** : bruit filtré via le set produits + vocabulaire. Sous-point détecté par `\b(PK|OA|LOT)\s*\d+` avec parent identifiable → `Section` ; sinon `Location(destination)` + note.

---

## 6. Sorties (comptes actuels)

| Collection | Nb | Collection | Nb |
|---|---|---|---|
| vehicleBrands | 12 | products | 35 |
| vehicleTypes | 8 | productMeasureUnits | 35 |
| vehicleSources | 5 | locations | 89 (59 dest / 30 exp.) |
| vehicleModels | 28 | sections | 19 |
| transportTypes | 2 | drivers | 346 |
| pricing | 3 | vehicles | 172 |

Rapport : `imports/reference/config.conflicts-report.json` (14 conflits, 10 notes).

---

## 7. Vérification

- Lint `node --check` OK sur les 3 fichiers touchés.
- **0 référence orpheline** (vehicle→model/type/source, model→brand, pmu→product).
- `_id` **identiques entre 2 builds** (seuls les timestamps varient).
- Aucun champ interne (`_key`, `_concasse`) ne fuit dans les sorties.
- Recommandé avant prod : relire le rapport de conflits + import sur base staging (`DRY_RUN=1` puis import), comparer les comptes.

### Usage
```bash
node scripts/buildConfigSeeds.js                 # (re)génère les seeds
DRY_RUN=1 node scripts/importConfigSeeds.js       # plan sans écriture
node scripts/importConfigSeeds.js                 # import idempotent
node scripts/importConfigSeeds.js products drivers # sous-ensemble
```

---

## 8. Points ouverts / limites

- `ProductMeasureUnit.amount = 0` : aucun prix produit dans les Excel, à compléter côté métier/UI.
- `Pricing` non utilisé par l'app : lignes TDL générées à titre indicatif (TAXE MINIÈRE rattachée à « 10 ROUES » par défaut).
- Marques littérales du fichier (ex. « MERCEDES AROCS 8X8 ») et produits composés (« LATERITE SABLE DE REMBLAIS ») conservés tels quels — à normaliser si souhaité.
- Sous-points `PK`/`OA` sans préfixe de projet (fichier 3) traités en `Location` faute de parent identifiable.
- Fichiers `config.*` **séparés** de l'ancien pipeline CSV (`drivers.json`, `vehicles.json`…) — aucun écrasement.
