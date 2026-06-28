# Tiller — the paper is the product: print-and-post resource sheets

**Overnight idea, 2026-06-28.** One idea, argued. Draft PR; you're the gate.

---

## The idea

The map renders 105 sites on a screen and treats the screen as the product. But this app serves low-income, food-insecure Cleveland residents — the slice of the city most likely to be on prepaid/throttled data, on a library computer, or reached not through a URL at all but through a trusted physical intermediary: a church, a community fridge, a food-bank intake desk, a senior center. For that audience the highest-reach channel isn't the SPA. **It's a sheet of paper posted on a corkboard.**

So make the printed artifact a **first-class output of the project**, not an afterthought: a build-time generator (`scripts/generate-sheets.ts`, sibling to `import-kml.ts`) that reads `locations` and emits clean, print-ready, branded HTML resource sheets — citywide, per-category, and (the bold version) **per-host: "food resources within 1 mile of HERE,"** keyed to a specific fridge or church's coordinates. Each sheet carries a "good through [month]" stamp and a QR back to the live map.

The hook that makes this more than "add a print button": **the paper is strictly more complete than the screen.** Your map silently drops the 18 of 105 locations that have no coordinates (`MapView` filters null lat/lng). A printed list doesn't need a lat/lng — a name, a category, and a phone number print fine. So the flyer can list **all 105**; the website shows **87**. The artifact you'd hand a council member or staple into a grant application is *more honest about the food system* than the web app it came from. That inversion is the whole pitch.

## Why it's worth it

The nonprofit's job isn't running a website — it's getting Cleveland residents to food and winning the grants that keep the gardens funded. Both of those run through paper more than pixels:

- **Reach.** The elderly resident (you have a "Private Senior Resident Garden" in the data), the household with no smartphone, the walk-in at the food bank — none of them are served by a Supabase fetch. They're served by a flyer their pastor printed. Paper is the channel that reaches the people a web-only map structurally cannot.
- **The artifact *is* the grant.** A branded, dated, one-page "105 food resources across Cleveland" sheet is the photo in the grant application and the handout in the council briefing. That deliverable falls out of the same render for free.
- **It closes the funnel back to digital.** Each sheet's QR is host-tagged (`?from=fridge-w25`) and lands on the live map. Paper reaches the low-connectivity audience; the few who scan become your most engaged users. Print is top-of-funnel for the website, not a competitor to it.

And it's cheap *because* the data is thin — the binding constraint everywhere else on this project. A sheet needs only name/category/phone/address, which is exactly what exists. A Spanish edition is a translation of ~6 fields and static chrome, not a CMS. Thinness, which kills every "richer per-pin info" idea, is the reason this one is a weekend, not a quarter.

## Why you haven't

The project was framed, reasonably, as *replacing a Google My Map* — port the pins, match the behavior, ship the directory. That framing makes the **screen the product** and quietly defines "better" as "more digital." Paper reads as a step backward, a 1990s thing, beneath a modern Vite/Supabase build. So the physical-distribution channel was never rejected — it was never *examined*. The blindspot is assuming digital-native is strictly superior, when for a food-insecure, partly-elderly, low-connectivity audience reached through churches and food banks, the posted paper flyer is the higher-reach medium. The same instinct that made you drop the original Google Forms made you assume the output is a webpage. It isn't, entirely.

This is a different axis from the two ideas already on the table here. PR #51 (USDA gap overlay) is about *demand* — who the map ignores. PR #52 (verification loop) is about *currency* — whether the map is still true. This is about **medium** — whether the map reaches the hand that needs it. None of the three competes; the QR even hands this one's foot-traffic to #52's loop.

## How it's built — handoff

Scope the first build to the milestone that proves the inversion (105 on paper > 87 on screen), then the per-host variant is the obvious follow-on.

### Approach

A **build-time Node script**, not a client route — this is the load-bearing architectural call. Reasons:
- The sheet wants the **full 105 rows including the coordinate-less ones**, which is a *different* query than the frontend's `archived=false`-with-coords path. Don't fork the app's data layer for a page nobody navigates to in-app.
- A client route drags **Leaflet into a print context**. Printing map tiles is a known disaster, and the sheet is a *typeset list, not a map* — so the clean design never imports Leaflet at all.
- It matches the established pattern: `import-kml.ts` already reads/transforms/emits a static artifact. This is the same shape, pointed the other way (DB → file instead of file → DB).
- Reversibility is total: a script plus an output folder, referenced by nothing in the app. Delete both and the project is unchanged. No schema change, no bundle cost.

Output **static HTML + a print stylesheet**; let the browser's "Save as PDF / Print" do the rasterizing. No PDF library.

### File-by-file (milestone 1)

- **`scripts/generate-sheets.ts`** — new, sibling to `import-kml.ts`. Reuse its Supabase-client + dotenv setup. Query **all** non-archived locations (no coord filter). Group by `category` (always present; ward/neighborhood are mostly null today — see gotchas). For each group, render a section: name, category tag, address (only if present), phone as `tel:` is irrelevant on paper so print it plain, manager name. Emit one `index.html` (citywide, all 105) plus optionally one file per category into `public/sheets/`.
- **`scripts/templates/sheet.css`** — new, print-first stylesheet kept **out of the app's CSS bundle**. `@page` margins, category section headers, two-column flow at print width, the brand mark, a "Generated [date] · good through [season]" footer. Honor the design rules: white/grey/black + `#3a7d44` accent, **no red**, no decorative fonts.
- **`package.json`** — add `"generate-sheets": "tsx scripts/generate-sheets.ts"` alongside the existing `import-kml` script. Add `qrcode` (and `@types/qrcode`) as a dev dependency **only if** you do per-category deep-link QRs; for a single citywide QR to the map root, commit one pre-made PNG and skip the lib.
- **QR** — generate at build into inline `data:` URIs written straight into the HTML, so it never touches the app bundle. Host-tag the URL (`?from=...`) so #52's loop, if it lands, can attribute scans.

### Milestone 2 (the bold version — same file, more args)

Parameterize the script: `--host "lat,lng" --radius 1mi --lang es`. A per-host run emits a sheet of the resources nearest *that* posting spot, distance-ranked — the community fridge gets a flyer about its own block, not a citywide PDF. It's a distance sort over data already in the DB. The Spanish edition is a string table over ~6 fields. Neither needs new data.

### Gotchas / risks

- **Ward grouping is aspirational today.** Ward/neighborhood are null for most rows, so "grouped by geography" can't ship yet — group by `category` and show address where known. The thing that *upgrades* grouping to real geography later is a point-in-polygon derivation of ward from the 87 coordinates against a Cleveland ward GeoJSON (a clean future build step). Don't block milestone 1 on it.
- **The 18 coordinate-less rows are the point.** Include them, flag them "location unconfirmed — call ahead," and make sure a null lat/lng can't throw in the generator.
- **Thin data looks worse on paper than on a map.** A pin hides emptiness; a printed row with a labeled blank looks broken. **Suppress empty fields per row** — never print "Phone: " with nothing after it.
- **Manager phone is a personal cell.** It's already public in the source KML and shown in `LocationPanel`, so printing it isn't a new disclosure — but confirm with FARE before mass-distributing ~80 volunteers' personal numbers on paper. A "contact via the nonprofit" fallback may be the right call for some.
- **No Leaflet in the script.** If you find yourself importing `react-leaflet` you've taken the wrong branch.

### Done when

- `npm run generate-sheets` emits an `index.html` listing **all 105** locations, grouped by category, that prints cleanly to one or two pages with no map tiles, no red, no empty labeled fields, and a dated footer + QR to the live map.
- Opening it and "Print → Save as PDF" yields a sheet a community center could post or hand out as-is.
- The 18 coordinate-less locations appear on the sheet (they do not appear on the map) — the inversion is demonstrable: open the map (87) next to the sheet (105).

### Kickoff

> Read `tiller/2026-06-28-print-resource-sheets.md`. Build milestone 1: a `scripts/generate-sheets.ts` (sibling to `scripts/import-kml.ts`, reusing its Supabase + dotenv setup) that queries ALL non-archived `locations` — including the coordinate-less ones — and emits a print-ready `public/sheets/index.html` grouped by category, with a `scripts/templates/sheet.css` print stylesheet (white/grey/black + `#3a7d44`, no red), empty fields suppressed per row, the 18 coordinate-less rows flagged "call ahead," a dated/seasonal footer, and one QR to the live map. No Leaflet, no PDF lib — browser "Save as PDF" does the rasterizing. Add the `generate-sheets` npm script. Then show me the sheet (105 rows) next to the map (87 pins).

---

*Process: candidates generated against the repo's confirmed data reality (105 locations; 87 with coordinates so 18 invisible; only 18 with addresses; descriptions ≈ manager+phone+email — data poverty is the binding constraint), then run past an Innovator + a Skeptic / Visionary / Architect panel. The Innovator found nothing on the radar that crosses a data-poor, read-mostly, fixed-location city map — the watchlist's load-bearing tech (sync engines, realtime, Claude Code substrate) all points at the marine projects or at dev-workflow, not here; an honest quiet night. The Skeptic killed markets-as-recurring-events (schedule data is external, nobody retypes 105 records — dies on the same rock as seasonality), category-honesty (a 30-minute legend tweak, not an idea), and standalone ward-derivation (infrastructure with no feature — folded in instead as the future grouping upgrade). The print sheet survived because it's the only candidate that turns data poverty into an asset: the 18 coordinate-less rows are a liability on every pixel of the map and an asset on paper. The Visionary pushed it to the per-host "within 1 mile of HERE" sheet and the QR-as-funnel-into-#52. The Architect's call: build-time script, never a client route — the sheet needs all 105 rows and must never import Leaflet into a print context.*

---
_Generated by [Claude Code](https://claude.ai/code/session_01XaWKyAudBLuarPCqqwT1Co)_
