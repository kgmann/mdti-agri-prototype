# Working rules for AI agents

This repo is a prototype of Agri-Digit Bénin. Start with the [README](README.md), then the docs it links to.

## Ask, don't assume
- If something is unclear or a decision isn't obvious (scope, data model, product behaviour, anything hard to undo), ask the maintainer instead of guessing. List the options and your recommendation.
- Obvious, easily reversible implementation details don't need a question.

## Documentation
- Keep docs **short and durable**. Record what the system is and the decisions that shape it, with the reason in a sentence. Don't log session history, small choices, or anything the code already says clearly.
- Before adding text, check whether an existing sentence should be updated instead. Prefer editing over appending.
- Docs describe the system as it is. When a change makes a doc wrong, update the doc in the same change.
- Where things go: product behaviour in `docs/01-product-specs.md`, technical structure and decisions in `docs/02-system-architecture.md`, external contracts in `docs/03-integration.md`, conventions and limitations in `docs/04-misc-notes.md`. The database schema is documented by the comments in `db/init/02-schema.sql`.

## Code
- **No backward compatibility.** This is a prototype: change the schema, APIs and data freely. Don't add migrations, shims or deprecated paths; update the schema and reseed.
- Pages and API routes never query the database directly; they go through `src/core/`.
- Keep it simple: no new services, libraries or abstractions unless they clearly pay for themselves.
- The UI is in French; code, comments and docs are in English.
- Never commit secrets or real personal data. Synthetic identifiers stay in their fake ranges (see `docs/04-misc-notes.md`).

## Checks
- Before committing: `npm run lint` and `npm run build` must pass.
- After a schema change: reset the database and run `npm run seed`, then check the affected pages.
- Deployment constraints: a single VPS with Docker Compose (database, app, Caddy). Anything new must run in that setup.

## Git
- Work on the `dev` branch; `main` gets milestone merges.
- `temp/` is private and gitignored; never commit or reference its content.
