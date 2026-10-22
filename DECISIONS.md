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
- **Date:** 2026-10-11 · **Status:** accepted; the visual direction is superseded by D-030 (the rules stay: tokens only, light and dark, provenance never by color alone)
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

## D-026: Sign-in is tested against the real Firebase emulators
- **Date:** 2026-10-13 · **Status:** accepted
- **Context:** The first real sign-in attempt failed with "Could not load the default credentials", and the page only said "Something went wrong". The unit tests fake the token check and the database, so they could not tell whether the real wiring (Admin SDK token verification, Firestore transactions) worked.
- **Decision:** `apps/api/src/emulator.test.ts` signs in through the Auth emulator the way the browser does with Google, then calls the API, which uses the real Admin SDK against the Auth and Firestore emulators. It covers the first admin with and without a Google name, linking an invited person at first sign-in, two sign-ins arriving at once, a person who was not invited, a token that is not valid, a role that lacks a permission, deactivation taking effect on the next request, and the last-admin guard. `npm run test:emulator` runs it under `firebase-tools emulators:exec` (project `demo-growth`); without the emulator environment variables the file is skipped, so `npm run test` stays offline. CI runs it in a separate `emulator-tests` job with Java 21.
- **Consequences:** CI needs Java and downloads `firebase-tools` through `npx` (unpinned, like `npm run emulators`). The browser half of the flow (the Google pop-up) is still not covered; Playwright flows arrive in P9.

## D-027: Setup problems answer 503 with what to change; the log keeps the original error
- **Date:** 2026-10-13 · **Status:** accepted
- **Decision:** The API recognises the usual first-setup failures of its two dependencies and answers `503` with `{ error: { code, message } }`. Firestore: `database_unavailable` for no credentials, rejected credentials, a service account without access, a project without a database, or an unreachable emulator. Firebase Auth: `auth_unavailable` when the service cannot be reached, and `project_mismatch` when the token belongs to another Firebase project (the web and API project ids differ). Messages start with "Server setup problem:", name settings and never values, and do not repeat the original error. The original error goes to the log under `errorName`, `errorMessage` and `errorCode`, never under `message`, which would replace the log line's own message. Other unexpected errors stay a plain 500. On startup the API logs how it will reach Firebase (emulators or a real project, whether the key file exists), and a key file that cannot be read stops it with "Cannot start". The web app shows the API's message as it is, says "Could not reach the API" when nothing answers, and explains the common Firebase sign-in errors (unauthorised domain, provider not enabled, wrong API key). Access-denied messages (403) name the account, so a person with several Google accounts can see which one they used.
- **Consequences:** A wrong setting shows up on the screen that fails, not only in a log. The classification lives in `apps/api/src/lib/databaseErrors.ts` and `tokenErrors.ts`; a new dependency (GA4 in P4) needs the same treatment. Messages are English only, matching the rest of the UI.

## D-028: The dashboard needs a Firebase project of its own, and ignores documents it did not write
- **Date:** 2026-10-14 · **Status:** accepted
- **Context:** The first real run used the Firebase project of an app. Its own `users` collection held documents with no role or uid and a Firestore timestamp where a date string is expected. Reading every document as a dashboard user failed with a `ZodError`, so the Users screen showed "Something went wrong" while invitations were still being saved. Sharing a project also mixes the dashboard's Google sign-ins into the app's Firebase Auth users, and deploying the deny-all rules (D-022) over an app's rules would lock the app out of its own data.
- **Decision:** The README now says to create a Firebase project made for the dashboard (what D-019 already implied: one deployment, one Firebase project) and warns before the rules step. The API reads lists of people tolerantly: a document that is not a dashboard user record is left out of the Users list and of the admin count, and the API logs how many it skipped and why that usually happens. A single person is still looked up strictly, by the exact email as the document id, so a document written by something else can never grant access; emulator tests put such documents in the collection to check the list, the admin count and sign-in. Prefixing the dashboard's collections (for example `growth_users`) was considered and not built: it would change the data model of every deployment to protect a setup the README now rules out. If a studio must share a project, add a prefix setting in a later phase.
- **Consequences:** The Users screen keeps working next to an app's documents. The dashboard can still write into a shared collection, and later collections (`apps`, `campaigns`, ...) have the same name-clash risk, so a separate project remains the rule.

## D-029: The Firebase project split waits until production (the requester's decision)
- **Date:** 2026-10-14 · **Status:** accepted (the requester's decision)
- **Context:** D-028 says the dashboard needs a Firebase project of its own. During development it runs against a project that an app also uses. The requester tested the dashboard locally on it, merged P1 (PR #3), and chose to move on: "we would see about this later in production".
- **Decision:** Development carries on with the current project. The split is done before the dashboard is used with real data or deployed where other people can reach it, by working through "13. Before production" in `PLAN.md`. No project id and no detail about the other app's configuration is written in this repository, because the repository is public; the checklist is generic.
- **Consequences:** Until then the dashboard's `users` documents (the access list) and every later collection sit in a project whose rules the dashboard does not control, and the deny-all rules (D-022) must not be deployed to it. This is acceptable for development with test data only. P4 is the first phase that stores real analytics numbers (`metricSnapshots`), so the agent asks the requester again at the start of P4 whether to do the split first. The P10 setup guide must tell a studio to use a project made for the dashboard.

## D-030: The UI follows the Stitch design export saved in docs/design
- **Date:** 2026-10-15 · **Status:** accepted (the requester's decision)
- **Context:** The requester supplied a design export ("this will be the ui design"): a design system and six screens. It replaces the earlier mock-ups, which were only context (D-001), and the visual part of D-012. It also shows things that are outside V1 or against the product rules (revenue, crash rates, benchmarks, "verified" labels).
- **Decision:** The look and the shell follow the export: the left rail and top bar, the tokens, the type, the shapes of cards, controls, chips and tables, and the layout of the screens. Scope stays the PRD's V1 (D-001), and `AGENTS.md` wins where the design disagrees with it: no revenue, crash or store-health numbers, no benchmarks, no "verified" claims; the studio name, logo and the signed-in person come from settings and the session (D-019); the menu lists only screens that exist; light and dark themes both exist (the export is light only, so the dark palette is derived). "Sample studio dataset active" becomes the "Demo data" label (D-003). The export is saved under `docs/design` with a README that maps each design screen to a phase and lists what is not built.
- **Consequences:** UI work starts from `docs/design/README.md`. A design element that needs a feature (compare to the previous period, export buttons, source connection cards) is built in the phase that owns that feature. The design's "Products" is "Apps" here, the PRD's word; it is one label to change if the requester prefers the other. The design asks for Inter and JetBrains Mono; the app loads them from Google Fonts for now and falls back to the system fonts, and self-hosting them is a P9 or P10 task.

## D-031: Date ranges are calendar days in the studio's time zone, and the filters live in the address
- **Date:** 2026-10-17 · **Status:** accepted
- **Context:** PRD section 16 asks for global filters that are synced to the URL. "Last 7 days" needs a rule for what a day is and what "today" is, and a link has to show what its sender saw.
- **Decision:** A quick range is a number of calendar days that ends today and includes today (Today is 1 day; Last 7, 30 and 90 days), cut where the studio is (D-014), so "Last 7 days" is seven days and not seven plus part of an eighth. The filters are the address parameters `range` (`today`, `7d`, `30d`, `90d` or `custom`), `from` and `to` (only read with `range=custom`), `appIds` (comma-separated), `platform`, `campaignId` and `contentType`. A value that equals the default is left out of the address. The address is read forgivingly: a value that cannot be read (an unknown range name, a custom range that starts after it ends or is longer than D-032 allows) falls back to the studio's default range, so a hand-edited or old link shows the default view instead of an error. An app that no longer exists is dropped from `appIds` once the app list has loaded. The API is strict instead: its read query (`analyticsQuerySchema`) takes the same names with the range already resolved to `from` and `to`, and answers a request it cannot understand with what is wrong with it. The reading and writing of these parameters, and the turning of a range into days, are one implementation in `packages/shared`, used by the web app and by the API. Every menu link carries the current filters, including links to screens that do not use them, so a choice survives a visit to Apps or Users.
- **Consequences:** A link shows what its sender saw, and the rules are unit-tested in one place. A new filter is one more name in `FILTER_PARAM_NAMES`. "Compare with the previous period" (P3) needs its own rule; none is decided here.

## D-032: The longest range is 366 days
- **Date:** 2026-10-17 · **Status:** accepted
- **Context:** A range goes to the analytics provider as daily reports. An open-ended range would make requests unbounded and charts unreadable.
- **Decision:** `MAX_RANGE_DAYS` is 366, enforced by the shared range check. The custom date boxes say "Choose at most 366 days" and leave the address alone until the range is valid; screens and routes built on the shared schema inherit the limit.
- **Consequences:** A whole year of daily numbers fits in one request. Looking further back needs a new decision and a look at what GA4 keeps.

## D-033: The analytics provider contract, as built
- **Date:** 2026-10-17 · **Status:** accepted (refines the sketch in PLAN section 6)
- **Context:** The sketch in PLAN section 6 used one `Query` type and ids. Building the seed provider showed what a provider really needs to be given and what it must answer.
- **Decision:** `AnalyticsProvider` (`apps/api/src/providers/types.ts`) has six reads: `getOverview(query)`, `getTimeSeries(query, metric)`, `getAppUsers(app, query)`, `getRetention(app, query)`, `getAcquisition(query)` and `getCampaignUsers(app, utm, query)`. A `PeriodQuery` is the days asked for and what day it is now where the studio is; a `ProviderQuery` adds the apps. The caller looks the apps up and passes the records, so a provider never touches the database and takes the GA4 property id and launch date from the record. Every answer says which provider made it (`source`). Each number is a `MetricValue`: `ok` with a value, or a state that says why there is none (`not_connected`, `no_measured_attribution`, `not_enough_data`, `in_progress`), never zero. A day after today has no data yet, and a window that has not ended by today is `in_progress`. Platform, campaign and content-type filters are not about apps and days, so the services that own posts and campaigns apply them, not a provider. The answer shapes are Zod schemas in `packages/shared/src/analytics.ts`, so the web app and the API read one definition.
- **Consequences:** The GA4 provider (P4) implements this contract and nothing else, and the screens never know which provider is behind them. PLAN section 6 now shows these signatures.

## D-034: Apps have unique package names, and deleting an app is a hard delete
- **Date:** 2026-10-17 · **Status:** accepted
- **Context:** The apps screen needs add, edit and delete, and later phases will hang campaigns, links, posts and events on an app.
- **Decision:** The package name is unique among apps, compared without regard to case (`409 package_name_taken`). App ids are made by the database; the id pattern `[A-Za-z0-9_-]{1,128}` also takes hand-made and test ids and keeps path characters out of a document path. `GET` is open to every role (`apps:read`); add, change and delete need `apps:write` (admin). `DELETE` removes the document (`204`), and the screen asks the person to confirm in place first.
- **Consequences:** An id in an old link can name an app that no longer exists, which the filters handle (D-031). From P5, deleting an app that campaigns, links, posts or events refer to must be refused with a clear message, or replaced by an "archived" status; decide which at the start of P5.

## D-035: Studio settings are read-only until the settings screen in P10
- **Date:** 2026-10-17 · **Status:** accepted (applies D-019)
- **Context:** The studio's name, logo, time zone, currency and usual date range come from `settings/studio`, and every date on screen depends on the time zone. The edit screen belongs to the packaging phase (P10).
- **Decision:** `GET /api/settings/studio` (permission `settings:read`, every role) answers `{ settings, configured }`. Every field has a default, and the defaults are written in one place only, `DEFAULT_STUDIO_SETTINGS` in `packages/shared`: no name (the screens then say "Growth Analytics"), Asia/Kolkata and INR (D-014) and Last 30 days. A missing document answers `configured: false`, and the Overview says that the defaults are in use. A document that does not pass the schema, or a `schemaVersion` newer than this code understands, answers `503 studio_settings_invalid` with the field to fix. Until P10 the document is created by hand in the Firestore console (README). The accent colour in the design and in PLAN section 5 is not read yet; it arrives with the settings screen.
- **Consequences:** A studio can already run under its own name and time zone without any code change (D-019). The web app loads the settings before it draws a screen (D-037), so no date is ever shown in the wrong zone for a moment.

## D-036: The seed provider is deterministic, labelled, and never invents what needs an integration
- **Date:** 2026-10-17 · **Status:** accepted (applies D-003 and D-013)
- **Decision:** Every figure the seed provider returns is a function of the app's id and the day, so reloads agree and the daily numbers add up to the totals and to the acquisition table. Every answer says `source: 'seed'`, which is how the screens know to show "Demo data". It never makes up installs or revenue, which need a store or ad integration (D-013): they stay `not_connected`. It is the only place sample figures may live. `ANALYTICS_PROVIDER` is `seed` by default. Setting it to `ga4` stops the API at start-up with a message until the GA4 provider exists (P4), because answering with demo data that people believe is real would be worse than not starting.
- **Consequences:** The dashboard can be tried, tested and shown before any property is connected, and the P10 demo mode builds on this provider. The seed tests pin the "never invents" rule.

## D-037: How the shell loads, and what it labels
- **Date:** 2026-10-17 · **Status:** accepted (applies D-030)
- **Decision:** After sign-in the shell first loads the studio settings and shows a loading card, or an error card with "Try again" and "Sign out", before it draws anything (D-035). The top bar shows "Demo data" when `GET /api/health` reports the seed provider, and nothing for a real source or while the answer is not known, because a label would claim more than the dashboard knows. The Overview names the data source in words (including "API not reachable" when it cannot say). The menu lists only built screens, in the design's order, with the Overview first. The date range control sits in the top bar and only on screens that use it; on a phone it moves to a row of its own. The custom dates and the app chips sit in a strip under the top bar, at the top of the main area, so the skip link lands on the strip before the page. The page title is set to "Screen · Studio name".
- **Consequences:** A screen that has numbers sets its `filters` scope in `components/navigation.ts` and gets the controls for free; the Apps and Users screens set none. On a phone the menu is a row of links that scrolls sideways; when the menu grows beyond four or five screens (P3 onwards) it needs a menu button and a drawer instead.

## D-038: Light and dark themes, and the contrast the design's colours needed
- **Date:** 2026-10-17 · **Status:** accepted (applies D-030)
- **Decision:** The theme is light, dark, or the system's (the default). The choice is saved in this browser under `growth.theme` and put on `<html>` as `data-theme`; a small inline script in `index.html` applies it before the first paint, so a person who chose dark never sees a white flash, and it works when storage is blocked. All colours are CSS variables, and components use the token names only. The light values are the design's; the dark values are derived from the same slate and indigo scales. Two values differ from the design to pass contrast in both themes: text in the teal, amber and rose colours uses darker "-strong" variants (4.5:1 on white and on the tinted chip fills), and form controls use a darker border than cards do (3:1 against the page), because a field's edge has to be visible.
- **Consequences:** Charts and later components must use the tokens as well, and a new colour is a new token with a value for each theme (a test checks that the two dark blocks in `index.css` stay identical). Self-hosting the fonts stays a P9 or P10 task (D-030).

## D-039: "Compare to previous period" is the same number of days directly before the range
- **Date:** 2026-10-18 · **Status:** proposed (the requester has not answered yet)
- **Context:** D-031 left the rule open. The design's Overview shows "Compare: previous period" and the cards show a change.
- **Decision:** The previous period is the same number of days directly before the chosen range, so "Last 7 days" (9 to 15 October) is compared with 2 to 8 October, and a custom range with the same number of days before it (`previousRange` in `packages/shared`). Comparing is on by default and is switched off with a checkbox, which puts `?compare=off` in the address, so a link shows what its sender saw. A card shows a percentage change only when both numbers exist and the earlier one is above zero (`changeBetween`); otherwise it says why in words ("No data for the previous period", "None in the previous period") and never invents a figure. The growth chart draws the previous period as a dashed line, lined up by day from the start of each period. Nothing is adjusted for today being only partly over, or for weekdays, so a range that includes today compares a part-day with whole days. Retention is not compared (its cohorts overlap the range in a different way); the compare switch only affects the Overview and App detail.
- **Consequences:** Two reads per screen when comparing (this period and the one before). The compare choice is not carried by menu links (they carry only the filters of D-031), so leaving a screen and coming back turns comparing on again. If the requester prefers a different rule (the same days a month earlier, or a year earlier), it is one function and one set of tests.

## D-040: A screen under a menu item can have its own title and filter scope
- **Date:** 2026-10-18 · **Status:** accepted (the requester's correction)
- **Context:** `navItemFor` matches by path prefix, so `/apps/:id` would have inherited the Apps item's filter scope of `'none'` (D-037), and the page of one app, which shows numbers, would have had no date range and no app chips.
- **Decision:** `NESTED_SCREENS` in `components/navigation.ts` lists screens that are not in the menu and have their own title and filter scope; `screenFor(pathname)` checks them first and falls back to the menu item. The shell uses `screenFor`. App detail (`/apps/:appId`) is the first one and uses `'range-and-apps'`. The menu item stays active on such a screen.
- **Consequences:** A new screen under a menu item that needs different filters is one line in `NESTED_SCREENS`, with a test. On App detail the app comes from the address, so the app chips do not change the numbers there yet; what they should do on one app's page is an open question for the requester.

## D-041: The metrics reads, and how they pick the apps
- **Date:** 2026-10-18 · **Status:** accepted
- **Context:** The Overview and App detail need the provider's reads over the API (PLAN section 7).
- **Decision:** `GET /api/metrics/overview`, `GET /api/metrics/series?metric=`, `GET /api/apps/:id/users` and `GET /api/apps/:id/retention`, each behind `metrics:read` (D-025) and validated with `analyticsQuerySchema` (D-031). A service looks the apps up (no `appIds` means every app, in name order), works out today in the studio's time zone (D-014) and asks the provider; it computes no numbers itself (D-033). An `appIds` value that names no app answers `404 app_not_found` instead of being skipped, so a total never covers different apps from the ones the person chose. A studio with no apps gets "Not connected" states from the provider, not zeros. The platform, campaign and content-type filters are accepted and ignored: they belong to the services that own posts and campaigns (P5 onwards), as D-033 says.
- **Consequences:** The GA4 provider (P4) needs no change here. Every route has tests for each role and for no token, not invited and deactivated.

## D-042: Charts use Recharts with the theme tokens, and every chart has a table
- **Date:** 2026-10-18 · **Status:** accepted (applies D-038)
- **Context:** PLAN section 3 and AGENTS.md name Recharts. Charts must follow both themes, not rely on colour alone and be readable without sight.
- **Decision:** `recharts` `^2.15.0` (resolved to 2.15.4; its peer dependencies list React 19) is added to `apps/web`; the requester regenerated and committed `package-lock.json` because the sandbox has no npm registry (D-024). Lines take their colour from the theme tokens, so no second palette exists: this period is a solid accent line, the previous period a dashed grey one, so the two differ by shape as well as colour. A day without data is a gap in the line, never a drop to zero. A chart with two lines has a legend; the highest day is written above the chart; every chart has a "Show as a table" view with the same numbers. The test setup stubs `ResizeObserver`, which jsdom lacks, so tests check the numbers and words around a chart and not its drawing.
- **Consequences:** The look of the drawn chart was checked by no automated test; the requester looks at it when trying the branch. Later charts reuse `TrendChart` and the table pattern.

## D-043: Missing numbers, provenance and the data source are written the same way everywhere
- **Date:** 2026-10-18 · **Status:** accepted (applies AGENTS.md and D-002, D-003, D-006)
- **Decision:** A missing number is written as the reason in words from one place, `MISSING_LABELS` ("Not connected", "No measured attribution available", "Not enough data", "In progress"), smaller and muted so it cannot be read as a value; a real zero is written "0". `ProvenanceBadge` shows measured (filled, with a check), inferred (dashed outline and "~") and manual (plain, with a pencil), each with its name spelled out; the attributed-users card and the attributed-users chart carry the "Measured" badge. `SourceLabel` reads the answer's own `source`, so every screen with numbers says "Demo data" for the seed provider (the top bar's pill from `/api/health` stays). The cohort heatmap writes the percentage in every cell; the shade only helps the eye, reaches at most 45% opacity so the text keeps its contrast in both themes, and a window that has not ended shows "In progress" in a dashed box.
- **Consequences:** Later screens use these components and the same words. Installs and revenue stay "Not connected" until a store or ad integration exists (D-013); the Overview shows Installs and leaves Revenue out because it has no screen.
## D-044: A project-mismatch message names both Firebase projects (refines D-027)
- **Date:** 2026-10-19 · **Status:** accepted
- **Context:** A person whose web and API project id settings were identical, and who then tried `demo-growth` in both, kept getting "you signed in to a different Firebase project than the one the API uses". The message sent them to the two id settings, but the project a web sign-in goes to is decided by the web API key (`VITE_FIREBASE_API_KEY`), not by the project id next to it, and a browser can keep a sign-in from an earlier setup. The Admin SDK's error already says which two projects it compared (`Expected "a" but got "b"`), but only the API log showed it, and the people who set this up do not read logs.
- **Decision:** For `project_mismatch`, and only for it, the 503 message names the project the token was issued for and the project the API expects, read from the SDK's audience or issuer error. Project ids are public identifiers, so this is the one exception to D-027's "never values". Keys, key-file paths, email addresses and the original error text stay out of every message. A name is passed on only if it is plain letters, digits, spaces and `. : - _` (at most 64 characters), so odd text in a forged token is never echoed; otherwise the message is the general one. The message also says that the sign-in goes to the project of `VITE_FIREBASE_API_KEY`, that the three settings must come from one Firebase project, and to restart, sign out and sign in again. The README's troubleshooting table explains the same, including `.env` values that the terminal or a `.env.local` file overrides.
- **Consequences:** The usual cause, a key from another project or a saved sign-in, shows on the screen that fails. Anyone with a sign-in from some other Firebase project (a free one is easy to make) can make the API answer with its own project id; it is the same identifier the web app ships to every browser. Later setup messages follow the rule this sets: public identifiers may be named, secrets and paths may not.

## D-045: Using the emulators is always visible, and a half-switched setup is named
- **Date:** 2026-10-21 · **Status:** accepted
- **Context:** The person who set this up kept getting "signed in to a different Firebase project" with their real project id in both id settings. The three emulator lines from an earlier try with the emulators were still active, so every sign-in went to the local emulator, whose sign-ins belong to its own project (`demo-growth`). Nothing on screen said the app was using an emulator (the SDK's own banner is switched off), and the first D-044 message talked about the API key instead.
- **Decision:** Four things make the mode visible. (1) The top bar shows a "Local emulator" chip beside the data-source chip whenever `VITE_FIREBASE_AUTH_EMULATOR_URL` is set, and the login page shows a notice that sign-in goes to the emulator, not to Google. Both read the setting through `lib/emulator.ts`, which the Firebase wrapper also uses, and the top bar's left group wraps onto a second line on a narrow screen. (2) When a mismatch involves an emulator project (Firebase's `demo-` prefix), the 503 message says so: it names the three emulator lines to remove, or, when the API is the side set up for the emulator, the real project id to use. (3) At start-up the API warns when `FIREBASE_AUTH_EMULATOR_HOST` is set but `FIREBASE_PROJECT_ID` is not a `demo-` id, and when it is a `demo-` id but no Auth emulator host is set. (4) `.env.example` and the README say that the three emulator lines are switched off together.
- **Consequences:** A developer can see which Firebase they are talking to without reading logs. The `demo-` prefix is Firebase's convention for emulator-only projects, not something it enforces: a real project that happens to be called `demo-something` would get the start-up warning and the emulator wording, which is wrong but harmless, and a setting would be the fix. The start-up warnings cannot see the web app's settings, so only the screen shows the web side.

## D-046: GA4 days follow the property's time zone
- **Date:** 2026-10-21 · **Status:** accepted
- **Context:** D-014 buckets days in the studio's time zone, but the Data API reports each day in the GA4 property's own time zone and cannot be asked for another one.
- **Decision:** The GA4 provider uses GA4's days as they come. The setup guide tells the studio to set each GA4 property's reporting time zone to the studio's time zone (Admin, Property details).
- **Consequences:** If a property is in another time zone, its days are shifted against the dashboard's "today" by the difference; the totals for a whole range are still right apart from the edge days. `ga4:check` does not detect this.

## D-047: An app GA4 cannot read is named, never counted as zero; attribution waits for campaigns
- **Date:** 2026-10-21 · **Status:** accepted
- **Decision:** The GA4 provider reads each app on its own. An app without a property ID, or one GA4 refuses, is listed by name in the Overview's "Not connected" line and left out of the totals; the cause is logged (no keys). When every connected app fails on a series or acquisition read, the API answers 502 `ga4_error` with a message that says what to fix (for example, add the service account as a Viewer). The Overview's attributed users and the attributed-users series are `no_measured_attribution` for now: "measured" means matching a registered campaign's UTM values (D-007), and campaigns arrive in a later phase. Retention reads that have no row for a finished day count the day as 0% of the cohort.
- **Consequences:** One broken property does not blank the page, and nothing is shown as zero that was not measured.

## D-048: Finished GA4 days are kept in `metricSnapshots`
- **Date:** 2026-10-21 · **Status:** accepted
- **Context:** PLAN section 5 caches daily GA4 pulls. D-033 says a provider never touches the database.
- **Decision:** The provider is given a `SnapshotStore` port; Firestore backs it in production, memory in tests. One document per app and day, id `<appId>_<date>`, holding the property ID and the day's active users, new users, sessions and engagement seconds. Only days older than three days are saved, because GA4 can revise recent days. A day saved for another property ID is ignored. Only the daily series uses it: totals over a range (unique users, DAU/WAU/MAU, retention, acquisition) cannot be summed from days, so they are read live.
- **Consequences:** Long ranges cost one report the first time and a short one afterwards. The collection is reached only through the API (deny-all rules, D-022). It holds real analytics numbers, which is why D-029 asked about the Firebase project split.

## D-049: What a campaign link's outcome counts
- **Date:** 2026-10-21 · **Status:** proposed (check on real data with `ga4:check`)
- **Decision:** For one link, attributed users are GA4 new users whose first source, medium, campaign (and content, if the link has one) match, case-insensitively. Engaged users are the active users with those same first-user values, never more than attributed. Retained users are the cohort users active the day after arrival, shown as in progress until that day has passed for the whole range; if GA4 does not allow campaign dimensions in a cohort report, the figure is "not enough data".
- **Consequences:** Engaged can include people who first arrived before the range; the cap keeps the funnel from showing more engaged than attributed.

## D-050: The GA4 key is a separate setting, and it replaces D-036's start-up stop
- **Date:** 2026-10-21 · **Status:** accepted
- **Decision:** `GA4_SERVICE_ACCOUNT_KEY_FILE` names the service account key file that reads GA4 (D-004). Without it the Google default credentials are used, so `GOOGLE_APPLICATION_CREDENTIALS` also works. `ANALYTICS_PROVIDER=ga4` now starts the API; the start-up stop from D-036 is gone. `npm run ga4:check -- <propertyId>` makes the dashboard's own reads against one property and prints counts only.
- **Consequences:** The GA4 service account and the Firebase service account can differ. The Data API is loaded on first use, so the demo provider never needs it.

## D-051: The API says when something outside `.env` decides a setting, and when its port is taken
- **Date:** 2026-10-22 · **Status:** accepted
- **Context:** A sign-in kept failing with "the API is set up for the emulator project demo-growth" while `.env` named the real project. The dev scripts load `.env` without replacing anything already set, so a value in the terminal or in Windows' settings wins, and so does an older API process that still holds port 8787 and keeps the settings it started with. Neither showed anywhere; the person who set this up does not read logs and tried the same fix three times (D-044, D-045).
- **Decision:** In development the API reads `.env` itself at start-up and compares it with what it is running with. For the project id, the two emulator hosts, the key-file settings and `ANALYTICS_PROVIDER`, a different value in the environment gets a start-up warning that names the setting, both values and how to remove it (PowerShell and Command Prompt). An emulator host that the environment sets and `.env` does not is flagged too. Ids, hosts and the provider name are shown; key-file locations are not (D-044). When the port is taken the API says so, names the usual cause (an earlier run that was not closed) and exits, instead of leaving the old process to answer.
- **Consequences:** The usual causes of "I changed `.env` and nothing changes" show in the first lines of the log and in the README's troubleshooting table. The check cannot tell a terminal setting from one made in Windows, so the message names both. It is skipped when `NODE_ENV` is `production`, where there is no `.env`.
