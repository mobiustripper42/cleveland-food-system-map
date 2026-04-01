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

| Layer | Tool |
|---|---|
| Frontend | React + Vite + TypeScript |
| Map | react-leaflet + OpenStreetMap |
| Backend | Supabase (Postgres + Auth + Storage) |
| Hosting | Vercel |
| DNS | Namecheap → Cloudflare → Vercel |

---

## Repo Structure

```
/
├── src/
│   ├── components/       # Shared UI components
│   ├── pages/            # Route-level components
│   │   ├── MapPage.tsx   # Public map
│   │   └── admin/        # Admin UI (protected)
│   ├── lib/
│   │   ├── supabase.ts   # Supabase client (typed)
│   │   └── types.ts      # Shared TypeScript types
│   ├── hooks/            # Custom React hooks
│   └── styles/           # Global CSS, tokens
├── scripts/
│   └── import-kml.ts     # KML import tool — permanent, not throwaway
├── CLAUDE.md
├── dev-decisions.md
└── .env.example
```

---

## Database Schema

```sql
create table locations (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  category      text not null check (category in ('garden','farm','market')),
  lat           numeric(10,7),          -- nullable: some markets imported without coordinates
  lng           numeric(10,7),          -- nullable: some markets imported without coordinates
  address       text,
  ward          integer,
  manager_name  text,
  phone         text,
  email         text,
  notes         text,
  image_url     text,
  archived      boolean not null default false,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint locations_name_lat_lng_key unique (name, lat, lng)
);
```

RLS policies:
- `anon` role: SELECT where `archived = false`
- `authenticated` role: SELECT all rows (including archived)
- `authenticated` role: INSERT, UPDATE, DELETE

---

## Environment Variables

Never commit secrets. All env vars in Vercel dashboard and `.env.local` locally.

```
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
```

`.env.local` is gitignored. `.env.example` is committed with empty values.

---

## Design Rules

- **Mobile first.** Every component starts at 320px and scales up.
- **Breakpoint:** 768px for desktop layout (sidebar + map).
- **Colors:** white/grey/black base. `#3a7d44` accent used sparingly.
- **No red** anywhere — colorblind accessibility.
- **Destructive actions** use dark/black styling, never red.
- **Typography:** clean, no decorative fonts in UI.
- Less is more. No over-polished AI aesthetic.

### Pin colors
| Category | Color |
|---|---|
| Community Garden | `#3a7d44` green |
| Urban Farm | `#c0392b` red |
| Farmers Market / Farm Stand | `#7b2d8b` purple |

---

## Auth

- Supabase Auth: magic link + Google OAuth + GitHub OAuth
- Protected routes redirect unauthenticated users to `/login`
- Editor management done in Supabase dashboard — no custom invite UI
- Never roll custom auth logic

---

## Data Rules

- `archived = false` is the public filter — never hard delete
- `archived = true` hides from public map and admin default view
- KML import script lives in `scripts/import-kml.ts` — upserts on name + lat + lng
- Single hero image per location stored in Supabase Storage bucket `location-images`
- Image URL stored as `image_url` on the locations record

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

---

## Current Phase

**Phase 3 — Public Map UI**

- [ ] `src/lib/supabase.ts` — typed Supabase client
- [ ] `src/lib/types.ts` — shared TypeScript types from DB schema
- [ ] `src/pages/MapPage.tsx` — public map with react-leaflet
- [ ] Category-colored pins (green/red/purple per design rules)
- [ ] Click-to-open location detail panel (mobile sheet, desktop sidebar)
- [ ] Filter by category
- [ ] Locations with null lat/lng excluded from map, no error thrown

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

## Communication Style

- Prompts are the deliverable — keep them tight and copyable
- No disclaimers, no beginner warnings
- Flag uncertainty explicitly rather than guessing
- Answer within scope of what was asked
- Be terse. One or two sentences unless the answer genuinely requires more. 
No preamble, no summary at the end. Sarcasm appreciated