# Tiller — community verification loop (freshness as a first-class property)

**Overnight idea, 2026-06-17.** One idea, argued. Draft PR; you're the gate. Pitch + execute-ready build handoff below.

---

## The pitch

### The idea

The map renders 105 dots as if they were permanent. Every one is a volunteer-run, seasonal, "active or in-progress" site — and the thing this app replaces (a Google My Maps) died of exactly one disease: the data rotted and no one could tell. So make **freshness a first-class, visible property** and close a **community verification loop**.

Every location gets a `last_verified_at`. Each `LocationPanel` gets a one-tap, no-account control — **Still here ✓ / Gone ✗ / Suggest an edit ✎** — that writes to a quarantined `submissions` table (insert-only anon RLS). The 2–5 editors work a live moderation queue; an approved ✓ stamps `last_verified_at`. Pins whose freshness has lapsed (or was never confirmed) **desaturate** and carry a "Confirmed N days ago" / "Unconfirmed" badge — opacity and grey, never red (design rule holds). The same `submissions` spine, pointed at a second input, is the structured replacement for the original Google Form's "suggest a location": community adds, community confirms, community retires. **One table, one anon-INSERT policy, one editor queue** — not two features.

### Why it's worth it

The founding justification for this whole project is *maintainability* — you're rebuilding because My Maps rotted. But the rebuild so far reproduces the same failure mode: an editor-only CRUD admin (Phase 4) means freshness depends on 2–5 volunteers cold-re-surveying 105 seasonal sites forever, which is precisely what didn't happen last time. The verification loop turns every visitor into a sensor and the nonprofit's job from "re-survey the city" into "triage a queue" — the only model that scales to volunteer-run data. The screenshot that sells it to FARE isn't a prettier pin; it's *"this site confirmed active by the community 2 days ago."* And it's the schema-native replacement for both Google Forms the rebuild quietly dropped — strictly better than the lossy form-response sheet they came from. Timing: Phase 4 is about to build the exact admin auth + shell this rides on, so the `submissions` spine is a clean **Phase 4.5** that makes the admin work pay for itself twice.

### Why you haven't

The project was framed, reasonably, as a faithful port: move the pins, match the behavior, then build editor CRUD. "The data will rot" is a *lifecycle* concern, and a port-and-ship framing only ever surfaces *cartography* concerns — pins, filters, panels. Same blind spot PR #51 named, different axis: that one was about *demand* (who the map ignores), this is about *currency* (whether the map is still true). And dropping the two Google Forms *felt* like a simplification — lossy free-text forms swapped for clean editor CRUD, which it was — but it silently deleted the one thing keeping the old map even partly alive: the community could flag reality. Restoring that as structured schema instead of a form sheet is the move the simplification framing hid.

---

## The build handoff

You can't run the project from Tiller's environment, so this is the execute-ready plan for a Claude Code session on mill-dev.

### Approach

One quarantined write spine serving two inputs (verify + suggest/edit). Key decisions:

- **One `submissions` table, not two features.** `id uuid pk`, `kind text` ∈ `verify_active | verify_gone | suggest_edit | suggest_new`, `location_id uuid null references locations(id)` (null for `suggest_new`), `payload jsonb` (edit → proposed field changes; new → proposed location; verify → optional note), `status text` ∈ `pending | approved | rejected` default `pending`, `created_at timestamptz default now()`, `reviewed_at timestamptz null`, `reviewed_by uuid null`.
- **RLS — this is the project's first public-write path, so get it exactly right.** `anon` gets INSERT only (no SELECT/UPDATE/DELETE); a WITH CHECK constrains inserts to `status='pending'` and a legal `kind`, so the internet can't write `approved` or set `reviewed_*`. `authenticated` editors get full SELECT/UPDATE. **Read the Supabase "Postgres rules for AI agents" guidance before writing the policy** — it exists to catch exactly this RLS mistake.
- **`last_verified_at timestamptz null` on `locations`.** Stamped `now()` when an editor approves a `verify_active` (or hits "mark verified"). Public read already does `select *`, so it flows through for free.
- **Freshness decay is pure client presentation.** Compute age from `last_verified_at`; `null` or `> STALE_DAYS` (start at 120 ≈ one growing season) → desaturated pin + "Unconfirmed" / "Confirmed N days ago" badge. Degrades gracefully: on day one every row is null, so everything renders "Unconfirmed" — which reads as a *call to action*, not a broken map.
- **Abuse control, pragmatic floor.** No auth ⇒ no per-user throttle. Use a `BEFORE INSERT` trigger that rejects a second pending row for the same `location_id`+`kind` within N minutes (global per-location), plus a client-side honeypot field. Leave a seam for a Cloudflare Turnstile token verified in a Supabase Edge Function **if** spam actually shows — don't ship a captcha preemptively.
- **`verify_gone` never auto-hides.** A lone anonymous "gone" tap archiving a real garden is a griefing vector. The tap only raises a flag; archiving stays an editor action on the existing `archived` soft-delete.

### File-by-file

- **`supabase/migrations/<ts>_submissions_and_last_verified.sql`** (new) — `last_verified_at` on `locations`; `submissions` table; the anon-insert-only + authenticated-full RLS policies; the rate-limit trigger; index on `submissions(status, created_at)`. *Note:* the repo has no `supabase/migrations/` dir yet (schema lives in CLAUDE.md prose + the unique-constraint comment in `import-kml.ts`). If Phase 4 hasn't scaffolded migrations, this is the first one — `supabase init` / create the dir as part of this task.
- **`src/lib/types.ts`** (edit) — add `last_verified_at: string | null` to `Location`; add `Submission` + `SubmissionKind` types.
- **`src/lib/submissions.ts`** (new) — `submitVerification(locationId, kind, note?)` and `submitSuggestion(payload)`; thin wrappers over `supabase.from('submissions').insert(...)`. Centralizes the anon-write path so RLS is exercised in one place.
- **`src/components/LocationPanel.tsx`** (edit) — freshness badge (from `last_verified_at`) + the verify control: **Still here ✓ / Gone ✗ / Suggest an edit ✎**, each inserting a `submissions` row, no account. Optimistic "Thanks — sent to the team" confirmation. Hidden honeypot input. Match the panel's existing focus-management / a11y patterns.
- **`src/components/MapView.tsx`** (edit) — desaturate stale/unconfirmed pins: extend `makePinIcon` to take a freshness state and lower opacity / apply a grey wash. Pre-build icon variants per (category × freshness) to keep the existing one-instance-per-type pattern. No red.
- **`src/pages/SuggestLocationPage.tsx`** (new) — the inbound "suggest a location / edit" form (writes `suggest_new` / `suggest_edit`), linked from a small "Know a spot we're missing?" affordance on `MapPage` — the structured replacement for the dropped Google Form. Mobile-first, matches existing inline-style conventions.
- **`src/pages/admin/ModerationQueue.tsx`** (new, Phase 4 admin area) — Realtime-subscribed pending list; approve/reject; per-`kind` effect on approve (`verify_active` → stamp `last_verified_at`; `verify_gone` → flag for editor archive; `suggest_*` → apply to `locations`). Protected route — depends on Phase 4 auth.
- **`src/hooks/useModerationQueue.ts`** (new) — initial fetch + Supabase Realtime subscription, row-filtered to `status='pending'`.
- **`CLAUDE.md`** (edit) — add `submissions` + `last_verified_at` to the schema block and RLS rules; document the anon-insert policy as the first public-write exposure.

### Gotchas / risks

- **Anon write is the whole risk.** Policy must be insert-only and forbid client-set `status`/`reviewed_*`. Add a regression test (pgTAP, or a manual REST insert with the anon key) proving an `status='approved'` insert *fails* and an anon SELECT returns nothing.
- **Realtime footprint.** Only the **admin queue** subscribes. The public map stays a plain fetch — a near-static 105-row read map does not need a live socket per visitor. Row-filter the publication to `status='pending'`.
- **Stale threshold is a guess.** One constant (`STALE_DAYS = 120`), not scattered magic numbers. Expect to tune it. Unconfirmed (null) and stale share the same treatment so day-one doesn't look broken.
- **Sequencing.** The public half (migration + `last_verified_at` + verify control + pin decay) ships and starts collecting signal **with zero editors** — rows just accumulate as `pending`. The moderation queue lands once Phase 4 admin auth exists. Don't block the public half on the admin half.

### Done when

- Anon visitor taps "Still here ✓ / Gone ✗" → a `submissions` row lands with `status='pending'`; the same visitor **cannot** insert `status='approved'` (RLS rejects).
- A `LocationPanel` shows "Confirmed N days ago" / "Unconfirmed"; stale/unconfirmed pins render desaturated (no red).
- Approving a `verify_active` stamps `locations.last_verified_at`; the badge updates on next load.
- The "suggest a location" form writes a `suggest_new` row that editors see in the queue.
- The moderation queue updates live (Realtime) on a new pending row, without refresh.
- RLS regression passes: anon SELECT on `submissions` → empty; anon INSERT with forbidden status/kind → fails.

### Kickoff

> Read `tiller/2026-06-17-community-verification-loop.md`. Implement Phase 4.5 **part 1**: the migration adding `locations.last_verified_at` + the `submissions` table with an insert-only anon RLS policy (forbid client-set `status`), plus the public `LocationPanel` verify control (Still here / Gone / Suggest an edit) writing `pending` rows, and stale/unconfirmed pin desaturation on the map. Defer the Realtime moderation queue to part 2 (needs Phase 4 admin auth). Before writing the RLS policy, read the Supabase "Postgres rules for AI agents" guidance.

---

*Process: candidates generated against the repo, crossed with the radar watchlist via the Innovator, run past a Skeptic / Visionary / Architect panel. The Skeptic killed the static data-bake (105 rows fetched once is not a perf or cost problem — the Claude Code Routine regen was tech looking for a justification), seasonality (a second fully-unpopulated field set when image data entry is already the bottleneck — and it's downstream of this loop anyway), the per-ward PDF (solving for a stakeholder who hasn't spoken), and a PGlite offline map (pure decoration for a civic web map; IndexedDB would do the same at 1% of the weight). The verification loop survived because verification is the project's founding wound, not a deflection. The Architect's call: build the single `submissions` spine once and point it at both confirmations (this) and suggestions (the dropped Google Form), rather than two queues and two anon-write policies.*

---
_Generated by [Claude Code](https://claude.ai/code/session_013mQTdQmbYNNiRHLN5PkFj3)_
