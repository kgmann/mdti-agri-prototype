# Deployment

A single Ubuntu VPS runs three containers with Docker Compose: `db` (PostgreSQL + PostGIS), `app` (Next.js) and `caddy` (reverse proxy with automatic HTTPS).

## First time
1. DNS: an A record for the subdomain (e.g. `agriprototype.lucatakpa.com`) pointing to the VPS IP. Ports 80 and 443 must be reachable (Caddy needs them for the certificate).
2. On the VPS:
   ```bash
   git clone <repo-url> agri-digit && cd agri-digit && git checkout dev
   sudo deployments/vps-setup.sh          # Docker + firewall; re-run safe
   cp .env.example .env                    # fill in: passwords, GEMINI_API_KEY, BASIC_AUTH_*, APP_DOMAIN
   deployments/deploy.sh
   ```
   The database is initialised from `db/init/` on first start, then seeded by the deploy script.

## Updates
`deployments/deploy.sh` again: pulls, rebuilds, restarts. It only seeds an empty database.

## Reset the data
```bash
docker compose -f deployments/docker-compose.yml --env-file .env --profile full run --rm app npm run seed
```
After a schema change, the database must be recreated (init scripts only run on an empty volume): `... down`, `docker volume rm agri-digit_pg-data`, then deploy again.
