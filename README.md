# Agri-Digit Bénin — Prototype

A proof of concept of **Agri-Digit Bénin**, the multi-value-chain digital agriculture platform with an AI layer described in the Ministry of Agriculture's (MAEP) terms of reference. It was built in a very short time, runs on synthetic data, and aims to show the core ideas end to end rather than to be complete.

## Scope

The platform is built around one shared data core and three target users:

| Target | What they get |
|---|---|
| **Farmers** (primary actor) | A read-only view of their farm (parcels on a map, soil, current crop and status, weather), prominent government alerts, an AI assistant in French and Fon (text, voice, crop photo diagnosis), and their credit score and eligibility for programmes. |
| **Government officials** | A map-centred dashboard of the country's farms with filters, a searchable list of all actors (farmers, cooperatives, processors, distributors, banks, insurers), traceability of inputs, sales and processing, yield history and predictions, targeted alerts to farmers, and a plain-language data assistant. |
| **Banks** (partners) | Farmers ranked by credit score, with the evidence behind the score and an indicative lending ceiling computed from the bank's own policy. Conceptually this is an API service; the portal is a client of that API. |

Underneath is a small **core** ("tiny DPI"): the registries (actors, parcels, crop cycles), the flows between actors, and the shared logic (scoring, eligibility, search). Every portal goes through it, and the partner API is its public face.

What is explicitly out of scope (livestock, Bariba, SMS/USSD, payments, accounts, real national integrations…) and why is listed in the product specs.

## Try it

- Hosted prototype: `https://agriprototype.lucatakpa.com` (shared login provided separately).
- Local run: see [the architecture doc](docs/02-system-architecture.md#running-locally).

## Documentation

- [01 — Product specs](docs/01-product-specs.md): scope, priority tiers, out-of-scope items, and the functional specs of each portal.
- [02 — System architecture](docs/02-system-architecture.md): tech stack and why, code organisation, data model, AI features, security and deployment.
- [03 — Integration](docs/03-integration.md): contracts with the outside world: partner API, Gemini, Open-Meteo, datasets, and the national systems a real deployment would plug into.
- [04 — Misc notes](docs/04-misc-notes.md): conventions (identifiers, campaigns, units), a French–English glossary, notes on the synthetic data, and known limitations.
- [AGENTS.md](AGENTS.md): working rules for AI agents (and humans) contributing to this repo.

The docs are meant to be short and durable: they record what the system is and the decisions that shape it, not the history of how it was built.
