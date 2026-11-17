# Cleveland Food System Map

Public map of Cleveland community gardens, urban farms, and farmers markets, with a small
editor area. Live at [clevelandfoodsystem.land](https://clevelandfoodsystem.land).

Next.js 16 · react-leaflet/OpenStreetMap · Postgres via Drizzle · BetterAuth. See `CLAUDE.md`
for architecture and rules, `dev-decisions.md` for the why.

## Local setup

1. `npm install`
2. `cp .env.example .env.local` and fill it in (Postgres URL, BetterAuth secret, OAuth apps,
   Resend API key, photo base URL). OAuth callback URLs are `http://localhost:3000/api/auth/callback/google`
   and `.../facebook`.
3. `npm run db:migrate`
4. `npm run add-editor -- you@example.org` to give yourself editor access
5. `npm run dev` → http://localhost:3000

## Scripts

| Command                              | What it does                                 |
| ------------------------------------ | -------------------------------------------- |
| `npm run dev` / `build` / `start`    | Next.js                                      |
| `npm run db:generate` / `db:migrate` | Drizzle migrations (`drizzle/`)              |
| `npm run import-kml -- [--dry-run]`  | Import/upsert locations from the KML export  |
| `npm run add-editor -- <email>`      | Create the user if needed and make it editor |
