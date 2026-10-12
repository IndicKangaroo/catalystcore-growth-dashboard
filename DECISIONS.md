# Decisions Log

Append-only. When a decision changes, add a new entry that supersedes the old one; do not edit history.
Format: ID, date, status (`accepted` / `proposed` / `superseded`), context, decision, consequences.

---

## D-001: Scope is the PRD's V1; the mockups are reference only
- **Date:** 2026-10-11 · **Status:** accepted
- **Context:** The user shared four mock screens plus the PRD. The mocks contain demo numbers and features beyond V1 (AdMob/Play revenue, estimated CAC, "Install Referrer SDK ready" claims, extra apps).
- **Decision:** The PRD is the source of truth. The mocks inform concepts (funnel, acquisition matrix, app detail with cohorts, timeline). We redesign the UI.
- **Consequences:** Revenue and CAC are not built in V1. Anything from the mocks needs a PRD basis to be added.

## D-002: Every attribution number carries provenance
- **Date:** 2026-10-11 · **Status:** accepted
- **Context:** PRD sections 7, 9, 24, 25 require measured attribution to be distinguished from inference.
- **Decision:** Enum `measured | inferred | manual` on all attribution data in API responses and UI. Headline "attributed users" = measured only. Inferred is displayed separately with its own badge and never summed into a headline silently.
- **Consequences:** The mocks' "Social Attrib 1,284" (measured + inferred) and "Verified Correlation" labels are not carried over. If we show inferred figures at all, the label is "Possible" or "Correlated", never "Verified".

## D-003: Data-provider interface with seed and GA4 providers
- **Date:** 2026-10-11 · **Status:** accepted
- **Context:** The build sandbox may not reach Google APIs; the service account lives with the user.
- **Decision:** All analytics reads go through `AnalyticsProvider`. A deterministic `seed` provider (labeled "Demo data" in the UI) is used for development and tests. The `ga4` provider is selected by env var.
- **Consequences:** The UI can be built and reviewed before real data is connected. The GA4 provider is verified by the user against real properties (P4).

## D-004: GA4 Data API with a service account
- **Date:** 2026-10-11 · **Status:** accepted
- **Context:** The user has a service account. Firebase Analytics data is read through its linked GA4 property.
- **Decision:** Use `@google-analytics/data` (Data API v1). Each app stores its `ga4PropertyId`. The service account email must be added as a Viewer on every GA4 property. The key is supplied as an env secret on the backend only.
- **Consequences:** The key is never pasted into chat, committed, or sent to the browser. `.env.example` documents variable names only. A "Test connection" action on the app form calls a cheap report to verify access.

## D-005: "MAU" is GA4's 28-day active users
- **Date:** 2026-10-11 · **Status:** accepted
- **Context:** GA4 exposes 1-, 7- and 28-day active users, not a 30-day metric.
- **Decision:** DAU = `active1DayUsers`, WAU = `active7DayUsers`, MAU = `active28DayUsers`. The UI labels the last one "MAU (28-day)" in tooltips and exports.
- **Consequences:** Numbers will differ slightly from a calendar-month MAU. Documented so nobody "fixes" it.

## D-006: Retention comes from GA4 cohort reports
- **Date:** 2026-10-11 · **Status:** accepted
- **Context:** PRD needs D1/D7/D14/D30 retention and cohort visualization where practical.
- **Decision:** Use the Data API `cohortSpec` with weekly install cohorts (by `firstSessionDate`) and daily cohort retention. Cohorts whose window has not ended are shown as "In progress", never as 0%.
- **Consequences:** Cohort heatmap is included in V1 for app detail. Retention for a single campaign depends on D-007.

## D-007: What counts as "measured" attribution
- **Date:** 2026-10-11 · **Status:** proposed (needs verification on real data in P4)
- **Context:** GA4 for Android apps records campaign source/medium/campaign from the Play Install Referrer when the Play Store link carries a `referrer` parameter, and from `campaign_details` events for deep links.
- **Decision:** **Measured** = users whose first-user (or session) campaign dimensions match a registered campaign's UTM values (`firstUserSource`, `firstUserMedium`, `firstUserCampaignName`, `firstUserManualAdContent`). **Inferred** = a user-count lift in a time window after a post, with no UTM match; computed server-side, always badge-labeled, excluded from headline counts. **Manual** = values entered by a person (e.g. reconciliations), badge-labeled.
- **Consequences:** If GA4 does not return campaign dimensions for a given app (SDK or link not configured), the UI shows "No measured attribution available" with a link to the Tracking Guide, not zeros.

## D-008: Tracking link format
- **Date:** 2026-10-11 · **Status:** accepted
- **Decision:** Link builder produces Play Store URLs of the form `https://play.google.com/store/apps/details?id=<package>&referrer=<url-encoded utm_source=..&utm_medium=..&utm_campaign=..&utm_content=..>`. UTM values are lowercase slugs, validated and unique per campaign + content. Matches the PRD example (`utm_source=instagram; utm_medium=social; utm_campaign=grindquest_launch; utm_content=reel_01`).
- **Consequences:** The builder blocks invalid or duplicate UTM combinations.

## D-009: Click counting via our own redirect
- **Date:** 2026-10-11 · **Status:** proposed (pending user answer, Q3)
- **Context:** GA4 cannot see clicks on a social link that happen before the Play Store. The PRD wants clicks → attributed → engaged → retained "where supported".
- **Decision:** Optional short links `https://<api-host>/r/<code>` that log a click in `linkClicks` and 302 to the Play URL with the `referrer`. Posts may alternatively have clicks entered manually (provenance `manual`).
- **Consequences:** Needs a public unauthenticated endpoint, basic bot filtering and rate limiting. Click counts from redirects are `measured`; typed-in clicks are `manual`.

## D-010: Roles and enforcement
- **Date:** 2026-10-11 · **Status:** accepted; the custom-claims part is superseded by D-021
- **Decision:** Roles `admin`, `growth`, `developer` stored as Firebase custom claims and mirrored in `users`. The API checks the claim on every route; Firestore rules deny direct client writes to everything except what is explicitly allowed. The web UI hides actions by role but is not the security boundary.
- **Consequences:** The first admin is created with a one-off script. Role changes require the user to refresh their token.

## D-011: Monorepo with shared Zod schemas
- **Date:** 2026-10-11 · **Status:** accepted
- **Decision:** npm workspaces: `apps/web`, `apps/api`, `packages/shared`. Zod schemas in `shared` are the single source for request/response types and enums.
- **Consequences:** No type drift between client and server. One install, one CI.

## D-012: UI direction
- **Date:** 2026-10-11 · **Status:** accepted
- **Decision:** New design (not the mockups' dark gold look). Neutral slate, single indigo accent, Inter + tabular numerals. Light and dark themes through CSS variables with a header toggle, defaulting to system preference. Provenance is conveyed by shape/pattern/icon as well as color.
- **Consequences:** All colors come from tokens; no hard-coded hex in components.

## D-013: Revenue deferred behind the provider interface
- **Date:** 2026-10-11 · **Status:** accepted
- **Context:** PRD section 15 says revenue appears only when reliable integrations exist; AdMob and Play Billing are V2.
- **Decision:** V1 ships a Revenue screen that shows "Not connected" and the provider method signature is defined. No estimated or placeholder revenue is shown.
- **Consequences:** Total Revenue and revenue per user are hidden on the Overview until connected.

## D-014: Dates, timezone and currency
- **Date:** 2026-10-11 · **Status:** proposed
- **Decision:** Dates stored as UTC ISO strings; "today" and day buckets follow `Asia/Kolkata`; GA4 property timezones are noted per app. Currency display INR when revenue exists.
- **Consequences:** Report week boundaries are Monday to Sunday IST. Revisit if the team is spread across timezones.

## D-015: Reports
- **Date:** 2026-10-11 · **Status:** proposed
- **Decision:** Weekly report is generated on demand in V1 (button) and stored as a snapshot in `reports`. CSV is built server-side; PDF is rendered server-side from the same snapshot. Scheduled generation is V2.
- **Consequences:** Reports are reproducible: reopening one shows the numbers as they were, even if GA4 later revises them.

## D-016: Build single-workspace for V1, but keep it workspace-ready for other studios
- **Date:** 2026-10-11 · **Status:** superseded by D-019
- **Context:** The user may pitch this to other small app studios. The PRD is written for one studio (CatalystCore) and one user group.
- **Decision:** V1 serves one workspace. To avoid a rewrite later: every Firestore document carries `workspaceId`; every API query is scoped by the caller's workspace (from a custom claim, alongside role); Firestore rules check it; no studio or app names, logos or colors are hard-coded (read from a `workspaces` document and `apps`); the product name is configurable. Multi-workspace UI (signup, invites, billing, per-tenant limits) is out of V1.
- **Consequences:** Small cost now (one extra field and one scoping helper). If Q7 is "hosted product", the next step is per-tenant GA4 access (D-018) and workspace onboarding. If Q7 is "template each studio deploys", `workspaceId` stays but is mostly constant, and the work shifts to one-command setup and docs.

## D-017: Hosting: Firebase Hosting + Cloud Run, with a nightly sync
- **Date:** 2026-10-11 · **Status:** proposed
- **Context:** Render's free tier sleeps after about 15 idle minutes. About 5 people will check daily, so cold starts would hit the first visitor each time. Firebase Auth and Firestore are already in the stack.
- **Decision:** Web on Firebase Hosting. API on Cloud Run, reached through a Firebase Hosting rewrite so web and API share one origin (no CORS). Cloud Run uses its runtime service account (Application Default Credentials), so the Firestore and GA4 access needs no key file in production. Cloud Scheduler triggers a nightly sync that writes GA4 results into `metricSnapshots`; dashboards read cached snapshots from Firestore, so pages are fast even after a cold start. Optionally set min instances to 1 if cold starts bother the team. Render remains a fallback if the team prefers a non-GCP host.
- **Consequences:** One cloud account and one bill for hosting, auth, database and API. Requires enabling billing on the GCP project (usage is expected to be small). The GA4 provider must support both key-file credentials (local development) and ADC (production). Service account email still needs Viewer access on each GA4 property.

## D-018: How other studios would connect their GA4 (if D-016 goes ahead)
- **Date:** 2026-10-11 · **Status:** superseded by D-019
- **Context:** A hosted product cannot ask each studio to trust one shared key file silently.
- **Decision:** Two possible models. (a) Service-account model: each studio adds our service account email as Viewer on their GA4 properties. Simple, no Google app review, good for early pilots. (b) OAuth model: each studio signs in with Google and grants read-only Analytics access. Smoother onboarding, but Google may require app verification for the scope. Start with (a); revisit (b) only if there is real demand.
- **Consequences:** Nothing to build in V1 beyond keeping GA4 credentials behind the provider interface and the per-app `ga4PropertyId` (already planned). Studio data stays isolated by `workspaceId` (D-016).

## D-019: Distribution model: a template each studio deploys itself; no multi-tenancy
- **Date:** 2026-10-11 · **Status:** accepted (answers Q7; supersedes D-016 and D-018)
- **Context:** The user plans to pitch this to other small app studios and chose "a template each studio deploys itself" over a hosted product.
- **Decision:** One deployment serves exactly one studio, with its own Firebase project, Firestore, Auth users, GA4 service account and hosting. We do not build workspaces, tenant scoping, signup, invites or billing, and we do not add `workspaceId` to documents. Studio identity and look come from a `settings/studio` document (name, logo URL, accent color, timezone, currency, default date range, `schemaVersion`), and the app list comes from the `apps` collection. Nothing is hard-coded to CatalystCore or its apps. GA4 access is always the service-account model: the studio creates its own service account (or uses Cloud Run's) and adds it as Viewer on its GA4 properties. Distribution and license are open (Q8).
- **Consequences:** Data isolation between studios comes for free from separate Firebase projects, and one studio's mistake cannot expose another's data. The security model stays simple (roles only). Added work lands in a late packaging phase (P10): setup docs and script, demo mode on seed data, studio settings screen, generic README, schema versioning and migrations, license. Hosting (D-017) stays, with the note that each studio needs billing enabled on its own Google Cloud project; the setup guide must say so up front and list a non-GCP fallback. Because upgrades are manual pulls, schema changes must ship with migrations from V1 onward.

## D-020: Tooling choices for the monorepo
- **Date:** 2026-10-11 · **Status:** accepted
- **Decision:** Node 22 (`.nvmrc`, `engines`), npm workspaces, ESM everywhere, TypeScript strict with `noUncheckedIndexedAccess` and `moduleResolution: Bundler`. Package scope `@growth/*` (studio-neutral, per D-019). `@growth/shared` is consumed as TypeScript source (its `exports` points at `src/index.ts`); the web app builds with Vite and the API bundles it in with tsup (`noExternal`), so there is no separate build step for the shared package. API: Express 5, Zod-validated env, helmet and cors, tsx for development. Web: React 19, Vite, Tailwind CSS 4 with CSS-variable design tokens (`bg-surface`, `text-fg`, `border-line`, ...) defined for light and dark. Tests: Vitest everywhere, supertest for the API, Testing Library for the web. Lint: ESLint flat config plus Prettier (`*.md` is not auto-formatted). API default port 8787; the Vite dev server proxies `/api` to it. CI: GitHub Actions running typecheck, lint, test and build on pushes to `main` and on pull requests.
- **Consequences:** One install, one set of scripts. Dependencies are added only when a phase needs them (router, query and charts arrive in P2/P3). Version ranges were written by hand in P0 because the sandbox could not reach npm; the first lockfile should be generated on a machine with registry access and committed, after which CI uses `npm ci`.

## D-021: Sign-in with Google, invite-only, role read from Firestore on every request
- **Date:** 2026-10-12 · **Status:** accepted (supersedes the custom-claims part of D-010; answers Q6; Q9 still to be confirmed)
- **Context:** About five people use the dashboard and one is the admin. Other studios will deploy their own copy (D-019). Custom claims need a script to set them and a token refresh to change them, and a deactivated person would keep working until their token expired.
- **Decision:** People sign in with Google through Firebase Auth. The web app sends the Firebase ID token as a Bearer token. The API verifies it with the Admin SDK, requires a verified email, then loads the `users/{lowercase email}` document on every request. No document means 403 `not_invited`; `active: false` means 403 `account_disabled`. That document is the single source of truth for role and active flag, so a change applies on the next request. There are no custom claims and no cache. Admins invite people by email and role; an invitation is a document with `uid: null`, and `uid` and `name` are filled in at first sign-in. The email in `ADMIN_EMAIL` becomes the first admin automatically at first sign-in when it has no document (this replaces the planned `seed:admin` script). The API refuses to demote or deactivate the last active admin. The Users screen also disables an admin's own row. There is no hard delete: people are deactivated, so history keeps its author.
- **Consequences:** One Firestore read per API call, which is fine at this scale; add a short cache only if cost or latency requires it, and then state the delay before a deactivation takes effect. Email is the document id, so a person who changes their Google email needs a new invitation. Google is the only sign-in method in V1.

## D-022: Firestore is reached only through the API; the rules deny everything
- **Date:** 2026-10-12 · **Status:** accepted
- **Decision:** `firestore.rules` denies every client read and write. All data access goes through the API, which uses the Admin SDK (it bypasses rules). A test (`firestoreRules.test.ts`) fails if the rules file contains any `allow` other than the deny-all.
- **Consequences:** The browser never talks to Firestore, so every access path passes the route-level auth and permission checks. There are no realtime listeners in the UI; screens refetch through TanStack Query. The rules file must be deployed with the rest of the setup (part of the P10 guide).

## D-023: Local development uses the Firebase emulators under a demo project
- **Date:** 2026-10-12 · **Status:** accepted
- **Decision:** `npm run emulators` starts the Auth and Firestore emulators for the project id `demo-growth` (Firebase treats `demo-` projects as offline-only, so nothing can touch a real project). Ports and `singleProjectMode` are in `firebase.json`. `firebase-tools` runs through `npx` and is not a repo dependency. The Admin SDK finds the emulators through `FIRESTORE_EMULATOR_HOST` and `FIREBASE_AUTH_EMULATOR_HOST`, and the web app connects to the Auth emulator when `VITE_FIREBASE_AUTH_EMULATOR_URL` is set. Without Firebase settings the API still starts: `/api/health` stays public, and protected routes answer 503 `auth_not_configured`. The web app then shows setup help instead of a login button.
- **Consequences:** Anyone can run the whole sign-in flow without a Firebase project or keys. The Firestore emulator needs Java installed. Real-project testing still works by setting real values.

## D-024: P1 dependencies, and regenerating the lockfile
- **Date:** 2026-10-12 · **Status:** accepted
- **Decision:** P1 adds `firebase-admin` (API) and `firebase`, `react-router-dom` and `@tanstack/react-query` (web). Each is needed by this phase: server-side token checks and Firestore, browser sign-in, routing and guards, and server state for the Users screen. The ranges were written by hand because the sandbox cannot reach npm. Whoever has registry access runs `npm install` on the branch and commits the updated `package-lock.json` before merging. CI's "Lockfile in sync" step stays red until then, on purpose.
- **Consequences:** A phase that adds dependencies cannot merge until the lockfile is committed. The same steps apply to later phases.

## D-025: Permissions, not role names, gate every route and screen
- **Date:** 2026-10-12 · **Status:** accepted
- **Decision:** `packages/shared` defines the permission list and the role-to-permission matrix, following PRD section 19. Admin has everything. Growth can read apps, metrics, acquisition, campaigns, content, timeline and reports, write campaigns, content and timeline, and generate reports. Developer can read apps, metrics, acquisition and timeline. API routes use `requirePermission(...)`; the web app uses `can(...)` from the session. `GET /api/me` returns the caller's permissions, so the UI never re-implements the matrix.
- **Consequences:** Adding a role or changing the matrix is a one-file change with a test. Code never compares role names (it only shows the role's label). Hidden buttons are a convenience; the API is the security boundary.
