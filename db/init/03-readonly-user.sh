#!/bin/bash
# Read-only database user for the AI data assistant: it can read every table but change nothing.
# Each query also gets a time limit. Runs once, on first database initialisation.
set -euo pipefail

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
  CREATE ROLE readonly_assistant LOGIN PASSWORD '${READONLY_DB_PASSWORD}';
  GRANT CONNECT ON DATABASE "${POSTGRES_DB}" TO readonly_assistant;
  GRANT USAGE ON SCHEMA public TO readonly_assistant;
  GRANT SELECT ON ALL TABLES IN SCHEMA public TO readonly_assistant;
  ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO readonly_assistant;
  ALTER ROLE readonly_assistant SET statement_timeout = '5s';
  ALTER ROLE readonly_assistant SET default_transaction_read_only = on;
EOSQL
