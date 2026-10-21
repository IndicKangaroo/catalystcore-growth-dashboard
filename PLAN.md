# CatalystCore Growth Analytics: Build Plan

Source of truth for scope: `CatalystCore_Growth_Analytics_Dashboard_Requirements.md` (the PRD). This plan says *how* we build V1. Choices and their reasons live in `DECISIONS.md`. Rules for AI agents live in `AGENTS.md`.

Status legend: `[ ]` todo, `[~]` in progress, `[x]` done.

---

## 1. What we are building

An internal dashboard that answers: **which content and campaigns are contributing to real product growth?**

Funnel: Content → Traffic → Acquisition → Users → Engagement → Retention → Revenue.

It is not a Firebase viewer. It joins Firebase/GA4 app analytics with manually entered social content and campaign tracking links, and it is strict about the difference between **measured**, **inferred** and **manual** numbers.

## 2. Principles (non-negotiable)

1. **Provenance on every number.** Each metric that relates to attribution carries `measured | inferred | manual`. Headline attribution counts are measured only.
2. **No illustrative numbers shown as real.** Seed data is allowed in dev only and is visibly labeled "Demo data".
3. **Timeline is for investigation.** It never claims an event caused a spike.
4. **Data-provider interface.** The UI and API never call Google directly; they call a provider (`seed` or `ga4`). Play Console, AdMob and social APIs plug in later without UI changes.
5. **Roles enforced on the server**, not only hidden in the UI.
6. **Template-ready, studio-neutral.** One deployment serves one studio. No studio name, app name, logo or color is hard-coded; they come from the `settings/studio` document and the `apps` collection (D-019). CatalystCore is simply the first studio configured.

## 3. Stack

| Layer | Choice |
| --- | --- |
| Frontend | React + TypeScript, Vite, Tailwind CSS, Recharts, TanStack Query, React Router |
| Backend | Node.js + Express + TypeScript |
| Database | Firestore (via Firebase Admin SDK) |
| Auth | Firebase Authentication (Google sign-in); roles and the active flag live in the Firestore `users` collection (D-021) |
| Analytics | GA4 Data API (`@google-analytics/data`) via service account |
| Validation | Zod, shared between web and api |
| Repo layout | npm workspaces monorepo |
| Hosting (proposed, D-017) | Web on Firebase Hosting; API on Cloud Run behind a Firebase Hosting rewrite; nightly sync via Cloud Scheduler |

## 4. Repo layout

```
catalystcore-growth/
  PLAN.md  DECISIONS.md  AGENTS.md  README.md
  docs/PRD.md                      # copy of the requirements doc
  docs/design/                     # the requester's UI design export (D-030)
  apps/
    web/                           # React app
      src/
        app/ (router, providers, layout)
        features/ (overview, apps, app-detail, acquisition, campaigns,
                   content, comparison, timeline, revenue, reports, settings)
        components/ (ui kit, charts, ProvenanceBadge, FilterBar)
        lib/ (api client, format, theme)
    api/
      src/
        routes/ (me, users, apps, metrics, acquisition, campaigns, links,
                 posts, events, reports, r)       # r = click redirect
        providers/ (types.ts, seed/, ga4/)
        services/ (attribution, retention, reports, csv, pdf)
        middleware/ (auth + requirePermission, validate, errors)
        lib/ (firebase, config, logger)
  packages/
    shared/                        # Zod schemas, types, enums, formatters
  firestore.rules
  firestore.indexes.json
  .env.example
```

## 5. Data model (Firestore)

All documents carry `createdAt`, `updatedAt`, `createdBy`. A single `settings/studio` document holds studio name, logo URL, accent color, timezone, currency, default date range and `schemaVersion` (used for upgrades).

| Collection | Key fields |
| --- | --- |
| `users` | email (the document id, lowercase), name, role (`admin` / `growth` / `developer`), active, uid (null until first sign-in), lastLoginAt |
| `apps` | name, packageName, iconUrl, ga4PropertyId, firebaseProjectId, playStoreUrl, launchDate, category, currentVersion, status (`development` / `testing` / `production`) |
| `campaigns` | name, appId, utmCampaign (unique slug), objective, startDate, endDate, status, notes |
| `trackingLinks` | campaignId, appId, platform, utmSource, utmMedium, utmCampaign, utmContent, destination (Play URL), builtUrl, shortCode (optional), createdBy |
| `socialPosts` | platform, contentType, appId, campaignId, trackingLinkId, publishDate, url, categoryTags[], views, likes, comments, shares, saves, clicks, metricsSource (`manual` / `api`), metricsUpdatedAt |
| `timelineEvents` | appId (or `all`), date, type (`post` / `campaign` / `release` / `feature` / `ad` / `other`), title, note, refId |
| `reports` | weekStart, weekEnd, generatedBy, snapshot (JSON), pdfPath, csvPath |
| `metricSnapshots` | appId, date, metric values (cache of daily GA4 pulls) |
| `linkClicks` (optional, see D-009) | trackingLinkId, ts, coarse referrer, user-agent class |

Enums live in `packages/shared` and are the only definition: platforms, content types, categories, provenance, roles, statuses.

## 6. Provider interface

```ts
// As built in P2 (D-033). PeriodQuery = { period: DateRange; today: string }.
// ProviderQuery = PeriodQuery & { apps: AppRecord[] }: the caller looks the apps up; a provider never reads the database.
interface AnalyticsProvider {
  readonly name: AnalyticsProviderName;                                  // 'seed' | 'ga4'
  getOverview(q: ProviderQuery): Promise<Overview>;
  getTimeSeries(q: ProviderQuery, metric: Metric): Promise<Series>;
  getAppUsers(app: AppRecord, q: PeriodQuery): Promise<AppUsers>;       // DAU, WAU, MAU(28d), new, returning, sessions, engagement
  getRetention(app: AppRecord, q: PeriodQuery): Promise<Retention>;     // D1/D7/D14/D30 + cohort rows
  getAcquisition(q: ProviderQuery): Promise<Acquisition>;               // each row has provenance
  getCampaignUsers(app: AppRecord, utm: UtmKey, q: PeriodQuery): Promise<CampaignOutcome>; // attributed → engaged → retained
}
```

Every answer carries `source`, and a number that cannot be given is a state (`not_connected`, `no_measured_attribution`, `not_enough_data`, `in_progress`), never zero. The shapes are Zod schemas in `packages/shared/src/analytics.ts`.

`seed` provider: deterministic made-up data, labeled "Demo data" (D-036); it never invents installs or revenue. `ga4` provider: GA4 Data API reports (see DECISIONS D-004 to D-007); selecting it before P4 stops the API at start-up. A future `playConsole` / `admob` provider implements `getRevenue` etc.

## 7. API surface (all under `/api`, Firebase ID token required)

| Area | Endpoints | Roles |
| --- | --- | --- |
| Apps | `GET/POST /apps`, `GET/PATCH/DELETE /apps/:id` (delete answers 204; D-034) | read: all; write: admin |
| Metrics | `GET /metrics/overview`, `/metrics/series`, `/apps/:id/users`, `/apps/:id/retention` | all |
| Acquisition | `GET /acquisition` | admin, growth, developer |
| Campaigns | CRUD `/campaigns` | admin, growth |
| Links | `POST /links/build`, CRUD `/links` | admin, growth |
| Posts | CRUD `/posts`, `POST /posts/import` (CSV) | admin, growth |
| Comparison | `GET /compare/apps?ids=`, `GET /compare/campaigns` | all |
| Timeline | CRUD `/events`, `GET /timeline` | read: all; write: admin, growth |
| Reports | `POST /reports/generate`, `GET /reports`, `GET /reports/:id/(pdf\|csv)` | admin, growth |
| Session | `GET /me` (who the caller is and their permissions) | any signed-in user |
| Settings | `GET /settings/studio` (`{ settings, configured }`, D-035); editing arrives in P10 | all |
| Health | `GET /health` (`{ status, provider }`, so the web app can label demo data) | public |
| Users | `GET /users`, `POST /users` (invite), `PATCH /users/:email` (role, active) | admin |
| Redirect | `GET /r/:code` (public, no auth) | public |

Global query params on every read: `from`, `to`, `appIds`, `platform`, `campaignId`, `contentType`.

## 8. Screens

1. **Overview**: KPI row, funnel strip, users/new users/sessions/attributed chart (with compare-to-previous), acquisition summary, recent events.
2. **Apps**: list and add/edit (admin), Firebase/GA4 connection test.
3. **App detail**: DAU/WAU/MAU, new/returning, sessions, engagement, growth chart with timeline markers, retention D1/7/14/30, cohort heatmap.
4. **Acquisition**: sources table with provenance badge per row; measured vs inferred vs manual split; link to the tracking guide.
5. **Campaigns**: list, detail (links, posts, clicks → attributed → engaged → retained), notes.
6. **Tracking link builder**: UTM form, Play Store `referrer` encoding, copy, QR optional.
7. **Content**: post list/entry/CSV import, post detail, category comparison.
8. **Comparison**: 2-5 apps, and social → app view.
9. **Growth timeline**: growth chart overlaid with events, add notes.
10. **Revenue**: placeholder that shows "Not connected" until a provider exists.
11. **Reports**: weekly report preview, generate, download PDF/CSV.
12. **Settings**: users and roles (admin), theme, connections status.

Global: filter bar (date range, app, platform, campaign, content type) synced to the URL (D-031); light/dark toggle. Built in P2: the date range and the app chips; platform, campaign and content type arrive with the screens that use them.

## 9. UI direction

**Source of truth: the requester's design export in `docs/design` (D-030).** It decides the look and the shell; the PRD decides what is in V1. The notes below are the earlier defaults and still hold where the design is silent.

- **Look:** calm, dense-but-readable analytics UI. Neutral slate surfaces, one accent (indigo), generous whitespace, thin borders, no glow or gradient decoration.
- **Themes:** light and dark via CSS variables on `:root` / `[data-theme]`; toggle at the foot of the left rail (D-038); respects `prefers-color-scheme`; saved in localStorage.
- **Type:** Inter for UI, JetBrains Mono (or tabular-nums Inter) for numbers.
- **Provenance is never color alone.** Measured: solid filled badge with a check icon. Inferred: outlined badge with a dashed border and "~" icon, and hatched chart fill. Manual: neutral badge with a pencil icon.
- **Charts:** Recharts, shared theme tokens, colorblind-safe series palette, event markers on the timeline as vertical rules.
- **Empty and error states:** "Not connected", "Not enough data yet" and "In progress" (for cohorts whose window hasn't ended) are explicit states, never zeros.

## 10. Build phases

Each phase ends with something runnable and a `DECISIONS.md` update if a choice was made.

- [x] **P0. Foundations**: monorepo, TS configs, lint/format, shared package, env handling, CI (typecheck, lint, test). Merged to `main` with `package-lock.json`; CI green; the requester confirmed the app runs locally and the web page reaches the API.
- [x] **P1. Auth and roles**: Google sign-in through Firebase Auth, invite-only users stored in Firestore (role and active flag checked on every request, D-021), permission matrix shared by API and web (D-025), API auth and permission middleware, user admin screen, deny-all Firestore rules (D-022), emulator setup for local development (D-023). Branch `p1-auth` (PR #3). Sign-in is tested against the real emulators in CI (D-026), setup mistakes answer with what to change (D-027), and the Users screen tolerates documents it did not write and the README requires a Firebase project of its own (D-028). The requester signed in with Google against a real project on 2026-10-13 and the lockfile is committed. Merged on 2026-10-14 (PR #3, both CI jobs green) after the requester tested the app locally. Splitting the Firebase project is deferred to production (D-029, section 13).
- [x] **P2. Apps and shell**: app CRUD (D-034), the shell from the requester's design with a light, dark or system theme (D-037, D-038), the date range and app filters synced to the URL (D-031, D-032), the studio's settings read from `settings/studio` (D-035), the analytics provider interface with the labelled seed provider (D-033, D-036), and an Overview that shows the data source, the number of apps and the current view (charts come in P3). Branch `p2-apps-shell` (PR #4); typecheck, ESLint, Prettier, tests, build and the emulator tests are green in CI. Left out on purpose: the design's revenue, quality and benchmark panels, and the controls that need a later feature (`docs/design/README.md`). Merged on 2026-10-17 (PR #4) after the requester tested it locally.
- [~] **P3. Overview and App detail on seed data**: the metrics API (overview, series, an app's users and retention, D-041); the Overview with six key numbers, the growth chart and the apps in view; App detail (`/apps/:appId`) with DAU, WAU, MAU, new and returning users, sessions, engagement, growth, retention and the cohort heatmap; `ProvenanceBadge`, a "Demo data" label taken from each answer's `source`, and the previous-period comparison (D-039, proposed). Branch `p3-overview-app-detail` (PR #5); typecheck, ESLint, Prettier, tests, build, the lockfile and the emulator tests are green in CI. Not yet done: the requester trying it locally, answering D-039 and what the app chips should do on App detail (D-040), and a phone menu button and drawer, which the menu does not need yet (three screens, D-037).
- [ ] **P4. GA4 provider**: service-account auth, users/sessions/engagement, retention, acquisition by source, caching in `metricSnapshots`, connection test. Verified by the user against real properties.
- [ ] **P5. Campaigns, links and posts**: UTM builder, campaign/post CRUD, CSV import, content categories. Also: refuse to delete an app that campaigns, links or posts refer to, or replace deleting with an "archived" status (D-034).
- [ ] **P6. Attribution views**: clicks → attributed → engaged → retained per campaign; acquisition screen with provenance; social ↔ app comparison.
- [ ] **P7. Timeline, comparison and notes**: event overlay, 2-5 app comparison.
- [ ] **P8. Reports**: weekly report, PDF and CSV export.
- [ ] **P9. Hardening**: role tests, error states, accessibility pass, performance (caching, pagination), deployment docs.
- [ ] **P10. Template packaging** (after V1 works for CatalystCore): `docs/SETUP.md` (create Firebase project, enable Auth and Firestore, GA4 service account and Viewer access, deploy), a one-command `npm run setup` (checks env, deploys Firestore rules and indexes, creates the first admin), a "Demo mode" that runs on the seed provider so a studio can try it before connecting GA4, a studio settings screen (name, logo, accent, timezone, currency, usual date range; until then the `settings/studio` document is made by hand, D-035), a generic README with no CatalystCore references, a Firestore `schemaVersion` plus migration script for upgrades, a license and a versioned changelog (Q8).

V1 Definition of Done is PRD section 25; P0-P9 together must satisfy every item there.

## 11. Testing

- Unit: attribution classification, UTM encoding, retention math, CSV export (Vitest).
- API: route tests with a fake provider and Firestore emulator; role matrix tests.
- Web: component tests for provenance badges and filter sync; a few Playwright flows (login, add app, build link, generate report).
- GA4 provider: contract tests against recorded fixtures, plus a manual verification script the user runs against real properties.

## 12. Open questions (need your answer)

| # | Question | Status |
| --- | --- | --- |
| Q1 | Final list of apps for the first release? | **Answered 2026-10-11:** four apps ready (Grind Quest, PDF & Image Toolkit, ID Photo Maker, Bulk File Renamer). Others added later through the UI. |
| Q2 | Do all apps have GA4 properties with the service account added as Viewer? | **Answered:** yes. Still verified by `ga4:check` in P4. |
| Q3 | Build the click-counting redirect (D-009)? | **Open.** Not answered; default is yes in P5. |
| Q4 | Hosting for the API? | **Proposed:** Firebase Hosting (web) + Cloud Run (API). See D-017. Render stays as the fallback. |
| Q5 | Currency (INR) and timezone (Asia/Kolkata)? | **Open.** Not answered; defaults stand (D-014). |
| Q6 | Users and first admins? | **Answered:** about 5 users checking daily; the requester is the first admin (the email in the `ADMIN_EMAIL` env variable becomes the first admin on first sign-in, D-021). |
| Q7 | The "pitch to other studios" direction: hosted product, or a template each studio deploys itself? | **Answered 2026-10-11:** a template each studio deploys itself. No multi-tenancy. See D-019. |
| Q8 | How will the template be distributed and licensed (private repo per customer, paid license, open source)? | **Open.** Deferred to P10 at the requester's request. |
| Q9 | Sign-in method, and which Firebase project the dashboard will run against? | **Assumed:** Google sign-in only; local development on the Firebase emulators. The real project ID is needed only at deploy time. Confirm or change. |

## 13. Before production (reminders)

Things the requester chose to do later (D-029). Do not tick these off silently: the requester confirms each one. At the start of P4, ask whether the first item should be done before real GA4 numbers are stored.

- [ ] **Give the dashboard a Firebase project of its own.** Create it, enable Google sign-in and Firestore, and set the `FIREBASE_*` and `VITE_FIREBASE_*` values and the service account key in `.env`, as the README describes. Sign in again; the first admin is created from `ADMIN_EMAIL`.
- [ ] **Clean up the project that was shared during development.** Remove the dashboard's documents (the ones in `users`, and any later collection such as `apps`) and the Firebase Auth accounts that came from signing in to the dashboard. Leave everything else in that project alone.
- [ ] **Review the Firestore rules of every project the dashboard has touched.** Read each `match` block: matching rules are OR-ed, so a catch-all `match /{document=**}` that allows access overrides stricter rules above it. Fix the project's own rules before any real data goes in.
- [ ] **Deploy the dashboard's deny-all `firestore.rules` (D-022) only to the dashboard's own project.** Deploying them to a project that an app uses would lock the app out of its data.
- [ ] **Check the README's setup steps on the new project from a clean checkout**, and add the production web address to Firebase Authentication's authorized domains.
