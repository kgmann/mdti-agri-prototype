# System architecture

The main building blocks of the prototype, the choices behind them, and how they fit together.

## Overview

```
Browser (farmer / government / bank portals)
        │  HTTPS + shared basic auth
     Caddy (reverse proxy, automatic HTTPS)
        │
     Next.js app ── pages & API routes (farmer, gov, bank, partner API)
        │   └── core/  ← tiny DPI: registries, flows, scoring, eligibility, search
        │   └── ai/    ← Gemini: assistant, photo diagnosis, voice, data assistant
        │
     PostgreSQL + PostGIS          External: Gemini API, Open-Meteo
```

One app, one database, one proxy, all run with Docker Compose.

## Tech stack and why

- **Next.js (App Router, TypeScript)** for the front end and back end in one app. The prototype has no long-running jobs (every AI call takes seconds), so a separate backend service would only add moving parts. Server components read the core directly; API routes exist only for browser-side actions and the partner API.
- **PostgreSQL + PostGIS** for all data. PostGIS does the geospatial work in SQL (points in communes, areas, GeoJSON output, spatial filters), which avoids a separate GIS stack. Postgres also provides what the data assistant needs to stay safe: a read-only database user.
- **Raw SQL with the `postgres` library, no ORM.** The commented SQL schema is the source of truth, most queries are spatial or aggregations where an ORM adds little, and the same schema file is given to the AI as context for the data assistant.
- **Leaflet (react-leaflet)** for maps. A few thousand features render fine client-side, so no map server or vector tiles are needed.
- **Tailwind CSS** for styling and **Recharts** for charts: fast to build a clean UI.
- **Gemini** (`@google/genai`) for all AI: chat, image understanding, speech input and speech output. Model names are environment variables.
- **Open-Meteo** for live weather (free, no API key).
- **Docker Compose + Caddy** on a single VPS. Caddy handles HTTPS certificates automatically.

## Code organisation

```
src/
  app/          pages (per portal) and API routes
  core/         the tiny DPI: data access and domain logic
  ai/           Gemini integrations
  lib/          weather (Open-Meteo) and display helpers
  components/   UI components
db/
  init/         SQL run on first database start (extensions, schema, read-only user)
  data/         real administrative boundaries (GeoJSON)
scripts/        seed script (synthetic data, scores, predictions)
deployments/    Docker Compose, Caddy, VPS setup and deploy scripts
```

**The core is the tiny DPI.** It holds everything about the data: queries, filters, scoring, eligibility and the shared types. Rule: pages and API routes never query the database directly; they call the core. The bank portal goes one step further: it is a browser client of the partner API, like a bank's own system would be. It lives in the same app for simplicity. In a real system it would be a separate service, published to partners and other ministries through X-Road.

## Data model

The schema is in [`db/init/02-schema.sql`](../db/init/02-schema.sql) and is commented table by table. The key ideas:

- **Actors.** One table for every actor type (farmer, cooperative, processor, distributor, bank, insurer), so lists, search and flows work the same for all. Farmer-specific data (gender, language, cooperative, data-sharing consent) and bank lending policies sit in small side tables. Persons carry an NPI and organisations an IFU as unique external identifiers; primary keys are internal.
- **Parcels.** Polygons owned by a farmer or a cooperative, with area, land type and soil attributes.
- **Campaigns and crop cycles.** A campaign is an agricultural year (e.g. 2025-2026). A crop cycle is one planting on one parcel, with its dates, status and harvest. A cycle belongs to the campaign in which its harvest falls. See [misc notes](04-misc-notes.md#campaigns-and-crop-cycles).
- **Flows.** Traceability is stored as dated events and aggregated when read: input distributions (subsidised or not, on credit or not, repaid or not), transfers (sales between actors) and processing batches (input product to output product). A batch can reference the transfers it consumed, which enables tracing back to farmers.
- **Products.** One catalogue for crops, processed products and inputs.
- **Alerts.** An alert and its recipients, fixed at sending time, each with a read date.
- **Computed data.** Credit scores and yield predictions are stored tables, computed by the seed script. In production they would be refreshed periodically.

## Computed data

- **Credit score.** A transparent scorecard for farmers only: points per factor (yield compared with peers, stability, input-credit repayment, verified sales, farm size, cooperative membership and history), giving a score from 0 to 100 and a band from A to E, with the factors kept for display. No machine learning: there is nothing real to learn from synthetic data, and explainability matters more. The weights are in `src/core/scoring.ts`.
- **Estimated income.** Expected production of the current campaign's cycles, valued at the median sale price observed in transfers.
- **Lending ceiling.** Computed per bank from its policy (share of estimated income, multiplier per band, cap, minimum score). The platform provides the evidence; the policy belongs to the bank.
- **Yield predictions.** A simple baseline: a linear trend over past campaigns per crop and department (Postgres regression functions), with an error band. It is labelled as a baseline.

## AI features

All AI calls are made server-side with Gemini.

- **Farmer assistant.** The system prompt carries the farmer's context: location, parcels, crops and stage, soil, weather, recent alerts. It asks for practical, safe advice addressed to the farmer, in the chosen language (French or Fon). There is no crop-guide corpus: the model's general knowledge plus the farm context is enough for a prototype.
- **Photo diagnosis.** The farmer's photo goes to the same multimodal model within the conversation.
- **Voice.** The browser records audio; the model transcribes and answers it; a text-to-speech model reads the answer out. Fon speech output is not officially supported by the model and is labelled experimental.
- **Data assistant.** The model receives the commented schema and the question and returns one SQL query. The query runs as a **read-only database user** with a time limit and a row cap, so even a bad or malicious query cannot change data. This is deliberately the only safeguard: enough for a prototype.

## Security (prototype level)

- One shared login (basic auth, credentials in environment variables) protects every page and API, including the partner API. It also protects the AI endpoints from abuse.
- No accounts, no roles. The partner API only returns farmers who agreed to share their data.
- Secrets (database password, Gemini key, login) live in `.env`, never in the repo. All identifiers in the synthetic data are in obviously fake ranges.

## Running locally

Requirements: Node.js 22+, Docker.

```bash
cp .env.example .env                   # fill in GEMINI_API_KEY at least
docker compose -f deployments/docker-compose.yml --env-file .env up -d db
npm install
npm run seed                           # loads boundaries, generates synthetic data, scores, predictions
npm run dev                            # http://localhost:3000
```

## Deployment

A single Ubuntu VPS runs the Compose stack (database, app, Caddy). The DNS A record for the subdomain points at the VPS; Caddy obtains the certificate. `deployments/vps-setup.sh` prepares a fresh VPS (Docker, firewall) and can be re-run safely; `deployments/deploy.sh` pulls the code, rebuilds, restarts, and seeds the database if it is empty. Details are in [`deployments/README.md`](../deployments/README.md).
