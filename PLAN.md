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
6. **Workspace-ready, studio-neutral.** Every document carries a `workspaceId`, and no studio name, app name or branding is hard-coded (D-016). V1 runs one workspace (CatalystCore).

## 3. Stack

| Layer | Choice |
| --- | --- |
| Frontend | React + TypeScript, Vite, Tailwind CSS, Recharts, TanStack Query, React Router |
| Backend | Node.js + Express + TypeScript |
| Database | Firestore (via Firebase Admin SDK) |
| Auth | Firebase Authentication, roles as custom claims |
| Analytics | GA4 Data API (`@google-analytics/data`) via service account |
| Validation | Zod, shared between web and api |
| Repo layout | npm workspaces monorepo |
| Hosting (proposed, D-017) | Web on Firebase Hosting; API on Cloud Run behind a Firebase Hosting rewrite; nightly sync via Cloud Scheduler |

## 4. Repo layout

```
catalystcore-growth/
  PLAN.md  DECISIONS.md  AGENTS.md  README.md
  docs/PRD.md                      # copy of the requirements doc
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
        routes/ (apps, metrics, acquisition, campaigns, links, posts,
                 events, reports, users, r)       # r = click redirect
        providers/ (types.ts, seed/, ga4/)
        services/ (attribution, retention, reports, csv, pdf)
        middleware/ (auth, role, validate, errors)
        lib/ (firebase, config, logger)
  packages/
    shared/                        # Zod schemas, types, enums, formatters
  firestore.rules
  firestore.indexes.json
  .env.example
```

## 5. Data model (Firestore)

All documents carry `workspaceId`, `createdAt`, `updatedAt`, `createdBy`. A `workspaces` collection holds name, branding and timezone (V1 has one document).

| Collection | Key fields |
| --- | --- |
| `users` | uid, email, name, role (`admin` / `growth` / `developer`), active |
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
interface AnalyticsProvider {
  getOverview(q: Query): Promise<Overview>;
  getTimeSeries(q: Query & { metric: Metric }): Promise<Series>;
  getAppUsers(appId: string, q: Query): Promise<AppUsers>;      // DAU, WAU, MAU(28d), new, returning, sessions, engagement
  getRetention(appId: string, q: Query): Promise<Retention>;    // D1/D7/D14/D30 + cohort rows
  getAcquisition(q: Query): Promise<AcquisitionRows>;           // each row has provenance
  getCampaignUsers(utm: UtmKey, q: Query): Promise<CampaignOutcome>; // attributed → engaged → retained
}
```

`seed` provider: deterministic fake data, labeled. `ga4` provider: GA4 Data API reports (see DECISIONS D-004 to D-007). A future `playConsole` / `admob` provider implements `getRevenue` etc.

## 7. API surface (all under `/api`, Firebase ID token required)

| Area | Endpoints | Roles |
| --- | --- | --- |
| Apps | `GET/POST /apps`, `GET/PATCH/DELETE /apps/:id` | read: all; write: admin |
| Metrics | `GET /metrics/overview`, `/metrics/series`, `/apps/:id/users`, `/apps/:id/retention` | all |
| Acquisition | `GET /acquisition` | admin, growth, developer |
| Campaigns | CRUD `/campaigns` | admin, growth |
| Links | `POST /links/build`, CRUD `/links` | admin, growth |
| Posts | CRUD `/posts`, `POST /posts/import` (CSV) | admin, growth |
| Comparison | `GET /compare/apps?ids=`, `GET /compare/campaigns` | all |
| Timeline | CRUD `/events`, `GET /timeline` | read: all; write: admin, growth |
| Reports | `POST /reports/generate`, `GET /reports`, `GET /reports/:id/(pdf\|csv)` | admin, growth |
| Users | `GET/PATCH /users` | admin |
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

Global: filter bar (date range, app, platform, campaign, content type) synced to the URL; light/dark toggle.

## 9. UI direction (proposal)

- **Look:** calm, dense-but-readable analytics UI. Neutral slate surfaces, one accent (indigo), generous whitespace, thin borders, no glow or gradient decoration.
- **Themes:** light and dark via CSS variables on `:root` / `[data-theme]`; toggle in the header; respects `prefers-color-scheme`; saved in localStorage.
- **Type:** Inter for UI, JetBrains Mono (or tabular-nums Inter) for numbers.
- **Provenance is never color alone.** Measured: solid filled badge with a check icon. Inferred: outlined badge with a dashed border and "~" icon, and hatched chart fill. Manual: neutral badge with a pencil icon.
- **Charts:** Recharts, shared theme tokens, colorblind-safe series palette, event markers on the timeline as vertical rules.
- **Empty and error states:** "Not connected", "Not enough data yet" and "In progress" (for cohorts whose window hasn't ended) are explicit states, never zeros.

## 10. Build phases

Each phase ends with something runnable and a `DECISIONS.md` update if a choice was made.

- [ ] **P0. Foundations**: monorepo, TS configs, lint/format, shared package, env handling, CI (typecheck, lint, test).
- [ ] **P1. Auth and roles**: Firebase Auth login, custom claims, API auth + role middleware, user admin, Firestore rules.
- [ ] **P2. Apps and shell**: app CRUD, layout, theme toggle, filter bar with URL sync, provider interface + seed provider.
- [ ] **P3. Overview and App detail on seed data**: KPIs, charts, retention, cohort heatmap, provenance components.
- [ ] **P4. GA4 provider**: service-account auth, users/sessions/engagement, retention, acquisition by source, caching in `metricSnapshots`, connection test. Verified by the user against real properties.
- [ ] **P5. Campaigns, links and posts**: UTM builder, campaign/post CRUD, CSV import, content categories.
- [ ] **P6. Attribution views**: clicks → attributed → engaged → retained per campaign; acquisition screen with provenance; social ↔ app comparison.
- [ ] **P7. Timeline, comparison and notes**: event overlay, 2-5 app comparison.
- [ ] **P8. Reports**: weekly report, PDF and CSV export.
- [ ] **P9. Hardening**: role tests, error states, accessibility pass, performance (caching, pagination), deployment docs.

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
| Q6 | Users and first admins? | **Answered:** about 5 users checking daily; the requester is the first admin (email set via `ADMIN_EMAIL` env for `seed:admin`). |
| Q7 | The "pitch to other studios" direction: paid hosted product, or a template each studio deploys itself? | **Open.** See D-016. Decides how much multi-tenancy we build. |
