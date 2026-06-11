# CupEdge

CupEdge is a minimalist 2026 World Cup Edge Scanner for Polymarket. It compares:

- Polymarket probability
- Bookmaker-implied probability
- A simple, explainable fair probability estimate

The MVP answers one question: which World Cup markets and outcomes show meaningful edge, watchlist signals, or overheated pricing?

## Tech Stack

- Next.js App Router
- TypeScript
- Tailwind CSS
- Prisma
- SQLite for local development, with a simple path to PostgreSQL for deployment
- Recharts

## Local Setup

1. Install dependencies:

```bash
npm install
```

2. Create an environment file:

```bash
cp .env.example .env
```

3. Push the Prisma schema to the local SQLite database:

```bash
npm run db:push
```

4. Seed the 48-team qualified whitelist, mock valuation data, and mock market opportunities:

```bash
npm run db:seed
```

5. Start the dev server:

```bash
npm run dev
```

Open `http://localhost:3000`.

## Useful Commands

```bash
npm run db:push       # sync schema to local database
npm run db:push:prod  # sync PostgreSQL production schema
npm run db:migrate    # create a Prisma migration
npm run db:seed       # seed teams, mock valuations, and market opportunities
npm run db:seed:prod  # seed production PostgreSQL database
npm run update:data   # run the update job locally
npm run update:ratings # refresh Elo/SPI ratings only
npm run update:data -- --mock
npm run typecheck
npm run lint
npm run build
```

## Environment Variables

```bash
DATABASE_URL="file:./dev.db"
THE_ODDS_API_KEY=""
CRON_SECRET="change-me"
NEXT_PUBLIC_APP_URL="http://localhost:3000"
POLYMARKET_API_BASE="https://gamma-api.polymarket.com"
POLYMARKET_REFRESH_ENABLED="true"
POLYMARKET_WORLD_CUP_TOPIC_URLS="https://polymarket.com/zh/predictions/world-cup,https://polymarket.com/predictions/world-cup"
POLYMARKET_WORLD_CUP_EVENT_SLUGS=""
ODDS_UPDATE_MIN_INTERVAL_HOURS="12"
ODDS_REGION="uk"
ODDS_MARKET="outrights"
ELO_RATINGS_URL="https://www.international-football.net/"
SPI_RATINGS_URL="https://projects.fivethirtyeight.com/soccer-api/international/spi_global_rankings_intl.csv"
RATINGS_UPDATE_MIN_INTERVAL_HOURS="24"
TOURNAMENT_SIMULATIONS="10000"
```

`THE_ODDS_API_KEY` is optional. Without it, CupEdge uses the latest database bookmaker odds first. If none exist, it uses mock bookmaker data and does not call The Odds API.

`POLYMARKET_API_BASE` points to Polymarket Gamma API. Polymarket public market data does not require an API key for this read-only MVP.

`POLYMARKET_WORLD_CUP_TOPIC_URLS` lets CupEdge discover active World Cup event slugs from the Polymarket World Cup topic page before fetching each event through Gamma. This keeps `/markets` aligned with the topic page instead of relying only on a small hard-coded slug list.

`POLYMARKET_WORLD_CUP_EVENT_SLUGS` is an optional comma-separated override for extra World Cup event slugs if Polymarket changes the topic page markup.

If live Polymarket market opportunity data cannot be fetched, CupEdge does not pretend stale mock market opportunities are live. Mock opportunities are only used when explicitly running `npm run update:data -- --mock`.

Set `POLYMARKET_REFRESH_ENABLED="false"` to pause Polymarket refreshes in the scheduled update path. When paused, CupEdge reuses the latest stored Polymarket valuation snapshots and preserves the existing market opportunities instead of requesting Polymarket again.

`ODDS_UPDATE_MIN_INTERVAL_HOURS` protects The Odds API free quota. If the latest bookmaker odds in the database are newer than this interval, the update job reuses cached bookmaker data instead of calling The Odds API.

`ODDS_REGION` and `ODDS_MARKET` configure The Odds API request. The MVP defaults to `uk` and `outrights`.

`ELO_RATINGS_URL` and `SPI_RATINGS_URL` configure the team strength rating inputs. Elo is the primary national-team strength signal. SPI is optional and only uses the FiveThirtyEight international rankings CSV, not club SPI data. If rating fetches fail, CupEdge uses a local seed fallback, labels the fair source as `Seed Rating Fallback`, and downgrades the signal quality.

`RATINGS_UPDATE_MIN_INTERVAL_HOURS` controls how often ratings are refreshed. Pages never call Elo/SPI sources directly; ratings refresh only during `npm run update:data`, `npm run update:ratings`, or the update job route.

`TOURNAMENT_SIMULATIONS` controls the Monte Carlo tournament simulation count. CupEdge uses this quant model as the fair-probability anchor for winner, group winner, reach R16, reach QF, and reach SF markets.

The Odds API requires `THE_ODDS_API_KEY`. Polymarket market data does not require an API key.

To test The Odds API key without touching CupEdge:

```bash
curl "https://api.the-odds-api.com/v4/sports?apiKey=$THE_ODDS_API_KEY&all=true"
```

## Data Update Job

The internal job route is:

```bash
GET or POST /api/jobs/update-data
Authorization: Bearer ${CRON_SECRET}
```

Example:

```bash
curl -X POST http://localhost:3000/api/jobs/update-data \
  -H "Authorization: Bearer change-me"
```

If the header is missing or wrong, the route returns `401`.

To force a bookmaker odds refresh inside the quota window, pass `force=true` and a valid `CRON_SECRET`:

```bash
curl -X POST "http://localhost:3000/api/jobs/update-data?force=true" \
  -H "Authorization: Bearer change-me"
```

Pages never call external data providers directly. They read the latest `TeamValuation` and `BookmakerOdd` records from the database. External calls happen only in `GET/POST /api/jobs/update-data` or `npm run update:data`.

The Odds API free tier has only 500 credits/month. CupEdge MVP controls usage with scheduled updates plus database storage. It does not call external odds APIs during page visits.

## API Routes

- `GET /api/valuations`
- `GET /api/teams/spain`
- `GET /api/moves`
- `POST /api/jobs/update-data`

## Pages

- `/` shows today’s market call, top pick, watchlist, overheated favorites, and basket monitor.
- `/teams/spain` shows a team detail page.
- `/moves` shows recent snapshot changes.
- `/methodology` explains the model.

## Data Sources

Qualified teams whitelist:

- CupEdge only analyzes teams in the 2026 World Cup qualified teams whitelist.
- The whitelist lives in `lib/data/qualified-teams.ts`.
- Seed data, mock data, Polymarket outcomes, The Odds API outcomes, current valuations, and moves are all filtered by that whitelist.
- Non-qualified teams are not written into `TeamValuation` and are not returned by `GET /api/valuations`.
- A non-qualified team detail route such as `GET /api/teams/italy` returns `404`.

Polymarket:

- Gamma API is used for market discovery.
- CLOB public orderbook endpoints are used when token IDs are available.
- Public read-only Polymarket data does not require an API key.
- CupEdge prefers `mid_price = (best_bid + best_ask) / 2`.
- If bid/ask data is unavailable, it falls back to the latest available market price.
- If a live Polymarket market opportunity refresh returns no rows, CupEdge preserves the previous database market opportunities instead of replacing them with mock live rows.

Elo / SPI ratings:

- `TeamRating` stores each team's latest Elo, SPI, or local seed fallback rating.
- `TeamTournamentProjection` stores Monte Carlo probabilities for group winner, R16, QF, SF, final, and World Cup winner.
- Market opportunity fair probabilities for winner, group winner, R16, QF, and SF markets use the tournament projection when available.
- Elo is weighted more heavily than SPI in the combined model.
- If SPI is unavailable for a team, Elo is used alone.
- If both live rating sources fail, seed fallback is used, the fair source is labeled `Seed Rating Fallback`, and signals are downgraded.

The Odds API:

- Checks `/v4/sports?all=true` during the update job to find the available sport key.
- Prefers `soccer_fifa_world_cup_winner`.
- If that exact key is unavailable, searches for a sport key containing World Cup/FIFA plus winner/outright language.
- Requests one market, `markets=outrights`, one configured region such as `uk`, and `oddsFormat=decimal`.
- Converts decimal odds to `1 / decimal_odds`.
- Normalizes each bookmaker's implied probabilities to remove overround.
- If `THE_ODDS_API_KEY` is missing, CupEdge first uses the latest database bookmaker odds. If none exist, it uses mock bookmaker data.
- If The Odds API quota is exhausted or the request fails, CupEdge first uses the latest database bookmaker odds. If none exist, it uses mock bookmaker data.
- If bookmaker odds were updated within `ODDS_UPDATE_MIN_INTERVAL_HOURS`, CupEdge reuses database cache to protect free quota.
- A forced refresh requires `POST /api/jobs/update-data?force=true` with the correct `CRON_SECRET`.
- Alternative odds provider adapters are reserved in code for `odds-api.io`, `API-Football`, and `Sportmonks`, but they are not active in phase 1.

Fair probability:

```text
fair_probability = bookmaker_probability * 0.7 + simple_ai_probability * 0.3
edge_score = fair_probability - polymarket_probability
```

## Production Launch: Vercel + PostgreSQL

The local Prisma schema uses SQLite so the MVP runs without extra services. Production should use PostgreSQL because Vercel serverless deployments cannot rely on a local SQLite file.

CupEdge includes a dedicated production schema at:

```bash
prisma/schema.postgres.prisma
```

The Vercel build command is configured in `vercel.json`:

```bash
npm run vercel-build
```

### 1. Create a production database

Create a PostgreSQL database with Vercel Postgres, Neon, Supabase, or another managed PostgreSQL provider.

Copy the pooled production connection string. It should look like:

```bash
postgresql://USER:PASSWORD@HOST:PORT/DATABASE?sslmode=require
```

### 2. Configure Vercel environment variables

Set these in Vercel Project Settings:

```bash
DATABASE_URL="postgresql://..."
THE_ODDS_API_KEY=""
CRON_SECRET="use-a-long-random-secret"
NEXT_PUBLIC_APP_URL="https://your-domain.com"
POLYMARKET_API_BASE="https://gamma-api.polymarket.com"
POLYMARKET_REFRESH_ENABLED="true"
POLYMARKET_WORLD_CUP_TOPIC_URLS="https://polymarket.com/zh/predictions/world-cup,https://polymarket.com/predictions/world-cup"
POLYMARKET_WORLD_CUP_EVENT_SLUGS=""
ODDS_UPDATE_MIN_INTERVAL_HOURS="12"
ODDS_REGION="uk"
ODDS_MARKET="outrights"
ELO_RATINGS_URL="https://www.international-football.net/"
SPI_RATINGS_URL="https://projects.fivethirtyeight.com/soccer-api/international/spi_global_rankings_intl.csv"
RATINGS_UPDATE_MIN_INTERVAL_HOURS="24"
TOURNAMENT_SIMULATIONS="10000"
```

### 3. Initialize the production database

From your local machine, run these with the production PostgreSQL `DATABASE_URL`:

```bash
DATABASE_URL="postgresql://..." npm run db:push:prod
DATABASE_URL="postgresql://..." npm run db:seed:prod
```

### 4. Deploy to Vercel

Push the project to GitHub and import it into Vercel.

Vercel will use `vercel.json`, run `npm run vercel-build`, generate the Prisma Client from `schema.postgres.prisma`, and build the Next.js app.

### 5. Run the first production data update

After deployment:

```bash
curl -X POST "https://your-domain.com/api/jobs/update-data?force=true" \
  -H "Authorization: Bearer use-a-long-random-secret"
```

The route also supports `GET` so Vercel Cron can trigger it, but it still requires the same bearer secret.

### 6. Scheduled updates

`vercel.json` configures one daily update:

```json
{
  "path": "/api/jobs/update-data",
  "schedule": "0 2 * * *"
}
```

This is conservative for launch and protects The Odds API free quota. If you are on a Vercel plan that supports more frequent cron runs and you want Polymarket updates more often, change the schedule to hourly:

```json
"schedule": "0 * * * *"
```

The Odds API still has a 12-hour cache guard through `ODDS_UPDATE_MIN_INTERVAL_HOURS`.

### 7. Custom domain

After the Vercel deployment is healthy, add your production domain in Vercel Project Settings and update:

```bash
NEXT_PUBLIC_APP_URL="https://your-domain.com"
```
6. Deploy with the standard Next.js build command.

## Disclaimer

CupEdge is for informational purposes only. It does not provide financial, betting, or investment advice. Prediction markets are risky, and prices can change rapidly.

本站仅用于信息展示，不构成投资、博彩或交易建议。预测市场存在风险，价格可能快速波动。
