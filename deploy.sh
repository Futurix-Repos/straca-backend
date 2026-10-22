#!/usr/bin/env bash
#
# deploy.sh — déploiement du backend Straca (Docker Compose).
#
# Reconstruit l'image et recrée le conteneur à partir de la branche `main`.
# Un simple `git pull` ne suffit PAS : le Dockerfile fait `COPY . .`, donc le
# code est figé dans l'image au build. Sans `--build`, l'ancien code continue
# de tourner (c'était la cause du bug « Vehicle has pending delivery validation »).
#
# Usage :
#   ./deploy.sh            # déploie la branche main
#   BRANCH=ma-branche ./deploy.sh
#
set -euo pipefail

# --- Config ---------------------------------------------------------------
BRANCH="${BRANCH:-main}"
SERVICE="straca-backend"       # nom du service dans compose.yml
CONTAINER="straca-backend"     # container_name dans compose.yml
HOST_PORT="3007"               # port exposé côté hôte (3007:3005)
SENTINEL='Vehicle has pending' # chaîne qui NE DOIT PLUS exister dans le code à jour

# Se placer dans le dossier du script (racine du repo)
cd "$(dirname "$0")"

# Choix de la commande compose (plugin v2 « docker compose » ou binaire « docker-compose »)
if docker compose version >/dev/null 2>&1; then
  DC="docker compose"
elif command -v docker-compose >/dev/null 2>&1; then
  DC="docker-compose"
else
  echo "✗ Ni 'docker compose' ni 'docker-compose' n'est disponible." >&2
  exit 1
fi

say() { printf '\n\033[1;34m==> %s\033[0m\n' "$1"; }

# --- 1. Récupérer le code -------------------------------------------------
say "Mise à jour du code (branche $BRANCH)"
git fetch origin "$BRANCH"
git checkout "$BRANCH"
git reset --hard "origin/$BRANCH"   # garantit que le worktree == origin (pas de dérive locale)
echo "HEAD = $(git rev-parse --short HEAD) — $(git log -1 --pretty=%s)"

# --- 2. Reconstruire + recréer --------------------------------------------
say "Reconstruction de l'image et recréation du conteneur"
$DC up -d --build --force-recreate "$SERVICE"

# --- 3. Vérifier que le NOUVEAU code tourne dans le conteneur --------------
say "Vérification du code embarqué dans le conteneur"
if docker exec "$CONTAINER" grep -rn "$SENTINEL" routes/delivery.js 2>/dev/null; then
  echo "✗ ÉCHEC : l'ancienne chaîne « $SENTINEL » est encore présente dans le conteneur." >&2
  echo "  → l'image n'a pas été reconstruite / le conteneur n'a pas été recréé." >&2
  exit 1
fi
echo "✓ Code à jour : la règle obsolète n'est plus présente dans le conteneur."

# --- 4. Health check ------------------------------------------------------
say "Health check (http://localhost:$HOST_PORT/)"
ok=false
for i in $(seq 1 15); do
  if curl -fsS "http://localhost:$HOST_PORT/" >/dev/null 2>&1; then
    ok=true
    break
  fi
  sleep 2
done
if [ "$ok" = true ]; then
  echo "✓ Le service répond sur le port $HOST_PORT."
else
  echo "✗ Le service ne répond pas après ~30s. Logs récents :" >&2
  $DC logs --tail=40 "$SERVICE" >&2
  exit 1
fi

say "Déploiement terminé avec succès ✅"
docker ps --filter "name=$CONTAINER" --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}'
