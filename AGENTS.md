# AGENTS.md: Instructions for AI coding agents

This repo is the CatalystCore Growth Analytics dashboard. Read this file first, then `PLAN.md` and `DECISIONS.md`. The PRD is in `docs/PRD.md`.

## Start of every session

1. Read `AGENTS.md`, `PLAN.md` (find the current phase), `DECISIONS.md`.
2. Run `git status` and `git log -5` to see where things stand.
3. Work on the current phase only. If a task needs a decision that isn't logged, ask the user or log it as `proposed` in `DECISIONS.md`.

## End of every session

1. Update checkboxes and status in `PLAN.md`.
2. Add or amend entries in `DECISIONS.md` (append; never rewrite history).
3. Make sure typecheck, lint and tests pass. Summarize what changed and what is next.

## Product rules (must never be broken)

- **Provenance:** attribution data is `measured`, `inferred` or `manual`. Never present inferred or manual figures as confirmed attribution. Headline attribution = measured only.
- **No fake numbers in production paths.** Seed data exists only in the `seed` provider and must be visibly labeled "Demo data". Do not hard-code sample figures in components.
- **No causal claims.** Timeline and correlation features use wording like "observed", "possible" or "correlated", never "caused", "verified" or "100%".
- **Missing data is a state, not zero.** Use "Not connected", "No measured attribution available", "In progress" or "Not enough data".
- **Secrets:** the service account key and any credentials live only in backend env. Never log them, commit them, return them from the API, or put them in web code. `.env` is git-ignored; only `.env.example` is committed, with names and no values.
- **Server-side authorization:** every API route checks auth and role. Do not rely on hidden buttons.
- **Template-ready (D-019):** this codebase will be deployed by other studios. Never hard-code a studio name, app name, logo, color, timezone or currency; read them from `settings/studio` and the `apps` collection. Do not add tenant or workspace fields: one deployment is one studio. Schema changes need a `schemaVersion` bump and a migration.

## Tech and structure

- Monorepo (npm workspaces): `apps/web` (React, TS, Vite, Tailwind, Recharts, TanStack Query), `apps/api` (Express, TS, Firebase Admin, GA4 Data API), `packages/shared` (Zod schemas, enums, types).
- Types and enums are defined once in `packages/shared`. Do not redefine them in web or api.
- Analytics reads go through `AnalyticsProvider` (`apps/api/src/providers`). Routes and services never import the GA4 client directly.
- Add a new data source by implementing a provider; do not branch on source inside UI components.

## Commands (update here if they change)

```
npm install                 # install all workspaces
npm run dev                 # web + api in watch mode
npm run dev:web | dev:api   # one side only
npm run typecheck           # tsc across workspaces
npm run lint                # eslint + prettier check
npm run test                # vitest
npm run test:e2e            # playwright (needs emulators)
npm run emulators           # firebase auth + firestore emulators
npm run seed:admin          # create the first admin user
npm run ga4:check -- <propertyId>   # verify service account access to a GA4 property
npm run build               # build all
```

## Code conventions

- TypeScript strict mode; no `any` without a comment explaining why.
- Validate every request body, query and env with Zod. Return consistent errors: `{ error: { code, message } }`.
- Prefer small pure functions for metric math (retention, attribution classification) with unit tests.
- Frontend: feature folders; server state via TanStack Query; filters live in the URL query string.
- Styling: Tailwind with CSS-variable tokens for both themes. No hard-coded colors; check light and dark.
- Components that show attribution must use `ProvenanceBadge`. Charts use the shared theme and colorblind-safe palette.
- Accessibility: keyboard reachable controls, visible focus, labels on inputs, contrast in both themes, information never conveyed by color alone.
- Dates: store UTC ISO strings; day bucketing uses `Asia/Kolkata` (see D-014).
- Commits: small, imperative subject (`Add tracking link builder`), one concern each. Do not commit generated files or secrets.

## Testing expectations

- New metric or attribution logic requires unit tests.
- New route requires a test for the allowed and the forbidden role.
- GA4 provider changes require updating fixtures and running `ga4:check` against a real property (ask the user to run it if you cannot reach Google).
- Do not mark a phase complete in `PLAN.md` until its checks pass.

## When unsure

- Scope question: check the PRD (V1 scope is section 21, Definition of Done is section 25). If something isn't in V1, don't build it; note it under V2 in `PLAN.md`.
- Ambiguous requirement: ask the user. Offer a default and say what it assumes.
- Don't add dependencies lightly; note any new one and why in the commit message or `DECISIONS.md`.
