# Auto Warranty CRM — Frontend Boilerplate

This repository contains the frontend-only scaffold for the Auto Warranty Call Center CRM. It provides a Next.js (App Router) + TypeScript starter with Tailwind CSS and a locally-mocked API surface so frontend work can proceed without a running backend.

Quick start
```bash
npm install
npm run dev        # starts Next.js on http://localhost:3000
# optional: regenerate Tailwind output in a separate terminal
npm run dev:tailwind
```

What’s included
- Next.js App Router scaffold with role-based routes: `/fronter`, `/closer`, `/admin`, `/dashboard`, `/login` (under `app/`)
- TypeScript + Tailwind CSS configured via `tailwind.config.js`
- Mock Service Worker (MSW) mocks in `mocks/` and `public/mockServiceWorker.js`, auto-started by the mock provider at `app/providers/MockProvider.tsx`
- Auth helper (`lib/auth.ts`) and route guard (`components/auth/RequireRole.tsx`) implementing the login + role-based routing flow against the backend's `/auth/login` and `/auth/me` contract
- Dev scripts in `package.json`: `dev`, `build`, `start`, `lint`, `dev:tailwind`

Development notes
- This is frontend-only: once the real backend ships, request/response types should come from its OpenAPI schema instead of being hand-maintained here (see `Project_Boilerplate_Setup_Guide.md`).
- Copy `.env.example` to `.env` and set `NEXT_PUBLIC_API_URL` if you're pointing at a running backend instead of the MSW mocks.

See [Project_Boilerplate_Setup_Guide.md](Project_Boilerplate_Setup_Guide.md) for full bootstrapping steps, architecture decisions, and backend/API client generation instructions.
