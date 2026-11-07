## Cleveland Food System Map

### Stack

- React + Vite + TypeScript — TS from day one, no exceptions
- react-leaflet + OpenStreetMap — no API key, free forever
- Supabase — Postgres + Storage today; nothing in the app depends on Supabase-only APIs
- Vercel — hosting, CI/CD on push to main
- Resend — transactional email (auth codes); swapping providers is a `lib/email.ts` change
- Namecheap → Cloudflare → Vercel

### Auth

- Email one-time code (default) + passkeys + email/password + Google + Facebook (2026-11; replaced
  magic link + GitHub). Open sign-up — editor access is still a separate `editors` row
- BetterAuth (2026-11, replaced Supabase Auth) — library handles all of it, no custom auth code.
  Runs in-process and stores users/sessions in our own Postgres via Drizzle, so auth moves
  with the database to any Postgres + Node host. Supabase Auth tied sessions, RLS
  (`auth.uid()`, `authenticated` role) and Storage policies to Supabase
- RLS kept as defense in depth, made portable: own `app_user` role + `public.current_user_id()`
  reading `app.user_id`, set per transaction by `asUser()`
- Codes (sign-in, verification, reset) sent with Resend — all sending lives in `lib/email.ts`, so
  swapping providers is a one-file change
- Editor management via `npm run add-editor -- <email>`, not custom UI
- Photo upload removed with Supabase Auth; returns on Cloudflare R2 (presigned uploads)

### Data

- Discrete fields — no blobs. Schema in `lib/db/schema.ts` (Drizzle)
- Manager PII in separate `contacts` table, editor-only via RLS
- Soft delete via `status = 'archived'` — nothing hard deleted
- Single hero image per location, public bucket (Supabase Storage now, R2 later)
- KML import script is permanent tooling, not throwaway — runs at cutover

### Design

- Mobile first — full-screen map on mobile, sidebar layout on desktop
- Breakpoint: 768px
- White/grey/black base, #3a7d44 accent used sparingly
- Destructive actions dark-styled, never red
- No over-polished aesthetic

### Agents

- Code review agent on every PR via GitHub Actions + Claude API
- KML import validation agent — anomaly report before any import
- Geocoding assist (Phase 5+) via OpenStreetMap Nominatim

### Workflow

- dev branch for all feature work, PR to main
- PRs even solo — clean history
- CLAUDE.md in repo root — updated before every new phase
- Claude Code = hands. This chat = architect.
