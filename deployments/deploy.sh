#!/usr/bin/env bash
# Deploys (or redeploys) the stack from the current checkout. Run from anywhere on the VPS.
# Pulls the current branch, rebuilds, restarts, and seeds the database if it is empty.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
[[ -f .env ]] || { echo "Missing .env (copy .env.example and fill it in)." >&2; exit 1; }
if grep -q "change-me" .env; then echo "Replace every 'change-me' value in .env first." >&2; exit 1; fi

COMPOSE=(docker compose -f deployments/docker-compose.yml --env-file .env --profile full)

git pull --ff-only
"${COMPOSE[@]}" build app
"${COMPOSE[@]}" up -d db
"${COMPOSE[@]}" run --rm app npm run seed -- --if-empty
"${COMPOSE[@]}" up -d
"${COMPOSE[@]}" ps
echo "Deployed. Logs: ${COMPOSE[*]} logs -f app"
