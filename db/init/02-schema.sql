-- Agri-Digit Bénin prototype — database schema (source of truth).
-- PostgreSQL + PostGIS. Geometries are WGS 84 (SRID 4326); areas are computed on geography (true m²).
-- Amounts are in CFA francs (XOF), quantities in kilograms, areas in hectares.
-- This file is also given to the AI data assistant as context, so keep the comments accurate.

-- ============================================================================
-- Administrative boundaries (real data, geoBoundaries)
-- ============================================================================

-- The 12 departments of Bénin.
CREATE TABLE departments (
  id    serial PRIMARY KEY,
  code  text NOT NULL UNIQUE,              -- ISO 3166-2 code, e.g. 'BJ-ZO'
  name  text NOT NULL UNIQUE,              -- display name, e.g. 'Zou', 'Ouémé'
  geom  geometry(MultiPolygon, 4326) NOT NULL
);

-- The 77 communes, each inside one department.
CREATE TABLE communes (
  id             serial PRIMARY KEY,
  department_id  int NOT NULL REFERENCES departments(id),
  name           text NOT NULL,            -- e.g. 'Bohicon', 'Abomey-Calavi'
  geom           geometry(MultiPolygon, 4326) NOT NULL
);
CREATE INDEX communes_department_idx ON communes(department_id);

-- ============================================================================
-- Reference data
-- ============================================================================

-- Agricultural campaigns (agricultural years). Convention: 1 April to 31 March.
-- A crop cycle belongs to the campaign in which its (expected) harvest date falls.
CREATE TABLE campaigns (
  id          serial PRIMARY KEY,
  code        text NOT NULL UNIQUE,        -- e.g. '2025-2026'
  start_date  date NOT NULL,
  end_date    date NOT NULL,
  is_current  boolean NOT NULL DEFAULT false   -- exactly one current campaign
);

CREATE TYPE product_kind AS ENUM ('crop', 'processed', 'input');

-- One catalogue for raw crops, processed products and agricultural inputs.
CREATE TABLE products (
  id                  serial PRIMARY KEY,
  code                text NOT NULL UNIQUE,     -- e.g. 'maize', 'gari', 'npk'
  name_fr             text NOT NULL,            -- e.g. 'Maïs', 'Gari', 'Engrais NPK'
  kind                product_kind NOT NULL,
  category            text NOT NULL,            -- crop: cereal, tuber, legume, cash_crop, fruit, vegetable; input: fertilizer, seed, pesticide; processed: food, oil, fiber
  is_perennial        boolean NOT NULL DEFAULT false,  -- crops only: cashew, pineapple, oil palm
  typical_yield_kg_ha numeric,                  -- crops only: typical national yield
  reference_price_xof numeric                   -- indicative price per kg
);

-- ============================================================================
-- Actors (registries)
-- ============================================================================

CREATE TYPE actor_type AS ENUM ('farmer', 'cooperative', 'processor', 'distributor', 'bank', 'insurer');

-- Every actor of the agricultural ecosystem, in one table so lists, search and flows work the same for all.
-- Persons (farmers) are identified by their NPI (ANIP), organisations by their IFU (DGI).
-- These are unique external identifiers; the primary key is internal. Synthetic NPIs start with '99', IFUs with '9'.
CREATE TABLE actors (
  id             serial PRIMARY KEY,
  type           actor_type NOT NULL,
  name           text NOT NULL,           -- person's full name or organisation name
  npi            text UNIQUE,             -- persons only (10 digits)
  ifu            text UNIQUE,             -- organisations (13 digits); optional for farmers
  phone          text,
  commune_id     int NOT NULL REFERENCES communes(id),
  location       geometry(Point, 4326) NOT NULL,   -- home or head office
  registered_on  date NOT NULL             -- date of registration in the platform
);
CREATE INDEX actors_type_idx ON actors(type);
CREATE INDEX actors_commune_idx ON actors(commune_id);

-- Farmer-specific attributes (one row per actor of type 'farmer').
CREATE TABLE farmer_profiles (
  actor_id                   int PRIMARY KEY REFERENCES actors(id),
  gender                     text NOT NULL CHECK (gender IN ('F', 'M')),
  birth_year                 int NOT NULL,
  preferred_language         text NOT NULL CHECK (preferred_language IN ('fr', 'fon')),
  cooperative_id             int REFERENCES actors(id),   -- membership in a cooperative, if any
  shares_data_with_partners  boolean NOT NULL DEFAULT true -- consent: visible to banks through the partner API
);
CREATE INDEX farmer_profiles_coop_idx ON farmer_profiles(cooperative_id);

-- A bank's lending policy, used to compute its indicative lending ceiling per farmer.
-- ceiling = min(max_amount_xof, estimated_income_xof * income_share * band multiplier), 0 below min_score.
CREATE TABLE bank_policies (
  bank_id           int PRIMARY KEY REFERENCES actors(id),
  income_share      numeric NOT NULL,     -- share of the farmer's estimated campaign income the bank will lend, e.g. 0.35
  band_multipliers  jsonb NOT NULL,       -- e.g. {"A":1,"B":0.8,"C":0.6,"D":0.3,"E":0}
  min_score         int NOT NULL,         -- no offer below this score
  max_amount_xof    numeric NOT NULL      -- absolute cap per farmer
);

-- ============================================================================
-- Parcels and crop cycles
-- ============================================================================

-- Farm parcels, owned by a farmer or a cooperative.
CREATE TABLE parcels (
  id          serial PRIMARY KEY,
  code        text NOT NULL UNIQUE,       -- human-readable, e.g. 'P-000123'
  owner_id    int NOT NULL REFERENCES actors(id),
  commune_id  int NOT NULL REFERENCES communes(id),
  geom        geometry(Polygon, 4326) NOT NULL,
  area_ha     numeric NOT NULL,           -- computed from geom
  land_type   text NOT NULL CHECK (land_type IN ('rainfed_upland', 'rainfed_lowland', 'irrigated')),
  soil_type   text NOT NULL,              -- e.g. 'Terre de barre (sol ferrallitique)'
  soil_texture text NOT NULL,             -- e.g. 'sableux-argileux'
  soil_ph     numeric NOT NULL,
  soil_organic_carbon_pct numeric NOT NULL
);
CREATE INDEX parcels_geom_idx ON parcels USING gist(geom);
CREATE INDEX parcels_owner_idx ON parcels(owner_id);
CREATE INDEX parcels_commune_idx ON parcels(commune_id);

CREATE TYPE cycle_status AS ENUM ('planned', 'growing', 'harvested', 'failed');

-- One planting of one crop on one parcel. Perennial crops have one cycle per campaign (that year's harvest).
-- A parcel is "active" when it has a cycle with status 'growing'.
CREATE TABLE crop_cycles (
  id                     serial PRIMARY KEY,
  parcel_id              int NOT NULL REFERENCES parcels(id),
  product_id             int NOT NULL REFERENCES products(id),   -- a product of kind 'crop'
  campaign_id            int NOT NULL REFERENCES campaigns(id),  -- campaign of the (expected) harvest date
  season                 smallint NOT NULL DEFAULT 1,            -- 1 or 2 (second rainy season in the south)
  sowing_date            date NOT NULL,                          -- planting date for perennials' plantation is not tracked
  expected_harvest_date  date NOT NULL,
  harvest_date           date,                                   -- set when harvested
  area_ha                numeric NOT NULL,                       -- cultivated area (≤ parcel area)
  harvested_kg           numeric,                                -- set when harvested (0 if failed)
  status                 cycle_status NOT NULL
);
CREATE INDEX crop_cycles_parcel_idx ON crop_cycles(parcel_id);
CREATE INDEX crop_cycles_campaign_idx ON crop_cycles(campaign_id, product_id);

-- ============================================================================
-- Flows (traceability). Dated events, aggregated when read.
-- ============================================================================

-- Programmes run for a campaign (subsidies, credit). Eligibility rules are coded in src/core/eligibility.ts.
CREATE TABLE programmes (
  id           serial PRIMARY KEY,
  code         text NOT NULL UNIQUE,      -- e.g. 'fertilizer_subsidy'
  name_fr      text NOT NULL,
  kind         text NOT NULL CHECK (kind IN ('subsidy', 'credit')),
  campaign_id  int NOT NULL REFERENCES campaigns(id),
  description  text NOT NULL
);

-- Inputs (fertiliser, seed, pesticide) received by an actor, possibly subsidised and/or on credit.
CREATE TABLE input_distributions (
  id                  serial PRIMARY KEY,
  recipient_id        int NOT NULL REFERENCES actors(id),   -- usually a farmer, sometimes a cooperative
  supplier_id         int REFERENCES actors(id),            -- distributor or cooperative that supplied it, if known
  product_id          int NOT NULL REFERENCES products(id), -- a product of kind 'input'
  campaign_id         int NOT NULL REFERENCES campaigns(id),
  programme_id        int REFERENCES programmes(id),        -- set when distributed under a programme
  date                date NOT NULL,
  quantity_kg         numeric NOT NULL,
  value_xof           numeric NOT NULL,                     -- full value of the inputs
  subsidized          boolean NOT NULL DEFAULT false,
  credit_amount_xof   numeric NOT NULL DEFAULT 0,           -- amount given on credit (0 if paid or free)
  repaid_amount_xof   numeric NOT NULL DEFAULT 0,
  repayment_status    text NOT NULL DEFAULT 'none' CHECK (repayment_status IN ('none', 'pending', 'repaid', 'partial', 'defaulted'))
);
CREATE INDEX input_distributions_recipient_idx ON input_distributions(recipient_id);
CREATE INDEX input_distributions_campaign_idx ON input_distributions(campaign_id, product_id);

-- Sales of a product from one actor to another (farmer → cooperative, farmer/cooperative → processor or distributor, processor → distributor).
CREATE TABLE transfers (
  id               serial PRIMARY KEY,
  from_actor_id    int NOT NULL REFERENCES actors(id),
  to_actor_id      int NOT NULL REFERENCES actors(id),
  product_id       int NOT NULL REFERENCES products(id),
  campaign_id      int NOT NULL REFERENCES campaigns(id),
  date             date NOT NULL,
  quantity_kg      numeric NOT NULL,
  unit_price_xof   numeric NOT NULL
);
CREATE INDEX transfers_from_idx ON transfers(from_actor_id);
CREATE INDEX transfers_to_idx ON transfers(to_actor_id);

-- A processor turning an input product into an output product (e.g. cassava → gari).
CREATE TABLE processing_batches (
  id                 serial PRIMARY KEY,
  processor_id       int NOT NULL REFERENCES actors(id),
  campaign_id        int NOT NULL REFERENCES campaigns(id),
  date               date NOT NULL,
  input_product_id   int NOT NULL REFERENCES products(id),
  input_kg           numeric NOT NULL,
  output_product_id  int NOT NULL REFERENCES products(id),
  output_kg          numeric NOT NULL
);
CREATE INDEX processing_batches_processor_idx ON processing_batches(processor_id);

-- Which incoming transfers a batch consumed: enables tracing a batch back to the farmers who supplied it.
CREATE TABLE processing_batch_inputs (
  batch_id     int NOT NULL REFERENCES processing_batches(id),
  transfer_id  int NOT NULL REFERENCES transfers(id),
  PRIMARY KEY (batch_id, transfer_id)
);

-- ============================================================================
-- Alerts
-- ============================================================================

CREATE TYPE alert_type AS ENUM ('general', 'weather', 'pest_disease', 'subsidy', 'market');

-- An alert sent by government officials to a set of farmers.
CREATE TABLE alerts (
  id               serial PRIMARY KEY,
  type             alert_type NOT NULL,
  title            text NOT NULL,
  body             text NOT NULL,
  audience_filter  jsonb NOT NULL,         -- the filters used to select recipients, for the record
  sent_at          timestamptz NOT NULL DEFAULT now()
);

-- Recipients are fixed at sending time.
CREATE TABLE alert_recipients (
  alert_id   int NOT NULL REFERENCES alerts(id),
  farmer_id  int NOT NULL REFERENCES actors(id),
  read_at    timestamptz,
  PRIMARY KEY (alert_id, farmer_id)
);
CREATE INDEX alert_recipients_farmer_idx ON alert_recipients(farmer_id);

-- ============================================================================
-- Computed data (refreshed periodically; here by the seed script)
-- ============================================================================

-- Farmer credit score for the current campaign: transparent scorecard, see src/core/scoring.ts.
CREATE TABLE credit_scores (
  farmer_id             int PRIMARY KEY REFERENCES actors(id),
  campaign_id           int NOT NULL REFERENCES campaigns(id),
  score                 int NOT NULL CHECK (score BETWEEN 0 AND 100),
  band                  char(1) NOT NULL CHECK (band IN ('A', 'B', 'C', 'D', 'E')),
  factors               jsonb NOT NULL,   -- [{key, label, points, max, detail}]
  estimated_income_xof  numeric NOT NULL, -- expected production of current cycles × reference price
  computed_at           timestamptz NOT NULL DEFAULT now()
);

-- Yield predictions per campaign, crop and department (simple trend baseline).
CREATE TABLE yield_predictions (
  id                      serial PRIMARY KEY,
  campaign_id             int NOT NULL REFERENCES campaigns(id),
  product_id              int NOT NULL REFERENCES products(id),
  department_id           int NOT NULL REFERENCES departments(id),
  predicted_yield_kg_ha   numeric NOT NULL,
  lower_kg_ha             numeric NOT NULL,
  upper_kg_ha             numeric NOT NULL,
  predicted_area_ha       numeric NOT NULL,  -- area of the campaign's registered cycles
  method                  text NOT NULL,
  generated_at            timestamptz NOT NULL DEFAULT now(),
  UNIQUE (campaign_id, product_id, department_id)
);

-- ============================================================================
-- Views
-- ============================================================================

-- Production, area and yield of harvested (and failed) cycles by campaign, crop and department.
CREATE VIEW yield_stats AS
SELECT
  cc.campaign_id,
  cc.product_id,
  c.department_id,
  count(*)                                   AS cycles,
  sum(cc.area_ha)                            AS area_ha,
  sum(coalesce(cc.harvested_kg, 0))          AS production_kg,
  sum(coalesce(cc.harvested_kg, 0)) / nullif(sum(cc.area_ha), 0) AS yield_kg_ha
FROM crop_cycles cc
JOIN parcels p ON p.id = cc.parcel_id
JOIN communes c ON c.id = p.commune_id
WHERE cc.status IN ('harvested', 'failed')
GROUP BY cc.campaign_id, cc.product_id, c.department_id;
