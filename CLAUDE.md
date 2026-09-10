@AGENTS.md

# TGS Caller CRM — Frontend

Call center CRM frontend (Next.js App Router). Backend is a separate sibling
repo (`tgs-caller-crm-be`, FastAPI) — check it for the authoritative API
contract (`src/schemas/`, `src/routers/`) before inventing request/response
shapes.

## Stack & requirements

- Next.js (App Router, Turbopack), React 18, TypeScript (`strict: true`),
  MUI (`@mui/material` v9 + `@mui/icons-material` + `@mui/material-nextjs`),
  Emotion, Tailwind CSS v3.
- **Node >= 20.9** is required — `nvm use 20` before running `npm run dev`; the
  system default may be Node 16, which fails silently-ish (no listening port).
- `msw` mocks the backend in the browser (`app/providers/MockProvider.tsx`
  starts the worker; handlers in `mocks/handlers.ts`). Use mocks to build UI
  ahead of backend endpoints — the real backend stubs unbuilt routes with 501.
- Path alias `@/*` → repo root (`./*`), covers `app/`, `lib/`, `components/`.
  Prefer `@/lib/...`, `@/components/...` over relative `../../` imports.

## Auth & role model — the core domain rule

**Role selection never happens client-side.** The backend is the only source
of truth for a user's role(s); the frontend just reacts to it. This is a hard
product requirement, not a style preference — don't add a role dropdown/toggle
anywhere, even for demos.

Contract (frozen in the backend's `src/schemas/auth.py`, implementation may
still 501 until backend week 2):

- `POST /auth/login` `{email, password}` → `{access_token, token_type, expires_in_min}`
- `GET /auth/me` (Bearer token) → `{id, email, name, active, roles, created_at}`
- `RoleName = "fronter" | "closer" | "administrator"` — a user can hold
  multiple roles; frontend picks the landing route by priority
  (`administrator` > `closer` > `fronter`), see `lib/auth.ts`.

Frontend pieces:

- `lib/auth.ts` — `login()`, `getCurrentUser()`, `landingRouteForRoles()`,
  token storage (`localStorage`, key `tgs_crm_access_token`). Token in
  localStorage is a known trade-off for the pre-backend mock stage (XSS
  exposure vs. an httpOnly cookie) — revisit once real `/auth/login` ships.
- `components/auth/RequireRole.tsx` — client guard wrapping a page's content;
  redirects to `/login` if there's no token, the token is invalid, or the
  resolved roles don't include the required one. `RequireAuth` is the same
  but accepts any authenticated role (used by `/dashboard`, which isn't
  role-specific).
- Every role-landing page (`app/fronter`, `app/closer`, `app/admin`) wraps its
  body in `<RequireRole role="...">`. New protected routes must do the same —
  routes are open by default in Next.js, nothing blocks direct navigation
  unless a page explicitly guards itself.
- `/login` redirects an already-authenticated user straight to their landing
  route instead of re-showing the form.

## UI conventions

- **MUI is the component layer; Tailwind is for layout/spacing utilities.**
  Shared primitives in `components/ui/` wrap MUI (`Button` → `MuiButton`,
  `Input`/`Select`/`Textarea` → `TextField`, `Checkbox`, `Alert`, `Badge` →
  `Chip`, etc.). Prefer those wrappers over raw MUI or native HTML controls;
  extend them with props rather than duplicating styles. Feature tables and
  form composites may import MUI directly (`Table`, `RadioGroup`, …) when no
  shared wrapper exists yet.
- Theme lives in `lib/theme.ts` (`createTheme` + `tokens` mirrored from Figma /
  `tailwind.config.js`). Wired in `app/providers/AppProviders.tsx` via
  `AppRouterCacheProvider` (`prepend: true` so Tailwind `className` utilities
  still beat Emotion) + MUI `ThemeProvider`. Do **not** set `enableCssLayer`
  — that path is for Tailwind v4; on v3 it makes every MUI style lose to
  preflight.
- Visual theme (as of the Figma "CRM - Auto Warranty" file, superseding the
  earlier dark/teal theme): light (`bg-paper` / `tokens.paper` `#FCFCFC`),
  `ink` (`#1C2430`) for headings/dark surfaces, `navy` (`#1F3A5F`) for
  primary CTAs, `slate` (`#8A94A3`) for borders/placeholders/secondary text.
  `status-red` / `status-green` / `status-gold` / `status-blue` are
  accent/status colors only, not for primary CTAs. Keep `tokens` in
  `lib/theme.ts` and Tailwind color keys in sync when adding colors. Font is
  Inter, loaded via `next/font/google` in `app/layout.tsx` (`--font-inter`),
  on a 61/49/39/32/23/20/18/16/14/13px type scale (base 16, ~1.125 ratio,
  120% line-height). `Button` takes a `variant` prop (`primary` navy-filled /
  `secondary` slate-outlined) and a `size` prop (`default` / `small`).
- Errors (auth failures, form validation) render inline via `<Alert>` /
  `role="alert"` — never fail silently or let an unhandled rejection crash
  the page.

### Design source & known component specs

Source of truth for layout/spacing/typography is the Figma file
"CRM - Auto Warranty" (design.figma.com, file key `4lOil7SfItqviZwsYhi7ec`).
Pull exact values from Figma's Properties panel (Layout/Content/Typography/
Colors sections) rather than eyeballing screenshots — dev-mode inspection
gives px-accurate specs. Known specs pulled so far:

- **Notification (bell icon + label + unread-count badge)**, used in the
  active-call sidebar header: label frame is `77×21px` (hug), text style
  "Label 1" — Inter 400, 14px, 150% line-height, 0% letter-spacing, color
  `#2C2C2C` (not the `ink` token — check before assuming it maps 1:1).
  Sits next to a circular unread-count badge (`status-red` fill, white
  numeral) and a user identity block (avatar, name, email, sign-out icon)
  further down the same panel.

## Route-segment conventions (App Router)

Segments should carry their own `layout.tsx` for segment-specific metadata
(see `app/login/layout.tsx`) rather than leaving everything to the root
layout. Follow this pattern for new top-level routes that need their own
`<title>`.

## Known pre-existing issues (not caused by frontend feature work)

- `lib/api.tsx` has duplicated/broken content (imports a non-existent
  `packages/api-client/src/schema`, fails `tsc`). Don't extend it; it's
  unrelated scaffold cruft. `lib/auth.ts` uses plain `fetch` directly instead.
- `AGENTS.md` / `CLAUDE.md`'s `@AGENTS.md` block are auto-managed by
  `next dev` (see `node_modules/next/dist/server/lib/generate-agent-files.js`)
  — don't hand-edit the marked block, it gets regenerated. Content outside
  that block (this file) is left alone.
