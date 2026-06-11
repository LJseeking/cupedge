# CupEdge Version Checkpoint

Date: 2026-06-05

Status: Stable local checkpoint after Polymarket Gamma data correction.

Key notes:
- Polymarket market opportunities now use exact Gamma event slug fetching.
- Default search-based Gamma fetching is no longer used for core market refresh.
- World Cup market outcome parsing uses parent event titles for market grouping.
- Mock market opportunities are not used by default for live market pages.
- `POLYMARKET_REFRESH_ENABLED` should be `true` for live refresh.

Verification:
- `npm run typecheck` passed.
- `npm run lint` passed.
- `npm run build` passed during the latest validation cycle.

Do not include `.env`, local SQLite databases, `.next`, `node_modules`, or `.git` in portable snapshots.
