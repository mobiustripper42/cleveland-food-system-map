# CLAUDE.md — Cleveland Food System Map

This file is the persistent context for Claude Code sessions on this project.
Read it at the start of every session. Do not skip it.

---

## What This Project Is

A community food resource web app for a Cleveland nonprofit, replacing a Google My Maps
implementation. Public-facing map of community gardens, urban farms, and farmers markets.
Lightweight admin UI for 2–5 authorized editors.

**Domain:** clevelandfoodsystem.land
**Repo:** cleveland-food-system-map

---

## Stack

| Layer    | Tool                                                                                       |
| -------- | ------------------------------------------------------------------------------------------ |
| Frontend | Next.js 16 (App Router, Turbopack) + React 19 + TypeScript                                 |
| Styling  | Tailwind + shadcn/ui (from starter); existing map components use inline styles             |
| Map      | react-leaflet + OpenStreetMap (client-only via `next/dynamic`, `ssr: false`)               |
| Backend  | Postgres (hosted on Supabase) via Drizzle; photos in a public bucket                       |
| Auth     | BetterAuth (Drizzle adapter, in-process) — email code, passkey, password, Google, Facebook |
| Email    | Resend (`resend` SDK in `lib/email.ts`) — sign-in, verification, and reset codes           |
| Hosting  | Vercel                                                                                     |
| DNS      | Namecheap → Cloudflare → Vercel                                                            |

---

## Repo Structure

```
/
├── app/                  # Next.js App Router routes
│   ├── layout.tsx        # Root layout + site metadata; icon.svg = favicon
│   ├── (site)/           # Home `/`: layout.tsx = nav + top/footer site sections; page.tsx (server, Drizzle) → MapClient.tsx ('use client'). `/map` 308s here; `/?location=<id>` opens that panel
│   │   └── locations/    # Public browse: page.tsx (tiles/list, category + name filter, URL state via lib/browse.ts); [id]/ = per-location page (prerendered, metadata, JSON-LD); [id]/edit/ = edit page (editors + that location's owners) incl. People (contacts + owners in one list); new/ = editor-only create (button on the list), actions.ts = location server actions (asUser), people-actions.ts = contacts/owners on a location, file-actions.ts = upload/remove files
│   ├── sitemap.ts, robots.ts # / + /locations + every published /locations/<id>
│   ├── admin/            # Editors only: index of admin tools; sections/ (site_sections HTML), editors/ (add/remove editors) — server actions via asUser
│   ├── login/            # Sign-in / sign-up page (email code default, passkey, password, Google, Facebook)
│   ├── account/          # Signed-in users: contact info (own `contacts` row), passkeys
│   └── api/auth/[...all]/ # BetterAuth handler (all auth endpoints)
├── components/           # shadcn components + login form, auth/logout buttons, nav-links
│   ├── map/              # map-view (Leaflet), location-panel, category-filter, search-bar — client-only, via MapClient
│   └── locations/        # location-details (shared by map panel + detail page, no hooks), location-tile (tile/row), locations-browser, location-fields (inputs shared by create + edit), location-form (create), location-edit-form (edit), location-people (contacts + owners list; owners see contacts only), profile-image-field (browser-scaled upload to R2), edit-link (streams per-request edit access)
├── hooks/                # use-is-desktop (SSR-safe)
├── lib/
│   ├── types.ts          # Shared TypeScript types (derived from Drizzle schema/queries)
│   ├── geo.ts            # LatLng/UserPosition, haversine distanceMiles, formatMiles
│   ├── db/               # Drizzle: schema.ts, auth-schema.ts (BetterAuth tables), index.ts (server-only client), queries.ts, users.ts, contacts.ts (contact ↔ user linking)
│   ├── sections.ts       # SECTION_KEYS + sanitize-html allowlist for site_sections (server-only)
│   ├── locations.ts      # CATEGORIES, category labels/colors, status labels + parseLocationForm (shared client/server validation)
│   ├── format.ts         # schedule/time/phone formatters, directionsUrl
│   ├── browse.ts         # /locations URL state: parseBrowseParams, browseQuery, matchesName
│   ├── site-url.ts       # SITE_URL (absolute origin from Vercel env) — metadataBase, sitemap, robots
│   ├── address.ts        # street/city/state/zip helpers: formatAddress, parseOneLineAddress (client/server/scripts)
│   ├── phone.ts          # normalizePhone — storage format for contact phones (client/server/scripts)
│   ├── geocode.ts        # US Census geocoder (free, no key) + Cleveland bbox check — form lookup + import-kml
│   ├── files.ts          # location file types, scaling/size limits, R2 key prefix (client + server)
│   ├── r2.ts             # Cloudflare R2 (aws4fetch, server-only): presigned PUT, HEAD, list, delete, prefix sweep
│   ├── auth.ts           # BetterAuth server config (server-only)
│   ├── auth-client.ts    # BetterAuth React client, for 'use client' code
│   ├── session.ts        # getSession() — the one way server code reads the session
│   ├── email.ts          # Resend sender (one-time codes)
│   └── utils.ts
├── proxy.ts              # Next 16 proxy (formerly middleware) — default-deny, optimistic session-cookie check
├── scripts/
│   ├── import-kml.ts     # KML import tool — permanent, not throwaway
│   └── add-editor.ts     # Grant editor access by email
├── CLAUDE.md
├── dev-decisions.md
└── .env.example
```

Import alias: `@/*` → repo root (e.g. `@/components/map/map-view`, `@/lib/auth-client`).
`lib/db/schema.ts` imports with `.ts` extensions so `scripts/` can run it under plain Node.

---

## Database Schema

Source of truth: `lib/db/schema.ts` (Drizzle). Migrations in `drizzle/` — `npm run db:generate`,
`npm run db:migrate`. Functions/triggers/grants Drizzle can't express are custom migrations there.

| Table                                                   | Purpose                                                                                                                             |
| ------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `locations`                                             | Public site data. `status` enum `draft \| published \| archived` (default `draft`). Address split into `street/city/state/zip` |
| `market_schedules`                                      | Weekday + open/close time + optional season dates, per location                                                                     |
| `contacts`                                              | Manager name/phone/email — PII. Optional `user_id` (unique) = that user's profile; see Auth → Contacts ↔ users                   |
| `location_contacts`                                     | locations ↔ contacts (many-to-many)                                                                                                 |
| `location_files`                                        | Files in R2 per location: `type` enum (`profile` only, one per location), `path`/`thumb_path` = R2 keys. Editors + owners insert/delete |
| `location_owners`                                       | locations ↔ BetterAuth `user` — non-editors who may edit that location's content (not status). Managed on `/locations/<id>/edit` (People) |
| `site_sections`                                         | Editor HTML per page slot (`key` PK: `top`, `footer`). Public read; sanitized on save and render. No delete — empty hides           |
| `editors`                                               | Allowlist of BetterAuth `user` ids — managed at `/admin/editors` or `npm run add-editor -- <email>`                                 |
| `user`, `session`, `account`, `verification`, `passkey` | BetterAuth tables (`lib/db/auth-schema.ts`, camelCase TS keys). RLS on, no policies, no grants — server only                        |

- Primary keys are KSUIDs from `public.gen_ksuid()` (DB default)
- `created_at/by`, `updated_at/by` are set by the `set_audit_fields` trigger; client values are ignored
- Snake_case TS keys on app tables (types derive from them in `lib/types.ts`)
- `*_by` and `editors.user_id` are `text` FKs to `user.id`. Supabase-era users were migrated with ids kept

RLS (portable — no Supabase roles or `auth.uid()`):

- Policies target role `app_user` and read `public.current_user_id()` (the `app.user_id` setting, set by `asUser()`)
- Any `app_user`: `locations` where `status = 'published'`, and their schedules
- Editors (row in `editors`): read all, insert/update everything; delete schedules/contacts/links
- Owners (row in `location_owners`): read + update their own locations; see their own `location_owners` rows. Changing
  `status` is editor-only — `locations_status_editor_only` trigger (RLS can't compare old/new), applies to `app_user` only
- Contacts: editors all; the linked user reads/updates their own; owners read contacts on their locations and update one only
  if it's unclaimed and every location it's on is theirs (`public.owns_all_contact_locations`, security definer). Owners
  attach/detach `location_contacts` on their locations and insert unclaimed contacts (`contacts_insert_owner` — no
  RETURNING, it's invisible until linked; pre-fetch the id with `gen_ksuid()`). `contacts_link_guard` trigger: `app_user` can't set `user_id` or
  change a claimed contact's email
- Nobody can delete `locations` — archive instead
- Editors read/insert/delete `editors` via security-definer `public.is_editor()` (a policy on `editors` can't
  subquery itself). Delete excludes your own row, so the last editor can't be removed
- Signed in ≠ editor: OAuth lets anyone create a user
- `anon`/`authenticated` have no grants on `public` — Supabase's Data API is closed; the app never uses it
- Migration history replays only on Supabase (early migrations reference `auth.users`). To move hosts,
  `pg_dump` the `public` schema + recreate the `app_user` role instead of replaying

---

## Environment Variables

Never commit secrets. All env vars in Vercel dashboard and `.env.local` locally.

See `.env.example`: `DATABASE_URL`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `GOOGLE_CLIENT_ID/SECRET`,
`FACEBOOK_CLIENT_ID/SECRET`, `RESEND_API_KEY`, `EMAIL_FROM`, `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`,
`R2_BUCKET`, `R2_PUBLIC_BASE_URL`.
No `NEXT_PUBLIC_*` vars — nothing client-side needs config.

`.env.local` is gitignored. `.env.example` is committed with empty values.

---

## Design Rules

- **Mobile first.** Every component starts at 320px and scales up.
- **Breakpoint:** 768px for desktop layout (sidebar + map).
- **Colors:** white/grey/black base. `#3a7d44` accent used sparingly.
- **Links:** blue `#1d4ed8` + underline (Tailwind preflight strips both — set them explicitly).
- **No red** anywhere — colorblind accessibility.
- **Destructive actions** use dark/black styling, never red.
- **Typography:** clean, no decorative fonts in UI.
- Less is more. No over-polished AI aesthetic.

### Pin colors

| Category                    | Color            |
| --------------------------- | ---------------- |
| Community Garden            | `#3a7d44` green  |
| Urban Farm                  | `#c0392b` red    |
| Farmers Market / Farm Stand | `#7b2d8b` purple |

---

## Auth

- BetterAuth (`lib/auth.ts`). Sign-up is open; being signed in grants nothing without an `editors` row
- Methods: emailed 6-digit code (default, also creates accounts), passkey (added from `/account`,
  rpID = `BETTER_AUTH_URL` hostname), email + password, Google, Facebook
- Every emailed thing is a code via the `emailOTP` plugin, sent with Resend (`lib/email.ts`; `EMAIL_FROM`
  must be on a Resend-verified domain): sign-in, password-account verification
  (`requireEmailVerification`), password reset. No links
- Account linking: Google only (verified emails). Unverified local accounts never get linked, and a code
  sign-in on one revokes its unproven password — blocks pre-registration takeover. Don't loosen
  `requireLocalEmailVerified` or trust Facebook
- Contacts ↔ users (`lib/db/contacts.ts`): linking is lazy and proof-based — a contact is claimed when a user with a
  *verified* matching email exists (BetterAuth `databaseHooks` on user create/update, KML import, `/account` save).
  Contacts never create users. Claimed email mirrors `user.email`. Users edit name/phone on `/account`
- Server: `getSession()` from `lib/session.ts`. Client: `authClient` from `lib/auth-client.ts`
- Protected routes redirect unauthenticated users to `/login`. The proxy cookie check is optimistic —
  always verify with `getSession()` in the page/action
- Editor management: `/admin/editors` (by email; creates a verified user if missing, via `lib/db/users.ts`)
  or `npm run add-editor -- <email>`. No invite email is sent
- Never roll custom auth logic

---

## Data Rules

- `status = 'published'` is the public filter — never hard delete; archive with `status = 'archived'`
- KML import script lives in `scripts/import-kml.ts` — upserts on name + lat + lng; one-line KML addresses split via `parseOneLineAddress`
- Address is stored split (`street`, `city`, `state`, `zip`); public queries join it into one `address` string with `formatAddress`
- Geocoding: `lib/geocode.ts` (Census, US only, misses bare place names). Admin form looks it up on demand and on save when coordinates are blank — editor-gated so we're not an open geocoding proxy
- Files live in Cloudflare R2 bucket `food-system-map`, rows in `location_files` with a `type` that says where
  the UI uses them. Only `profile` (the hero image) so far — add types with the features that use them
- R2 keys: `locations/<location_id>/<type>/<uuid>.<ext>` (server-generated, never reused, cached immutable).
  Public URL = `R2_PUBLIC_BASE_URL` + key, built server-side in `lib/db/queries.ts` (`image_url`, `thumb_url`)
- Read data via Drizzle on the server (`lib/db`), not supabase-js. `DATABASE_URL` bypasses RLS —
  public queries must filter `status = 'published'` and select no PII/audit columns themselves;
  contact queries must check editor membership (`getEditorContacts()`)
- User-initiated writes go through `asUser(session.user.id, tx => …)` (`lib/db/index.ts`): runs as `app_user`
  with `app.user_id` set, so RLS enforces editor membership and the audit trigger records `*_by`.
  After writes that change the public map, `updateTag(LOCATIONS_TAG)`
- Uploads: the browser scales (≤1600px + ≤480px thumb, WebP else JPEG), gets presigned PUTs from
  `startProfileUpload`, PUTs straight to R2, then `finishProfileUpload` HEAD-checks the objects and swaps the
  row. Old objects are removed by `sweepPrefix` after commit (it also clears abandoned uploads older than 15 min).
  Never delete a `location_files` row without sweeping its prefix
- Unauthenticated access: `proxy.ts` is default-deny; public routes are allowlisted there

---

## Workflow Rules

- All feature work on `dev` branch
- PR to `main` — even solo
- Every PR gets code review agent comment before merge
- Reference issue numbers in commits: `fixes #12`
- Pull before every session — non-negotiable
- CLAUDE.md gets updated at the start of each new phase

---

## Completed Phases

### Phase 0 — Pre-Development

- [x] dev-decisions.md committed to repo
- [x] CLAUDE.md committed to repo
- [x] GitHub Project board created
- [x] All issues created via setup script
- [x] Supabase project created
- [x] Vercel project created, linked to repo

### Phase 1 — Scaffold

- [x] Vite + React + TypeScript scaffold initialized
- [x] react-leaflet, react-router-dom, @supabase/supabase-js installed
- [x] .env.example committed
- [x] Repo structure in place per CLAUDE.md

### Phase 2 — Data & Infrastructure

- [x] `locations` table created with schema above
- [x] Unique constraint on `(name, lat, lng)`
- [x] `lat` and `lng` are nullable — markets missing coordinates imported with null
- [x] RLS policies in place (anon select archived=false, authenticated select all, authenticated write)
- [x] Storage bucket `location-images` created — 5MB limit, jpeg/png/webp only
- [x] KML import script at `scripts/import-kml.ts` — run with `npm run import-kml`
- [x] 105 records imported from KML

### Phase 3 — Public Map UI

- [x] `src/lib/supabase.ts` — typed Supabase client
- [x] `src/lib/types.ts` — shared TypeScript types from DB schema
- [x] `src/pages/MapPage.tsx` — public map with react-leaflet
- [x] Category-colored pins (green/red/purple per design rules)
- [x] Click-to-open location detail panel (mobile sheet, desktop sidebar overlay)
- [x] Filter by category with counts
- [x] Client-side text search (name + notes, debounced 200ms)
- [x] Locations with null lat/lng excluded from map, no error thrown
- [x] Accessibility pass — ARIA labels, keyboard nav, focus management, WCAG AA contrast
- [x] Mobile zoom buttons fixed (custom `<button>` control, no `<a href="#">`)
- [x] Mobile keyboard/viewport fix (`100dvh`)
- [ ] Custom pin icons — #50 (deferred, needs design reference)
- [ ] Collapsible search/filter strip — #45 (deferred)
- [ ] Desktop sidebar pushes map — #48 (deferred)

---

## Current Phase

**Vite → Next.js migration (in progress, branch `getabetterpic/map-in-nextjs`)**

- [x] Next.js + Supabase starter scaffolded (`create-next-app`), Prettier added
- [x] Public map ported to `app/map/page.tsx` (`MapView` loaded with `ssr: false`)
- [x] `leaflet`, `react-leaflet`, `@types/leaflet` re-added
- [x] `src/lib/supabase.ts` switched to `@supabase/ssr` + `NEXT_PUBLIC_*` env vars
- [x] `useIsDesktop` made SSR-safe (defaults to mobile, resolves after mount)
- [x] Vite leftovers removed (entry files, configs, template CSS/assets, `src/pages-src/`)
- [x] `import-kml` restored on the Drizzle schema — `npm run import-kml` (Node runs the .ts directly; needs `DATABASE_URL`)
- [x] Map is the home page `/` (`app/(site)/`); `/map` → `/` (308 in `next.config.ts`)
- [x] `site_sections` table + `/admin/sections` editor — top and footer HTML above/below the map
- [x] Starter leftovers removed (Supabase OG image, next-themes/dark mode, unused shadcn components); metadataBase → production URL
- [x] Replace starter auth with BetterAuth (folds into #26/#27)
- [x] Map reads via Drizzle in a server component; `src/lib/supabase.ts` + `useLocations` removed
- [x] `/map` layout with nav + auth button; `/map` public in proxy allowlist
- [x] `src/` folded into `components/map/`, `hooks/`, `lib/`
- [ ] Update Vercel project framework preset + env vars

**Phase 4 — Admin UI** (paused until migration lands)

- [x] Auth flow — email code (default), passkey, password, Google, Facebook (#26) — BetterAuth
- [x] Protected route — redirect unauthenticated to /login (#27)
- [x] Location list view (#28) — made public at `/locations` (+ `/locations/[id]`, sitemap); admin can reuse its components with a status filter
- [x] Add location form (#29) — `/locations/new`, editor-only "New location" button on `/locations` (old `/admin/locations/new` 308s)
- [x] Edit location form (#30) — `/locations/[id]/edit`, Edit links on list tiles/rows + map panel; People section = contacts + owners (one row per person, joined on `contacts.user_id`)
- [x] Archive / restore location (#31) — status filter on `/locations` for editors/owners (`getManagedLocations`, via RLS); status changes in the edit form
- [x] Image upload (#32) — profile image on Cloudflare R2 (`location_files`, browser-scaled, presigned PUT)
- [ ] R2 custom domain (e.g. files.clevelandfoodsystem.land) instead of the r2.dev URL — env change only
- [ ] Form validation — client and Supabase (#33)
- [ ] Mobile-first admin layout (#34)

---

## Agent Notes

### Code Review Agent

Runs on every PR via GitHub Actions. Posts review as a PR comment.
Workflow file: `.github/workflows/code-review.yml`
Focus: TypeScript correctness, security (no exposed keys), RLS policy gaps, mobile layout issues.

### KML Import Validation Agent

Runs as part of `scripts/import-kml.ts` before any upsert.
Reports: duplicate names, missing coordinates, malformed email/phone, unknown categories.
Critical errors (unrecognized category) skip that record. Warnings (missing coords, no contact, out-of-range ward, outside bounding box) are logged but never block the import.

---

## Prompt Tips for This Project

- Always specify file paths explicitly
- Name exact fields, types, and behavior expected
- Auth touches at least two layers — always say so in the prompt
- Form changes touch UI + validation + Supabase call — specify all three
- Mobile layout first, then desktop — never the other way
- Anything touching `window`/`document`/Leaflet needs `'use client'` and, at import time,
  `next/dynamic` with `ssr: false` — say which in the prompt
- `cacheComponents` keeps left routes alive in a hidden `<Activity>`: effects tear down on navigate-away
  and re-run on return, state and DOM persist. Imperative libs (Leaflet) must survive that — see
  `useFreshInstance` in `components/map/map-view.tsx`
- Build prerenders every `/locations/[id]`: the DB pool drops to 1 connection per worker in the build phase
  (`lib/db/index.ts`) so the session pooler's 15-client cap holds. Don't raise it
- Server vs browser auth matters: `getSession()` (`lib/session.ts`) in server components/actions,
  `authClient` (`lib/auth-client.ts`) in `'use client'` code

## Communication Style

- Prompts are the deliverable — keep them tight and copyable
- No disclaimers, no beginner warnings
- Flag uncertainty explicitly rather than guessing
- Answer within scope of what was asked
- Be terse. One or two sentences unless the answer genuinely requires more.
  No preamble, no summary at the end. Sarcasm appreciated

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
