# Product specs

This document describes what the prototype does from a user's point of view. It is functional, not technical: the how is in the [architecture doc](02-system-architecture.md). The user interface is in French; the docs and code are in English.

## Scope

### Targets
The terms of reference describe a very broad platform. For the prototype I kept three targets, chosen to show the three sides of the system:

- **Farmers**: the primary actor, and the one the whole system must be useful to.
- **Government officials** (MAEP): the ones who steer the sector and need a bird's-eye view.
- **Banks**: an external partner consuming the data, to show that the platform is infrastructure others can build on.

Cooperatives, processors, distributors and insurers exist **as data only**: they appear in the government dashboard (lists, filters, flows) but have no portal of their own.

### Priority tiers
The tiers set the build order. Everything in **Must** makes a coherent demo on its own.

- **Must**
  - Data: registries, flows, campaigns and crop cycles on real administrative boundaries, with synthetic content; precomputed credit scores and yield predictions.
  - Government: farm map with filters and details; actor list with filters and detail pages; yield history and predictions; alerts to a filtered set of farmers.
  - Farmer: farm view (map, soil, crop and status, weather); prominent alerts; credit score and programme eligibility; AI assistant in French with crop photo diagnosis.
  - Bank: farmers ranked by score, with reasons and an indicative lending ceiling.
  - Deployment behind a shared login.
- **Should**
  - AI assistant in Fon (text).
  - Voice conversation with the assistant (French; Fon is experimental, see below).
  - Plain-language data assistant for officials.
  - Traceability views: flows on actor pages and filters by inputs and processed products.
- **Could**
  - Tracing a processed batch back to the farmers who supplied it.
  - Showing data assistant results on the map.
  - API tab in the bank portal with example requests.

### Out of scope
- **Livestock and fisheries.** They don't fit the "crop on a parcel" model (herds, vaccinations, ponds) and would double the data model. The catalogue and actor model are generic enough to add them later as another production unit.
- **Bariba** (and Yoruba, Dendi). Fon alone is enough to show the national-language layer.
- **SMS, USSD and offline channels**, **payments and marketplace**. Important for a real rollout, but each is a project of its own.
- **Farmers entering or updating data.** The farmer side is read-only; data is assumed to be captured by field agents and partners.
- **Accounts and permissions.** One shared login protects the whole prototype; portals use a "view as" selector.
- **Real integrations** with national systems (ANIP/NPI, DGI/IFU, X-Road, METEO-Bénin). They are described in the [integration doc](03-integration.md) but not connected.
- **Validating AI quality.** Answers, diagnoses and translations are not benchmarked.

## Functional specs

### Access and landing page
The whole site is behind a single shared login (HTTP basic auth). The landing page briefly presents the prototype and offers three entry points: Farmer, Government, Bank. There is no account creation.

### Farmer portal
The farmer portal is a responsive web app that works on a phone. The farmer first picks who they are from a short list of demo farmers (a "view as" selector), chosen to show different situations (active alert, eligible or not, Fon speaker…).

- **My farm.** A map of the farmer's parcels over a satellite or street basemap. For each parcel: area, land type, soil information, the current crop cycle (crop, sowing date, expected harvest, status) and the last harvests. A weather card shows the current conditions and a short forecast for the farm's location.
- **Alerts.** Alerts sent by the government appear prominently (a banner and a badge) until the farmer opens them. Each alert has a type (general, weather, pests and diseases, subsidy, market), a title and a text.
- **Assistant.** A chat with an AI agronomy assistant, in French or Fon. The assistant knows the farmer's context (location, parcels, crops and their stage, soil, weather, recent alerts) and answers as an extension agent would, directly to the farmer. The farmer can attach a photo of a plant to get a diagnosis: likely problem, severity and what to do. The farmer can also talk instead of typing and hear the answer. Fon voice output is labelled experimental because the speech model does not officially support Fon.
- **Credit and programmes.** The farmer's credit score (0–100 and a band from A to E) with the main reasons behind it, and their eligibility for the current campaign's programmes (e.g. fertiliser subsidy, campaign credit), each with the reason when not eligible. The farmer also sees whether they share their data with partners.

### Government dashboard
- **Map.** A map of Bénin with department and commune boundaries and all registered parcels. At country scale parcels show as dots; zooming in shows their outlines. Parcels are coloured by crop (or by status). A filter panel narrows the map by department, commune, crop, active or not, area range, owner type, cooperative, and inputs received. Clicking a parcel shows its owner, area, soil, crop and status, with a link to the owner's page.
- **Alerts.** From the same filters, the official can send an alert to all farmers who match: they choose a type, a title and a text, see how many farmers will receive it, and send. Recipients are fixed at the time of sending. A list shows past alerts with their audience size and how many recipients have read them.
- **Actors.** A searchable, filterable list of all actors: farmers, cooperatives, processors, distributors, banks and insurers. Each actor has a page with its identity (NPI or IFU), location and, depending on its type: parcels and crop history, cooperative members, inputs received, and its flows (what it bought, from whom, what it sold or processed, to whom).
- **Traceability.** Flows are recorded as dated events: inputs distributed, sales between actors and processing batches (e.g. cassava into gari). They appear on actor pages and can be used as filters (e.g. farmers who received NPK this campaign, processors producing gari). Optionally, a processing batch can be traced back to the farmers who supplied it.
- **Yields and predictions.** Production, area and yield per campaign, crop and department, as charts and tables, plus the predicted yield for the current campaign. Predictions are computed periodically, not on demand.
- **Data assistant.** Officials can ask questions in plain language (e.g. "which cooperatives supply the processors in Zou?"). The assistant turns the question into a read-only database query, runs it and shows both the query and the results.

### Bank portal
The bank first picks which bank it is. It then sees:

- **Ranked farmers.** Farmers who agreed to share their data with partners, ranked by credit score, with filters (department, crop, minimum score). For each farmer: score and band, the main factors, estimated income for the current campaign, and an **indicative lending ceiling**.
- **Farmer details.** Identity, parcels and areas, production and repayment history, and the factors behind the score.
- The lending ceiling is computed from **the bank's own policy** (the share of estimated income it is willing to lend, adjusted by score band and capped), shown on the page. Two banks can offer different ceilings to the same farmer: the platform provides the evidence, the lender makes the decision.
- The portal uses the same partner API a bank would integrate with (see the [integration doc](03-integration.md)).

### Other details
- **Identifiers.** Farmers are identified by their NPI, organisations by their IFU (see [misc notes](04-misc-notes.md#identifiers)).
- **Campaigns.** All statistics are organised by agricultural campaign (e.g. 2025-2026); see [misc notes](04-misc-notes.md#campaigns-and-crop-cycles).
- **Currency and units.** Amounts in CFA francs (XOF), quantities in kilograms or tonnes, areas in hectares.
- **Data.** Administrative boundaries are real; all actors, parcels, flows and histories are synthetic.
