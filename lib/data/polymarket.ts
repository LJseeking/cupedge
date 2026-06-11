import { fetchJsonWithFallback } from "@/lib/data/http";
import { MOCK_POLYMARKET_QUOTES, SEEDED_TEAMS } from "@/lib/data/seed";
import { findSeedTeamInText, teamSlugFromName } from "@/lib/data/teams";
import type { PolymarketTeamQuote } from "@/lib/types/valuation";
import { clampProbability } from "@/lib/utils";

const DEFAULT_GAMMA_BASE = "https://gamma-api.polymarket.com";
const DEFAULT_CLOB_BASE = "https://clob.polymarket.com";

type GammaMarket = Record<string, unknown>;
type OrderbookLevel = { price?: string | number; size?: string | number };

export async function getWorldCupWinnerMarkets(): Promise<PolymarketTeamQuote[]> {
  try {
    const quotes = await fetchPolymarketQuotes();
    return quotes.length > 0 ? quotes : getMockPolymarketQuotes();
  } catch (error) {
    console.warn("Polymarket fetch failed. Falling back to mock data.", error);
    return getMockPolymarketQuotes();
  }
}

export function getMockPolymarketQuotes() {
  return MOCK_POLYMARKET_QUOTES;
}

async function fetchPolymarketQuotes() {
  const gammaBase = (process.env.POLYMARKET_API_BASE || DEFAULT_GAMMA_BASE).replace(/\/$/, "");
  const markets = await fetchGammaMarkets(gammaBase);
  const relevantMarkets = markets.filter(isWorldCupWinnerMarket);

  const fromMultiOutcome = relevantMarkets.flatMap(parseMultiOutcomeMarket);
  const fromBinaryMarkets = await Promise.all(relevantMarkets.map(parseBinaryTeamMarket));

  const bySlug = new Map<string, PolymarketTeamQuote>();
  for (const quote of [...fromMultiOutcome, ...fromBinaryMarkets].filter(Boolean)) {
    if (!quote) continue;
    if (!bySlug.has(quote.slug)) bySlug.set(quote.slug, quote);
  }

  return [...bySlug.values()];
}

async function fetchGammaMarkets(gammaBase: string) {
  const urls = [
    `${gammaBase}/markets?active=true&closed=false&limit=100&search=World%20Cup%20Winner`,
    `${gammaBase}/markets?active=true&closed=false&limit=200`
  ];

  for (const url of urls) {
    const data = await fetchJsonWithFallback<unknown>(url);
    if (!data) continue;
    if (Array.isArray(data) && data.length > 0) return data as GammaMarket[];
    const payload = typeof data === "object" && data !== null ? data as Record<string, unknown> : {};
    if (Array.isArray(payload.data) && payload.data.length > 0) return payload.data as GammaMarket[];
  }

  return [];
}

function isWorldCupWinnerMarket(market: GammaMarket) {
  const text = [
    market.question,
    market.title,
    market.slug,
    market.eventSlug,
    market.event_title,
    market.groupItemTitle,
    market.group_item_title,
    market.description
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return (
    text.includes("world cup") &&
    (text.includes("winner") || text.includes("champion") || text.includes("win the"))
  );
}

function parseMultiOutcomeMarket(market: GammaMarket): PolymarketTeamQuote[] {
  const outcomes = parseMaybeJsonArray(market.outcomes);
  const prices = parseMaybeJsonArray(market.outcomePrices);
  if (outcomes.length < 3 || prices.length !== outcomes.length) return [];

  return outcomes
    .map((outcome, index) => {
      const name = String(outcome);
      const team = SEEDED_TEAMS.find((seed) => seed.slug === teamSlugFromName(name));
      if (!team) return null;

      const fallbackPrice = parseNumber(prices[index]);
      if (fallbackPrice === undefined) return null;

      const bestBid = parseNumber((market as Record<string, unknown>).bestBid);
      const bestAsk = parseNumber((market as Record<string, unknown>).bestAsk);
      const midPrice =
        bestBid !== undefined && bestAsk !== undefined ? (bestBid + bestAsk) / 2 : undefined;

      return {
        teamName: team.name,
        slug: team.slug,
        probability: clampProbability(midPrice ?? fallbackPrice),
        bestBid,
        bestAsk,
        midPrice,
        spread: bestBid !== undefined && bestAsk !== undefined ? bestAsk - bestBid : undefined,
        liquidity: parseNumber(market.liquidity),
        volume: parseNumber(market.volume),
        updatedAt: String(market.updatedAt ?? market.updated_at ?? new Date().toISOString()),
        rawJson: market
      } satisfies PolymarketTeamQuote;
    })
    .filter(Boolean) as PolymarketTeamQuote[];
}

async function parseBinaryTeamMarket(market: GammaMarket): Promise<PolymarketTeamQuote | null> {
  const team = inferTeamFromMarket(market);
  if (!team) return null;

  const fallbackPrice =
    parseNumber(market.lastTradePrice) ??
    parseNumber(market.last_traded_price) ??
    parseNumber(market.outcomePrice) ??
    parseNumber(market.price) ??
    parseYesOutcomePrice(market);

  const clobTokenIds = parseMaybeJsonArray(market.clobTokenIds ?? market.clob_token_ids);
  const yesTokenId = clobTokenIds[0] ? String(clobTokenIds[0]) : undefined;
  const gammaBestBid = parseNumber(market.bestBid ?? market.best_bid);
  const gammaBestAsk = parseNumber(market.bestAsk ?? market.best_ask);
  const book = gammaBestBid !== undefined && gammaBestAsk !== undefined
    ? undefined
    : await fetchOrderbookBestPrices(yesTokenId);

  const bestBid = gammaBestBid ?? book?.bestBid;
  const bestAsk = gammaBestAsk ?? book?.bestAsk;
  const midPrice =
    bestBid !== undefined && bestAsk !== undefined ? (bestBid + bestAsk) / 2 : undefined;
  const probability = clampProbability(midPrice ?? fallbackPrice ?? 0);

  if (probability <= 0) return null;

  return {
    teamName: team.name,
    slug: team.slug,
    probability,
    bestBid,
    bestAsk,
    midPrice,
    spread: bestBid !== undefined && bestAsk !== undefined ? bestAsk - bestBid : undefined,
    liquidity: parseNumber(market.liquidity),
    volume: parseNumber(market.volume),
    updatedAt: String(market.updatedAt ?? market.updated_at ?? new Date().toISOString()),
    rawJson: market
  };
}

function inferTeamFromMarket(market: GammaMarket) {
  const candidateText = [
    market.groupItemTitle,
    market.group_item_title,
    market.outcome,
    market.title,
    market.question,
    market.slug
  ]
    .filter(Boolean)
    .join(" ");

  return findSeedTeamInText(candidateText);
}

function parseYesOutcomePrice(market: GammaMarket) {
  const outcomes = parseMaybeJsonArray(market.outcomes);
  const prices = parseMaybeJsonArray(market.outcomePrices);
  const yesIndex = outcomes.findIndex((outcome) => String(outcome).toLowerCase() === "yes");
  if (yesIndex < 0) return undefined;
  return parseNumber(prices[yesIndex]);
}

async function fetchOrderbookBestPrices(tokenId?: string) {
  if (!tokenId) return undefined;

  try {
    const url = `${DEFAULT_CLOB_BASE}/book?token_id=${encodeURIComponent(tokenId)}`;
    const response = await fetch(url, {
      next: { revalidate: 0 },
      signal: AbortSignal.timeout(5000)
    });
    if (!response.ok) return undefined;
    const book = await response.json();
    const bids = Array.isArray(book.bids) ? (book.bids as OrderbookLevel[]) : [];
    const asks = Array.isArray(book.asks) ? (book.asks as OrderbookLevel[]) : [];
    const bestBid = maxPrice(bids);
    const bestAsk = minPrice(asks);
    return bestBid !== undefined || bestAsk !== undefined ? { bestBid, bestAsk } : undefined;
  } catch {
    return undefined;
  }
}

function parseMaybeJsonArray(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  if (typeof value !== "string") return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function parseNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string") return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function maxPrice(levels: OrderbookLevel[]) {
  const prices = levels.map((level) => parseNumber(level.price)).filter((value) => value !== undefined);
  return prices.length ? Math.max(...prices) : undefined;
}

function minPrice(levels: OrderbookLevel[]) {
  const prices = levels.map((level) => parseNumber(level.price)).filter((value) => value !== undefined);
  return prices.length ? Math.min(...prices) : undefined;
}
