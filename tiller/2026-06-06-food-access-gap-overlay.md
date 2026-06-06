# Turn the map's negative space into the argument — a USDA food-access gap overlay

*Tiller — 2026-06-06. One idea, argued. Draft PR; you're the gate.*

## The idea

Right now the map answers exactly one question: *where are Cleveland's gardens,
farms, and markets?* It renders supply — 105 dots — and says nothing about
demand. Bake the USDA **Food Access Research Atlas** low-income/low-access (LILA)
census tracts for Cuyahoga County into the build as a static, simplified GeoJSON
layer — the same "static data baked at build, no runtime fetch" pattern
`import-kml.ts` already lives by — and render it as **one toggleable overlay
beneath the pins**. Then precompute, at build time, the *negative space*: LILA
tracts with zero gardens/farms/markets within walking distance. The map stops
being only a resource finder and becomes a **siting-and-advocacy instrument** —
it shows not just what exists, but where the food system is failing and where the
next garden would do the most good. One toggle, one precomputed gap list, one
grant-ready screenshot.

## Why it's worth it

FARE/CDPH's actual job isn't maintaining a directory — it's improving Cleveland's
food system. A map of supply helps a resident find a garden; a map of supply
*against need* helps the nonprofit win a grant, brief a council office, and decide
where to put the next plot. That's a deliverable nobody can get from Google My
Maps, a city PDF, or a spreadsheet: the image of a high-need tract with no growing
space inside it. Now is the moment — the public read map just shipped (Phase 3),
the data layer is settled, and the overlay is purely **additive frontend work**
riding on infrastructure that already exists. It also sharpens the case for the
Phase 4 admin tooling you're about to build: editors maintain the dots; the gap
map is *why the dots matter*.

## Why you haven't

The project was framed, reasonably, as a faithful replacement for the existing
Google My Maps — port the pins, match the behavior, ship the directory. "Gap
analysis / negative space" lives in a different mental category (analysis, not
cartography) that a port-the-existing-map framing never surfaces. It also *felt*
like it would drag in political risk — calling a neighborhood a "food desert" is
a claim — and that instinct is correct, which is exactly the move: display the
**federal USDA LILA designation with attribution**, don't invent your own. You're
showing a published government dataset next to your pins, not editorializing. Once
the authority comes from USDA, the risk that was keeping this off the table
evaporates.

## How to start

1. **Get the data, shrink it.** Pull the USDA Food Access Research Atlas tract
   table, filter to Cuyahoga County, keep the LILA flag, and run the tract
   geometry through `mapshaper` to simplify aggressively — you need tract *shape*,
   not survey precision. Commit the result as a small GeoJSON in the repo. Watch
   the bundle.
2. **One toggle, attributed.** Add a single control to the existing filter strip —
   "Show food-access gaps" — that renders the tracts as a low-opacity choropleth
   *under* the markers, with a visible "Source: USDA Food Access Research Atlas"
   credit on the layer. (Mind the design rule: no red — use a neutral
   grey/black wash, not a heat-map red.)
3. **Precompute the gaps.** Write a build-time script (sibling to
   `import-kml.ts`) that spatial-joins the current `locations` against the tracts
   and emits `gaps.json` — LILA tracts with no garden/farm/market within ~0.5 mi —
   so "where should the next one go" is precomputed, not computed in the browser
   against thousands of polygons.

Stop there and show it to FARE before building anything heavier. If the screenshot
lands, the per-ward scorecard — using the `ward` column you import but never
surface — is the obvious next layer.

---

*Process: candidates generated against the repo, crossed with the radar watchlist,
then run past a Skeptic / Visionary / Architect panel. The Skeptic's standing
objection to this one — "no stakeholder asked; labeling tracts is a political
claim" — is answered by sourcing the federal LILA designation and shipping the
smallest version first (one overlay, one gap list) as a cheap test of whether FARE
wants the advocacy framing at all. Rejected on the same night: real-time
collaborative admin (solves a contention problem 2–5 seasonal editors don't have),
LLM-drafted manager outreach (a mail-merge does it without the PII liability), and
the ward filter as a standalone (a half-day chore on unaudited data, not an idea).*
