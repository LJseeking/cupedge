# CupEdge Project Status

## Current Status

CupEdge MVP phase 1 is implemented and ready for local handoff.

The product scope remains narrow: a 2026 World Cup Edge Scanner that compares Polymarket probability, fair probability estimates, liquidity, volume, and data quality across selected World Cup market types.

No trading, wallet connection, automated execution, news feed, score prediction, team encyclopedia, login, or payment features have been added.

## Local Startup

```bash
npm install
npm run db:push
npm run db:seed
npm run dev
```

Open `http://localhost:3000`.

## Passed Validation

- `npx prisma generate` passes with the local Prisma engine available.
- `npx prisma db push` passes and syncs SQLite schema.
- `npm run db:seed` passes and creates the 48-team qualified whitelist, mock valuation snapshots, and mock market opportunities.
- `npm run typecheck` passes.
- `npm run lint` passes.
- `npm run build` passes.
- API route logic was validated directly:
  - `GET /api/valuations` returns the 48 qualified teams only.
  - `GET /api/teams/spain` returns Spain.
  - `GET /api/teams/italy` returns 404 because Italy is not in the qualified whitelist.
  - `GET /api/moves` returns move rows.
  - `POST /api/jobs/update-data` without authorization returns 401.
  - `POST /api/jobs/update-data` with `Authorization: Bearer change-me` updates qualified teams and market opportunities.
- Mock fallback was validated when Polymarket DNS was unavailable.

## Current Issues

- In the Codex sandbox, local port binding was blocked with `listen EPERM`, so browser-based localhost validation could not be completed inside the sandbox. The app builds successfully and should run normally from a local terminal with `npm run dev`.
- The Prisma schema currently defaults to SQLite for local MVP use. For Vercel/PostgreSQL, change the datasource provider to `postgresql` and use a PostgreSQL `DATABASE_URL`.

## Mock Fallback Logic

- CupEdge only analyzes teams in `lib/data/qualified-teams.ts`.
- Team seed data, mock Polymarket quotes, mock bookmaker odds, Polymarket outcomes, and The Odds API outcomes are filtered through the qualified teams whitelist.
- Historical non-qualified rows, such as Italy, are deleted during seed/update and are also blocked at API read time.
- Pages and read APIs do not call external providers directly. They read current rows from `TeamValuation`, `BookmakerOdd`, and snapshots.
- The homepage reads `MarketOpportunity` rows and shows scanner-level signals rather than a default 48-team table.
- `POST /api/jobs/update-data` and `npm run update:data` are the only update paths that may request external data.
- If `THE_ODDS_API_KEY` is missing, CupEdge uses the latest database bookmaker odds first. If none exist, it falls back to mock data.
- If The Odds API request fails or quota is exhausted, CupEdge uses the latest database bookmaker odds first. If none exist, it falls back to mock data.
- If Polymarket request fails, Polymarket probabilities fall back to mock data.
- If database reads fail during page/API rendering, read services fall back to mock valuation rows instead of crashing the page.

## Free Quota Protection

- `ODDS_UPDATE_MIN_INTERVAL_HOURS` defaults to 12.
- If the latest `BookmakerOdd` records are newer than that interval, the update job reuses cached bookmaker probabilities and does not call The Odds API.
- A forced bookmaker odds refresh requires `POST /api/jobs/update-data?force=true` with a valid `CRON_SECRET`.
- The local script supports `npm run update:data -- --force` for manual operator use.
- The Odds API free tier is treated as scarce capacity. The MVP should be scheduled no more than 1-2 times per day unless manually forced.

## Real API Integration Plan

1. Configure environment variables:
   - `THE_ODDS_API_KEY`
   - `CRON_SECRET`
   - `POLYMARKET_API_BASE`
   - `ODDS_UPDATE_MIN_INTERVAL_HOURS`
   - `ODDS_REGION`
   - `ODDS_MARKET`
2. Run one authorized update:
   - `POST /api/jobs/update-data`
3. The update job checks `/v4/sports?all=true` and prefers `soccer_fifa_world_cup_winner`.
4. If that sport key is unavailable, it searches for a World Cup/FIFA winner/outright sport key.
5. Inspect `TeamValuation`, `BookmakerOdd`, and `MarketSnapshot` rows.
6. Verify Polymarket team outcome matching against the active World Cup winner market.
7. Verify The Odds API sport key availability and returned outright market shape.
8. Deploy to Vercel with a scheduled cron calling `/api/jobs/update-data`.

## Alternative Odds Providers

The code reserves a light adapter shape for future providers, but phase 1 does not activate them:

- `odds-api.io`
- `API-Football`
- `Sportmonks`

## Important Paths

- App pages: `app/page.tsx`, `app/teams/[slug]/page.tsx`, `app/moves/page.tsx`, `app/methodology/page.tsx`
- API routes: `app/api/valuations/route.ts`, `app/api/teams/[slug]/route.ts`, `app/api/moves/route.ts`, `app/api/jobs/update-data/route.ts`
- Prisma schema: `prisma/schema.prisma`
- Seed script: `prisma/seed.ts`
- Polymarket data service: `lib/data/polymarket.ts`
- Odds data service: `lib/data/odds.ts`
- Qualified teams whitelist: `lib/data/qualified-teams.ts`
- Odds provider adapter reservation: `lib/data/odds-providers.ts`
- Valuation service: `lib/services/valuation.ts`
- Snapshot/moves service: `lib/services/snapshot.ts`
- Shared types: `lib/types/valuation.ts`
- Environment template: `.env.example`
