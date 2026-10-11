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

## Quick start

```bash
npm install
cp .env.example .env     # defaults run on labeled demo data
npm run dev              # API on :8787, web on :5173
```

## Scripts

| Command             | What it does                                    |
| ------------------- | ----------------------------------------------- |
| `npm run dev`       | Runs the API and the web app together           |
| `npm run typecheck` | TypeScript check in every workspace             |
| `npm run lint`      | ESLint and a Prettier format check              |
| `npm run format`    | Formats the codebase with Prettier              |
| `npm run test`      | Unit tests in every workspace (Vitest)          |
| `npm run build`     | Production builds of the API and the web app    |

## Layout

```
apps/api         Express API (TypeScript)
apps/web         React + Vite + Tailwind app
packages/shared  Enums, Zod schemas and shared helpers
docs/            Product documents
```

## Secrets

Never commit `.env`, service account keys or any credentials. Only `.env.example` (names, no values) is tracked.
