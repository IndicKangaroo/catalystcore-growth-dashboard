# Growth Analytics Dashboard

An internal dashboard that connects app analytics (Firebase / GA4) with social-media campaigns, to answer one question: **which content and campaigns are contributing to real product growth?**

Status: under construction. Start with these files:

- `docs/PRD.md`: product requirements
- `PLAN.md`: build plan, phases and open questions
- `DECISIONS.md`: decision log (what was decided and why)
- `AGENTS.md`: rules for AI coding agents (also a good read for human contributors)

## Requirements

- Node.js 22 or newer (`.nvmrc` is provided)
- npm 10 or newer
- Java 11 or newer, only if you use the Firebase emulators (the Firestore emulator needs it)

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
3. Open http://localhost:5173 and choose **Sign in with Google**. The emulator opens its own pop-up instead of Google: add a new account with the same email as `ADMIN_EMAIL` and sign in. You arrive as an admin, and **Users** appears in the header.

The emulators forget everything when they stop, so the first sign-in creates the admin again each time. Their dashboard is at http://localhost:4000.

### Option B: a real Firebase project

1. In the [Firebase console](https://console.firebase.google.com), create a project or reuse one. Under **Authentication → Sign-in method** enable **Google**. Under **Firestore Database** create a database in production mode.
2. Under **Project settings → General → Your apps**, add a **Web app**. Copy its `apiKey` and `projectId` into `VITE_FIREBASE_API_KEY` and `VITE_FIREBASE_PROJECT_ID`. These identify the project and are not secrets.
3. Set `FIREBASE_PROJECT_ID` to the same project id, and `ADMIN_EMAIL` to your Google account's email.
4. Give the API credentials for Firestore. On your own machine either run `gcloud auth application-default login`, or create a service account key (**Project settings → Service accounts → Generate new private key**), save the file outside the repository and set `GOOGLE_APPLICATION_CREDENTIALS` to its path. On Cloud Run the runtime service account is used and nothing needs setting.
5. Deploy the deny-all Firestore rules once: `npx firebase-tools login`, then `npx firebase-tools deploy --only firestore:rules --project <your project id>`.
6. Run `npm run dev`, open http://localhost:5173 and sign in with the `ADMIN_EMAIL` account.

## Scripts

| Command             | What it does                                                  |
| ------------------- | ------------------------------------------------------------- |
| `npm run dev`       | Runs the API and the web app together                         |
| `npm run emulators` | Starts the Firebase Auth and Firestore emulators (needs Java) |
| `npm run typecheck` | TypeScript check in every workspace                           |
| `npm run lint`      | ESLint and a Prettier format check                            |
| `npm run format`    | Formats the codebase with Prettier                            |
| `npm run test`      | Unit tests in every workspace (Vitest)                        |
| `npm run build`     | Production builds of the API and the web app                  |

## Layout

```
apps/api         Express API (TypeScript)
apps/web         React + Vite + Tailwind app
packages/shared  Enums, Zod schemas and shared helpers
docs/            Product documents
```

## Secrets

Never commit `.env`, service account keys or any credentials. Only `.env.example` (names, no values) is tracked.
