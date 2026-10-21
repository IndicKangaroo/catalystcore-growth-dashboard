# Growth Analytics Dashboard

An internal dashboard that connects app analytics (Firebase / GA4) with social-media campaigns, to answer one question: **which content and campaigns are contributing to real product growth?**

Status: under construction (phase P2 of the plan is done). What works today:

- Sign in with Google, invite-only, with three roles (P1).
- The shell from the requester's design: a menu on the left, a top bar, light and dark themes, and a date range that lives in the address, so a link shows what its sender saw (P2).
- **Apps**: everyone can see the list; admins add, edit and delete apps (P2).
- An **Overview** that shows the data source, how many apps there are and the current view. Charts and key numbers arrive in P3.
- Generated **demo data**, labelled as such. Real Google Analytics 4 numbers arrive in P4.

Start with these files:

- `docs/PRD.md`: product requirements
- `PLAN.md`: build plan, phases and open questions
- `DECISIONS.md`: decision log (what was decided and why)
- `AGENTS.md`: rules for AI coding agents (also a good read for human contributors)

## Requirements

- Node.js 22 or newer (`.nvmrc` is provided)
- npm 10 or newer
- Java 21 or newer, only if you use the Firebase emulators (the Firestore emulator needs it; older Java may work with older versions of `firebase-tools`)

## Quick start

```bash
npm install
cp .env.example .env     # runs without sign-in until you add Firebase settings (below)
npm run dev              # API on :8787, web on :5173
```

## Sign-in (Firebase)

People sign in with their Google account through Firebase Auth, and only people an admin has invited can get in (see D-021 in `DECISIONS.md`). The first admin is the email you put in `ADMIN_EMAIL`: that account is created automatically the first time it signs in. Everyone else is invited from the **Users** screen, using the exact email of their Google account.

Without any Firebase settings the app still starts. The login page then says that sign-in is not set up, and protected API routes answer `503 auth_not_configured` (`/api/health` stays public).

| Role            | Can do                                                                        |
| --------------- | ----------------------------------------------------------------------------- |
| Admin           | Everything, including inviting people and changing roles                      |
| Growth / Social | See analytics; manage campaigns, content and timeline notes; generate reports |
| Developer       | See app analytics, acquisition and the timeline (read-only)                   |

### Option A: local emulators (no Firebase project, no keys)

1. Put these in `.env` (the names are in `.env.example`):

   ```
   FIREBASE_PROJECT_ID=demo-growth
   ADMIN_EMAIL=you@example.com
   FIRESTORE_EMULATOR_HOST=127.0.0.1:8080
   FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099
   VITE_FIREBASE_API_KEY=demo-key
   VITE_FIREBASE_PROJECT_ID=demo-growth
   VITE_FIREBASE_AUTH_EMULATOR_URL=http://127.0.0.1:9099
   ```

2. In one terminal run `npm run emulators`. In another run `npm run dev`.
3. Open http://localhost:5173 and choose **Sign in with Google**. The emulator opens its own pop-up instead of Google: add a new account with the same email as `ADMIN_EMAIL` and sign in. You arrive as an admin, and **Users** appears in the menu on the left.

The emulators forget everything when they stop, so the first sign-in creates the admin again each time. Their dashboard is at http://localhost:4000.

While `VITE_FIREBASE_AUTH_EMULATOR_URL` is in `.env`, the top bar shows **Local emulator** and the login page says that sign-in goes to the emulator, not to Google. To go back to a real project (Option B), delete the three emulator lines (`FIRESTORE_EMULATOR_HOST`, `FIREBASE_AUTH_EMULATOR_HOST`, `VITE_FIREBASE_AUTH_EMULATOR_URL`) or put a `#` in front of each, set the ids and the key back to the real project's, and restart.

### Option B: a real Firebase project

**Use a Firebase project made just for the dashboard, not the project of one of your apps** (one deployment, one Firebase project: D-019). The dashboard keeps its own `users` collection in Firestore and signs people in through the project's Firebase Auth. In an app's project those would mix with the app's own users and data, and step 5 below replaces the project's Firestore rules, which would lock the app out of its own data. A new project is free. Your apps' analytics are connected separately, through a service account on each GA4 property.

1. In the [Firebase console](https://console.firebase.google.com), create a **new** project. Under **Authentication → Sign-in method** enable **Google**. Under **Firestore Database** create a database in production mode.
2. Under **Project settings → General → Your apps**, add a **Web app**. Copy its `apiKey` and `projectId` into `VITE_FIREBASE_API_KEY` and `VITE_FIREBASE_PROJECT_ID`. These identify the project and are not secrets. Take both from this one Web app: the key decides which project people sign in to.
3. Set `FIREBASE_PROJECT_ID` to the same project id (the **Project ID** under Project settings → General, not the project's name), and `ADMIN_EMAIL` to your Google account's email. If you tried Option A before, make sure its three emulator lines are deleted or have a `#` in front: while one of them is active, sign-in and the database stay on the emulators, whatever the project id says.
4. Give the API credentials for Firestore. **Without this nobody can sign in**: the browser sign-in works, but the API cannot read the list of invited people, and the page says "Server setup problem". On your own machine:
   - In **Project settings → Service accounts**, press **Generate new private key** and save the `.json` file somewhere outside the repository. Use the key of _this_ project (the `firebase-adminsdk` account), not a key from another project.
   - Set `GOOGLE_APPLICATION_CREDENTIALS` in `.env` to the **full path** of that file, for example `GOOGLE_APPLICATION_CREDENTIALS=/home/you/keys/growth-admin.json` (on Windows use forward slashes: `C:/Users/you/keys/growth-admin.json`). A relative path is read from the `apps/api` folder and `~` is not expanded, so spell the path out.
   - Alternatively, run `gcloud auth application-default login` and leave the setting empty.
   - On Cloud Run the runtime service account is used and nothing needs setting.
5. Deploy the deny-all Firestore rules once: `npx firebase-tools login`, then `npx firebase-tools deploy --only firestore:rules --project <your project id>`. **Only do this on the dashboard's own project**: the rules deny every client read and write, so an app that uses the same Firestore database would stop working.
6. Run `npm run dev`, open http://localhost:5173 (use `localhost`, not `127.0.0.1`, which Firebase does not allow by default) and sign in with the `ADMIN_EMAIL` account.

Changes to `.env` take effect only after you stop `npm run dev` and start it again. When the API starts it prints how it will reach Firebase (the emulators or the real project, and whether the key file exists), and it stops with a "Cannot start" message if the key file cannot be read.

### If sign-in does not work

The page or the API log says what is wrong. The usual causes:

| What you see | Why | What to do |
| --- | --- | --- |
| "Sign-in is not set up yet" | `VITE_FIREBASE_API_KEY` or `VITE_FIREBASE_PROJECT_ID` is empty | Fill both in `.env`, then restart `npm run dev` |
| "Server setup problem: the API has no Google credentials" | The API uses a real Firebase project but has no key | Option B step 4, or use the emulators (Option A) |
| "Google rejected the API's credentials" | The key was deleted or revoked, or the gcloud login expired | Create a new key, or log in to gcloud again; restart |
| "not allowed to use Firestore" | The key is from another project, or the Cloud Firestore API is off | Use this project's Firebase Admin SDK key; enable the API |
| "no Firestore database yet" | The project has no database | Create one under **Firestore Database** in the Firebase console |
| "cannot reach Firestore" or "could not reach Firebase Auth" | The emulators are not running, or only one of the two host settings is set | Run `npm run emulators` in another terminal and set both `FIRESTORE_EMULATOR_HOST` and `FIREBASE_AUTH_EMULATOR_HOST` |
| "you signed in through the local Firebase emulator (project "demo-growth"), but the API is set up for the real project ...", or a start-up warning "FIREBASE_AUTH_EMULATOR_HOST is set ... but FIREBASE_PROJECT_ID is ..."; the top bar says **Local emulator** | Emulator lines from Option A are still active in `.env` (or `.env.local`) while the project ids are a real project's. The emulator's sign-ins always belong to its own project, `demo-growth`, whatever the ids say | To use the real project, delete the three emulator lines (or put `#` in front), restart `npm run dev`, press **Sign out** and sign in again. To use the emulators, set both project ids to `demo-growth`, keep all seven lines of Option A and run `npm run emulators` |
| "you signed in to the real Firebase project ..., but the API is set up for the emulator project ...", or a start-up warning "FIREBASE_PROJECT_ID is demo-growth, a name that only the local emulators use" | The API has the emulator project id, but the web app signs in to a real project, or the emulator lines are missing | Set `FIREBASE_PROJECT_ID` to the real project's id and delete the emulator lines, or add all seven lines of Option A to use the emulators |
| "you signed in to the Firebase project ..., but the API is set up for ..." (or "a different Firebase project than the one the API uses") | The sign-in and the API are on different real projects. The project you sign in to is the one `VITE_FIREBASE_API_KEY` belongs to, and the API uses `FIREBASE_PROJECT_ID`. Typing the same value into `VITE_FIREBASE_PROJECT_ID` does **not** move the sign-in, and a browser can still hold a sign-in from an earlier setup | Copy `apiKey` and `projectId` from the **same** Web app (Project settings → Your apps), set `FIREBASE_PROJECT_ID` to that `projectId`, restart `npm run dev`, then press **Sign out** and sign in again |
| You changed `.env` and nothing changes | Another value of the same name wins: one set in the terminal (for example an exported `FIREBASE_PROJECT_ID`), or, for the web app, a `.env.local` or `.env.development` file next to `.env` | Delete the extra file or unset the variable (a new terminal also works), then restart `npm run dev` |
| The Users page says "Something went wrong" and the API log shows a `ZodError` | The Firebase project is shared with an app whose own `users` collection holds other documents | The dashboard now skips documents it did not write and logs a warning. Move it to a project of its own, as described above |
| "Could not reach the API" | The API is not running, or it stopped at startup | Read the output of `npm run dev`; a "Cannot start" line says why |
| "...has not been given access" (it names the email you used) | You signed in with an account that is not invited, or `ADMIN_EMAIL` is not exactly that email | Check the email shown; set `ADMIN_EMAIL` to it for the first admin, or ask an admin to invite it |
| "this web address is not allowed to sign in" | The address is not in **Authentication → Settings → Authorized domains** | Open the app at `http://localhost:5173`, or add the domain |
| "Google sign-in is not turned on" | The Google provider is disabled | **Authentication → Sign-in method → Google → Enable** |

Still stuck? The API log shows the original error (look for a `"level":"error"` line and its `errorMessage`). Nothing in it is secret, so it is safe to paste when asking for help.

## Studio settings

The studio's name, logo, time zone, currency and usual date range come from one Firestore document, `settings/studio` (D-019, D-035). The dashboard works without it: it then says "Growth Analytics" in place of a studio name, uses Asia/Kolkata, INR and "Last 30 days", and the Overview says that the settings have not been saved. A screen to edit them arrives in phase P10. Until then, create the document by hand in the Firestore console (with the emulators: http://localhost:4000, the Firestore tab): collection `settings`, document id `studio`, with any of these fields.

| Field              | Example                        | Notes                                                              |
| ------------------ | ------------------------------ | ------------------------------------------------------------------ |
| `name`             | `Orbit Studio`                 | Shown in the menu, the top bar and the page title                  |
| `logoUrl`          | `https://example.com/logo.png` | An https address. Without it the menu shows the name's first letter |
| `timezone`         | `Asia/Kolkata`                 | A time zone name. Days are cut here                                |
| `currency`         | `INR`                          | Three letters                                                      |
| `defaultDateRange` | `30d`                          | `today`, `7d`, `30d` or `90d`                                      |
| `schemaVersion`    | `1`                            | Leave it at 1                                                      |

A field you leave out takes its default. A value that does not fit (a time zone that does not exist, say) makes the dashboard show "The studio settings did not load" with the field to fix.

## Demo data

`ANALYTICS_PROVIDER` in `.env` says where the numbers come from. `seed`, the default, generates the same made-up numbers on every run; the top bar then shows a **Demo data** label and the Overview says so too. `ga4` (real Google Analytics 4 data) arrives in phase P4. Until then the API refuses to start with that setting, because demo data shown as if it were real would be worse than no data.

## Apps

The **Apps** screen lists the apps this studio tracks. Admins add an app with a name and a package name (written like `com.example.myapp`), and can add its status, category, current version, launch date, GA4 property ID, Firebase project ID, Play Store address and icon address. A package name can be used once (capital letters do not count as a difference). Deleting an app asks for confirmation and cannot be undone.

## Scripts

| Command                 | What it does                                                                          |
| ----------------------- | ------------------------------------------------------------------------------------- |
| `npm run dev`           | Runs the API and the web app together                                                 |
| `npm run emulators`     | Starts the Firebase Auth and Firestore emulators (needs Java)                         |
| `npm run typecheck`     | TypeScript check in every workspace                                                   |
| `npm run lint`          | ESLint and a Prettier format check                                                    |
| `npm run format`        | Formats the codebase with Prettier                                                    |
| `npm run test`          | Unit tests in every workspace (Vitest)                                                |
| `npm run test:emulator` | Signs in against the real Auth and Firestore emulators and tests the API (needs Java) |
| `npm run build`         | Production builds of the API and the web app                                          |

## Layout

```
apps/api         Express API (TypeScript)
apps/web         React + Vite + Tailwind app
packages/shared  Enums, Zod schemas and shared helpers
docs/            Product documents
```

## Secrets

Never commit `.env`, service account keys or any credentials. Only `.env.example` (names, no values) is tracked.
