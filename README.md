# Auto Warranty CRM — Frontend

Next.js (App Router) frontend for the Auto Warranty Call Center CRM. The API
lives in the sibling repo [`tgs-caller-crm-be`](../tgs-caller-crm-be); this
app consumes that contract via a generated TypeScript schema and uses MSW for
local UI work when the backend is unavailable.

## Quick start

```bash
nvm use 20          # Node >= 20.9 required
npm install
npm run dev         # http://localhost:3000
# optional: regenerate Tailwind output in a separate terminal
npm run dev:tailwind
```

## What’s included

- App Router routes: `/fronter`, `/closer`, `/admin`, `/dashboard`, `/login`
- TypeScript, Tailwind CSS, MUI wrappers under `components/ui/`
- MSW mocks (`mocks/`, started by `app/providers/MockProvider.tsx`)
- Auth helpers (`lib/auth.ts`) and route guards (`components/auth/RequireRole.tsx`)
- Scripts: `dev`, `build`, `start`, `lint`, `dev:tailwind`, `gen:api-client`

## API contract & typed client

The backend owns the HTTP contract. FastAPI exports it to
`tgs-caller-crm-be/openapi/openapi.json`. This frontend never hand-edits that
JSON; it regenerates TypeScript types from it.

| Artifact | Role |
|----------|------|
| `../tgs-caller-crm-be/openapi/openapi.json` | Source of truth (backend) |
| `lib/generated/schema.d.ts` | Generated `paths` / `components` types (do not edit by hand) |
| `npm run gen:api-client` | One-command regen via `openapi-typescript` |

### Regenerate types

Clone both repos as siblings under the same parent (e.g. `crm/tgs-caller-crm-be`
and `crm/tgs-caller-crm-fe`), then from this repo:

```bash
npm run gen:api-client
# equivalent: pnpm gen:api-client
```

That runs:

```text
openapi-typescript ../tgs-caller-crm-be/openapi/openapi.json -o ./lib/generated/schema.d.ts
```

No running API server is required. After backend schema changes, refresh the
backend OpenAPI export first (`uv run python -m scripts.export_openapi` in
`tgs-caller-crm-be`), then re-run `gen:api-client` here and commit the updated
`lib/generated/schema.d.ts`.

Import generated types as:

```ts
import type { paths } from '@/lib/generated/schema'
```

`lib/api.tsx` is a thin typed `fetch` helper over those `paths`. Feature modules
may still call `fetch` directly today; prefer migrating new call sites onto the
generated types so FE and BE stay aligned with the frozen contract (auth, leads,
qualification, transfers, dashboard live-status).

## Environment

Copy `.env.example` to `.env` and set `NEXT_PUBLIC_API_URL` when pointing at a
running backend instead of MSW.

See [Project_Boilerplate_Setup_Guide.md](Project_Boilerplate_Setup_Guide.md) for
broader architecture notes. Agent-oriented conventions live in `CLAUDE.md`.
