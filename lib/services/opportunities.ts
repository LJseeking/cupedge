import { prisma } from "@/lib/db/prisma";
import { fetchJsonWithFallback, fetchTextWithFallback } from "@/lib/data/http";
import { QUALIFIED_TEAMS } from "@/lib/data/qualified-teams";
import { findSeedTeamByName, findSeedTeamInText } from "@/lib/data/teams";
import { getTeamStrengthMap } from "@/lib/services/ratings";
import { getTournamentProjectionMap } from "@/lib/services/tournament-simulation";
import type {
  ExecutionStatus,
  MarketOpportunity,
  MarketSide,
  MarketSummary,
  MarketType,
  OpportunityGrade,
  OpportunitySignalStrength,
  PriceSource,
  SignalTrend,
  VolumeSource,
  FairValueSource
} from "@/lib/types/opportunity";
import type { TeamTournamentProjection } from "@/lib/types/projection";
import type { Confidence, TeamSeed } from "@/lib/types/valuation";
import type { TeamStrength } from "@/lib/types/ratings";
import { clampProbability, slugify } from "@/lib/utils";

type RawOpportunity = {
  marketType: MarketType;
  marketTitle: string;
  outcomeName: string;
  side: MarketSide;
  polymarketProbability: number;
  fairProbability: number;
  liquidity: number;
  volume24h: number;
  dataQuality: Confidence;
  priceSource?: PriceSource;
  volumeSource?: VolumeSource;
  fairValueSource?: FairValueSource;
  sourceUrl?: string;
  marketSourceUrl?: string;
  sumYesBuyPrices?: number;
  basketEdge?: number;
};

type GammaMarket = Record<string, unknown>;
type RefreshMarketOpportunityOptions = {
  forceMock?: boolean;
};
type SeedTeam = TeamSeed;

const POLYMARKET_REFRESH_ENABLED =
  (process.env.POLYMARKET_REFRESH_ENABLED ?? "true").toLowerCase() !== "false";

const POLYMARKET_BASE = "https://gamma-api.polymarket.com";
const POLYMARKET_WORLD_CUP_TOPIC_URLS = [
  "https://polymarket.com/zh/predictions/world-cup",
  "https://polymarket.com/predictions/world-cup"
];
const POLYMARKET_SEARCH_TERMS = [
  "World Cup",
  "2026 FIFA World Cup",
  "FIFA World Cup 2026",
  "World Cup make Round of 16",
  "World Cup Round of 16",
  "World Cup reach Round of 16",
  "World Cup Group K Winner",
  "Winning Continent",
  "World Cup Winning Continent",
  "World Cup Group A Winner",
  "World Cup Quarter-final",
  "World Cup Quarterfinal",
  "World Cup reach Quarter-final",
  "World Cup Group D Winner",
  "World Cup Group B Winner",
  "World Cup Group F Winner",
  "World Cup Group E Winner",
  "World Cup Group J Winner",
  "World Cup Group L Winner",
  "World Cup Group C Winner",
  "World Cup Group G Winner",
  "World Cup Group H Winner",
  "World Cup Semi-final",
  "World Cup Semifinal",
  "World Cup reach Semi-final",
  "World Cup Winner"
];
const POLYMARKET_CORE_EVENT_SLUGS = [
  "world-cup-winner",
  "world-cup-group-a-winner",
  "world-cup-group-b-winner",
  "world-cup-group-c-winner",
  "world-cup-group-d-winner",
  "world-cup-group-e-winner",
  "world-cup-group-f-winner",
  "world-cup-group-g-winner",
  "world-cup-group-h-winner",
  "world-cup-group-i-winner",
  "world-cup-group-j-winner",
  "world-cup-group-k-winner",
  "world-cup-group-l-winner"
];

export async function getMarketOpportunities(): Promise<MarketOpportunity[]> {
  try {
    const rows = await prisma.marketOpportunity.findMany({
      orderBy: [{ actionableScore: "desc" }, { edgeScore: "desc" }]
    });

    if (rows.length > 0) {
      return rows.map((row) => {
        const opportunity = normalizeStoredOpportunity({
          id: row.id,
          marketSlug: row.marketSlug,
          marketType: row.marketType as MarketType,
          marketTitle: row.marketTitle,
          outcomeName: row.outcomeName,
          side: row.side as MarketSide,
          polymarketProbability: row.polymarketProbability,
          fairProbability: row.fairProbability,
          edgeScore: row.edgeScore,
          actionableScore: row.actionableScore,
          liquidity: row.liquidity,
          volume24h: row.volume24h,
          priceSource: row.priceSource as PriceSource,
          volumeSource: row.volumeSource as VolumeSource,
          fairValueSource: row.fairValueSource as FairValueSource,
          dataQuality: row.dataQuality as Confidence,
          signalStrength: row.signalStrength as OpportunitySignalStrength,
          signalLabel: row.signalLabel,
          explanation: row.explanation,
          riskNote: row.riskNote,
          sourceUrl: row.sourceUrl,
          marketSourceUrl: row.marketSourceUrl,
          sumYesBuyPrices: row.sumYesBuyPrices,
          basketEdge: row.basketEdge,
          updatedAt: row.updatedAt
        });
        return enrichOpportunity(opportunity);
      });
    }
  } catch (error) {
    console.warn("Market opportunity read failed.", error);
  }

  return [];
}

export async function refreshMarketOpportunities(options: RefreshMarketOpportunityOptions = {}) {
  if (!options.forceMock && !POLYMARKET_REFRESH_ENABLED) {
    return getMarketOpportunities();
  }

  const opportunities = options.forceMock
    ? getMockMarketOpportunities()
    : await getPolymarketMarketOpportunities();
  if (!options.forceMock && opportunities.length === 0) {
    console.warn("Polymarket opportunity refresh returned no live rows. Preserving existing market opportunities.");
    return getMarketOpportunities();
  }
  await prisma.$transaction(async (tx) => {
    await tx.marketOpportunity.deleteMany();
    for (const opportunity of opportunities) {
      await tx.marketOpportunity.create({
        data: {
          marketSlug: opportunity.marketSlug,
          marketType: opportunity.marketType,
          marketTitle: opportunity.marketTitle,
          outcomeName: opportunity.outcomeName,
          side: opportunity.side,
          polymarketProbability: opportunity.polymarketProbability,
          fairProbability: opportunity.fairProbability,
          edgeScore: opportunity.edgeScore,
          actionableScore: opportunity.actionableScore,
          liquidity: opportunity.liquidity,
          volume24h: opportunity.volume24h,
          priceSource: opportunity.priceSource,
          volumeSource: opportunity.volumeSource,
          fairValueSource: opportunity.fairValueSource,
          dataQuality: opportunity.dataQuality,
          signalStrength: opportunity.signalStrength,
          signalLabel: opportunity.signalLabel,
          explanation: opportunity.explanation,
          riskNote: opportunity.riskNote,
          sourceUrl: opportunity.sourceUrl,
          marketSourceUrl: opportunity.marketSourceUrl,
          sumYesBuyPrices: opportunity.sumYesBuyPrices,
          basketEdge: opportunity.basketEdge
        }
      });
    }
  });
  return opportunities;
}

export async function getPolymarketMarketOpportunities(): Promise<MarketOpportunity[]> {
  try {
    const markets = await fetchWorldCupMarketsFromGamma();
    const [strengths, projections] = await Promise.all([
      getTeamStrengthMap(),
      getTournamentProjectionMap()
    ]);
    const live = buildLiveOpportunities(markets, strengths, projections);
    if (process.env.CUPEDGE_POLYMARKET_DEBUG === "1") {
      console.log(`[CupEdge] Polymarket raw markets: ${markets.length}, parsed opportunities: ${live.length}`);
      const byTitle = new Map<string, number>();
      for (const market of markets) {
        const title = normalizeMarketTitle(market);
        byTitle.set(title, (byTitle.get(title) ?? 0) + 1);
      }
      console.log(
        `[CupEdge] Parsed market titles: ${[...byTitle.entries()]
          .slice(0, 20)
          .map(([title, count]) => `${title} (${count})`)
          .join("; ")}`
      );
    }
    if (live.length) return live;
  } catch (error) {
    console.warn("Polymarket market opportunity fetch failed.", error);
  }
  return [];
}

export async function getMarketSummaries(): Promise<MarketSummary[]> {
  const opportunities = await getMarketOpportunities();
  const byMarket = new Map<string, MarketOpportunity[]>();
  for (const opportunity of opportunities) {
    byMarket.set(opportunity.marketSlug, [
      ...(byMarket.get(opportunity.marketSlug) ?? []),
      opportunity
    ]);
  }

  const summaries = [...byMarket.entries()]
    .map(([marketSlug, rows]) => ({
      marketSlug,
      marketType: rows[0].marketType,
      marketTitle: rows[0].marketTitle,
      opportunityCount: rows.length,
      bestEdge: Math.max(...rows.map((row) => row.edgeScore)),
      worstEdge: Math.min(...rows.map((row) => row.edgeScore)),
      volume24h: Math.max(...rows.map((row) => row.volume24h ?? 0)),
      liquidity: Math.max(...rows.map((row) => row.liquidity ?? 0)),
      priceSource: combinedSource(rows.map((row) => row.priceSource)) as PriceSource,
      volumeSource: combinedSource(rows.map((row) => row.volumeSource)) as VolumeSource,
      fairValueSource: combinedSource(rows.map((row) => row.fairValueSource)) as FairValueSource,
      marketSourceUrl: rows.find((row) => row.marketSourceUrl)?.marketSourceUrl,
      updatedAt: rows[0].updatedAt
    }));

  const canSortByLiveVolume = summaries.every(
    (summary) => summary.volumeSource === "LIVE_POLYMARKET"
  );
  return summaries.sort((a, b) =>
    canSortByLiveVolume ? b.volume24h - a.volume24h : a.marketTitle.localeCompare(b.marketTitle)
  );
}

export async function getMarketDetail(marketSlug: string) {
  const opportunities = await getMarketOpportunities();
  const rows = opportunities
    .filter((opportunity) => opportunity.marketSlug === marketSlug)
    .sort((a, b) => b.actionableScore - a.actionableScore);
  if (!rows.length) return null;
  return {
    summary: {
      marketSlug,
      marketType: rows[0].marketType,
      marketTitle: rows[0].marketTitle,
      opportunityCount: rows.length,
      bestEdge: Math.max(...rows.map((row) => row.edgeScore)),
      worstEdge: Math.min(...rows.map((row) => row.edgeScore)),
      volume24h: Math.max(...rows.map((row) => row.volume24h ?? 0)),
      liquidity: Math.max(...rows.map((row) => row.liquidity ?? 0)),
      priceSource: combinedSource(rows.map((row) => row.priceSource)) as PriceSource,
      volumeSource: combinedSource(rows.map((row) => row.volumeSource)) as VolumeSource,
      fairValueSource: combinedSource(rows.map((row) => row.fairValueSource)) as FairValueSource,
      marketSourceUrl: rows.find((row) => row.marketSourceUrl)?.marketSourceUrl,
      updatedAt: rows[0].updatedAt
    } satisfies MarketSummary,
    opportunities: rows
  };
}

export async function getOpportunityDetail(id: string) {
  const opportunities = await getMarketOpportunities();
  return (
    opportunities.find((opportunity) => opportunity.id === id) ??
    opportunities.find((opportunity) => opportunity.marketSlug === id) ??
    null
  );
}

export function getMockMarketOpportunities(): MarketOpportunity[] {
  const now = new Date();
  return rawOpportunities.map((raw) => buildOpportunity(raw, now));
}

export function marketTypeLabel(type: MarketType) {
  const labels: Record<MarketType, string> = {
    WINNER: "World Cup Winner",
    GROUP_WINNER: "Group Winner",
    REACH_R16: "Reach Round of 16",
    REACH_QF: "Reach Quarter-final",
    REACH_SF: "Reach Semi-final",
    CONTINENT_WINNER: "Continent Winner",
    OTHER: "Other"
  };
  return labels[type];
}

function buildOpportunity(raw: RawOpportunity, updatedAt: Date): MarketOpportunity {
  const probabilityEdge =
    raw.side === "BASKET"
      ? raw.basketEdge ?? 1 - (raw.sumYesBuyPrices ?? 1)
      : raw.fairProbability - raw.polymarketProbability;
  const edgeScore =
    raw.side === "BASKET"
      ? raw.basketEdge ?? 1 - (raw.sumYesBuyPrices ?? 1)
      : calculateValueEdge(raw.polymarketProbability, raw.fairProbability);
  const actionableScore = calculateActionableScore(
    edgeScore,
    probabilityEdge,
    raw.liquidity,
    raw.volume24h,
    raw.dataQuality
  );
  const priceSource = raw.priceSource ?? "MOCK";
  const volumeSource = raw.volumeSource ?? "MOCK";
  const fairValueSource = raw.fairValueSource ?? "MOCK";
  const signalStrength = classifySignal(edgeScore, probabilityEdge, actionableScore, raw.side, {
    volumeSource,
    fairValueSource
  });

  return enrichOpportunity({
    marketSlug: slugify(raw.marketTitle),
    marketType: raw.marketType,
    marketTitle: raw.marketTitle,
    outcomeName: raw.outcomeName,
    side: raw.side,
    polymarketProbability: clampProbability(raw.polymarketProbability),
    fairProbability: clampProbability(raw.fairProbability),
    edgeScore,
    actionableScore,
    liquidity: raw.liquidity,
    volume24h: raw.volume24h,
    priceSource,
    volumeSource,
    fairValueSource,
    dataQuality: raw.dataQuality,
    signalStrength,
    signalLabel: signalLabel(signalStrength),
    explanation: buildExplanation(raw, edgeScore, probabilityEdge, signalStrength),
    riskNote: buildRiskNote(raw.side, signalStrength),
    sourceUrl: raw.sourceUrl,
    marketSourceUrl: raw.marketSourceUrl,
    sumYesBuyPrices: raw.sumYesBuyPrices,
    basketEdge: raw.basketEdge,
    updatedAt
  });
}

async function fetchWorldCupMarketsFromGamma() {
  const base = (process.env.POLYMARKET_API_BASE || POLYMARKET_BASE).replace(/\/$/, "");
  const topicSlugs = await fetchWorldCupTopicEventSlugs();
  const slugs = [...new Set([...topicSlugs, ...POLYMARKET_CORE_EVENT_SLUGS])];
  if (process.env.CUPEDGE_POLYMARKET_DEBUG === "1") {
    console.log(
      `[CupEdge] World Cup topic event slugs: ${topicSlugs.length}; total slugs to fetch: ${slugs.length}`
    );
  }
  const batches: GammaMarket[][] = [];
  for (const slug of slugs) {
    batches.push(await fetchGammaEventBySlug(base, slug));
  }
  if (process.env.CUPEDGE_POLYMARKET_DEEP_SCAN !== "1") {
    return dedupeTargetWorldCupMarkets(batches.flat());
  }
  for (const term of POLYMARKET_SEARCH_TERMS) {
    const [events, markets] = await Promise.all([
      fetchGammaCollection(base, "events", term),
      fetchGammaCollection(base, "markets", term)
    ]);
    batches.push(events, markets);
  }

  return dedupeTargetWorldCupMarkets(batches.flat());
}

async function fetchWorldCupTopicEventSlugs() {
  const explicitSlugs = parseExplicitWorldCupEventSlugs(process.env.POLYMARKET_WORLD_CUP_EVENT_SLUGS);
  const topicUrls = parseExplicitTopicUrls(process.env.POLYMARKET_WORLD_CUP_TOPIC_URLS);
  const slugs = new Set<string>(explicitSlugs);

  for (const url of topicUrls) {
    let html: string | null = null;
    try {
      html = await fetchTextWithFallback(url, 12_000);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (process.env.CUPEDGE_POLYMARKET_DEBUG === "1") {
        console.warn(`[CupEdge] Polymarket topic fetch failed for ${url}: ${message}`);
      }
    }
    if (!html) continue;
    for (const slug of extractEventSlugsFromTopicHtml(html)) {
      slugs.add(slug);
    }
  }

  return [...slugs];
}

function parseExplicitWorldCupEventSlugs(value: string | undefined) {
  if (!value) return [];
  return value
    .split(",")
    .map((slug) => slug.trim())
    .filter(Boolean)
    .filter(isWorldCupEventSlug);
}

function parseExplicitTopicUrls(value: string | undefined) {
  if (!value) return POLYMARKET_WORLD_CUP_TOPIC_URLS;
  const urls = value
    .split(",")
    .map((url) => url.trim())
    .filter(Boolean);
  return urls.length ? urls : POLYMARKET_WORLD_CUP_TOPIC_URLS;
}

function extractEventSlugsFromTopicHtml(html: string) {
  const normalizedHtml = html.replace(/\\\//g, "/");
  const slugs = new Set<string>();
  const patterns = [
    /href=["'](?:https:\/\/polymarket\.com)?\/(?:[a-z]{2}\/)?event\/([^"'?#/]+)/g,
    /(?:https:\/\/polymarket\.com)?\/(?:[a-z]{2}\/)?event\/([a-z0-9-]+)/g
  ];

  for (const pattern of patterns) {
    for (const match of normalizedHtml.matchAll(pattern)) {
      const slug = decodeURIComponent(match[1] ?? "").trim();
      if (isWorldCupEventSlug(slug)) slugs.add(slug);
    }
  }

  return [...slugs];
}

function isWorldCupEventSlug(slug: string) {
  const normalized = slug.toLowerCase();
  return (
    normalized.includes("world-cup") ||
    normalized.includes("fifa-world-cup") ||
    normalized.includes("2026-fifa")
  );
}

function dedupeTargetWorldCupMarkets(markets: GammaMarket[]) {
  const bySlug = new Map<string, GammaMarket>();
  for (const market of markets) {
    if (!isTargetWorldCupMarket(market)) continue;
    const key = String(market.slug ?? market.id ?? market.conditionId ?? "");
    if (!key) continue;
    bySlug.set(key, market);
  }
  return [...bySlug.values()];
}

async function fetchGammaEventBySlug(base: string, slug: string) {
  const rows = await fetchGammaUrl(`${base}/events?slug=${encodeURIComponent(slug)}`, slug);
  if (!rows.length && process.env.CUPEDGE_POLYMARKET_DEBUG === "1") {
    console.warn(`[CupEdge] No Polymarket event rows for slug: ${slug}`);
  }
  return rows;
}

async function fetchGammaCollection(base: string, resource: "events" | "markets", search: string) {
  const rows = await fetchGammaCollectionUrl(`${base}/${resource}`, search);
  if (rows.length) return rows;

  return fetchGammaCollectionUrl(`${base}/${resource}/keyset`, search);
}

async function fetchGammaCollectionUrl(endpoint: string, search: string) {
  const params = new URLSearchParams({
    active: "true",
    closed: "false",
    limit: "200",
    ascending: "false",
    search
  });
  return fetchGammaUrl(`${endpoint}?${params.toString()}`, search);
}

async function fetchGammaUrl(url: string, context: string) {
  let data: unknown;
  try {
    data = await fetchJsonWithFallback<unknown>(url);
    if (!data) return [];
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`Polymarket Gamma request failed for ${url} (${context}): ${message}`);
    return [];
  }
  const payload = typeof data === "object" && data !== null ? data as Record<string, unknown> : {};
  const rows = Array.isArray(data)
    ? data
    : Array.isArray(payload.data)
      ? payload.data
      : Array.isArray(payload.markets)
        ? payload.markets
        : Array.isArray(payload.events)
          ? payload.events
          : Object.keys(payload).length
            ? [payload]
            : [];
  const flattened: GammaMarket[] = [];
  for (const row of rows as GammaMarket[]) {
    const nestedMarkets = parseMaybeJsonArray(row.markets);
    if (nestedMarkets.length) {
      for (const market of nestedMarkets) {
        if (typeof market === "object" && market !== null) {
          flattened.push({
            ...(market as GammaMarket),
            eventSlug: row.slug,
            eventTitle: row.title ?? row.question,
            eventVolume: row.volume,
            eventVolume24hr: row.volume24hr,
            eventLiquidity: row.liquidity,
            eventLiquidityClob: row.liquidityClob
          });
        }
      }
    } else {
      flattened.push(row);
    }
  }
  return flattened;
}

function buildLiveOpportunities(
  markets: GammaMarket[],
  strengths: Map<string, TeamStrength>,
  projections: Map<string, TeamTournamentProjection>
) {
  const updatedAt = new Date();
  const opportunities: MarketOpportunity[] = [];
  for (const market of markets) {
    const marketTitle = normalizeMarketTitle(market);
    const marketType = inferMarketType(marketTitle);
    const volume = parseMarketVolume(market);
    const liquidity =
      parseNumber(market.eventLiquidity) ??
      parseNumber(market.eventLiquidityClob) ??
      parseNumber(market.liquidityNum) ??
      parseNumber(market.liquidity) ??
      0;
    const marketSourceUrl = buildPolymarketUrl(market);
    const outcomes = parseMaybeJsonArray(market.outcomes);
    const prices = parseMaybeJsonArray(market.outcomePrices);

    if (outcomes.length > 2 && prices.length === outcomes.length) {
      outcomes.forEach((outcome, index) => {
        const outcomeName = canonicalOutcomeName(String(outcome), marketTitle);
        const price = parseNumber(prices[index]);
        if (price === undefined || price <= 0 || price >= 1) return;
        const raw = buildLiveRawOpportunity({
          marketType,
          marketTitle,
          outcomeName,
          yesPrice: price,
          volume,
          liquidity,
          marketSourceUrl,
          strengths,
          projections
        });
        if (raw) opportunities.push(buildOpportunity(raw, updatedAt));
      });
      continue;
    }

    const yesPrice = parseYesPrice(market);
    const outcomeName = canonicalOutcomeName(inferOutcomeName(market, marketTitle), marketTitle);
    if (yesPrice !== undefined && yesPrice > 0 && yesPrice < 1 && outcomeName) {
      const raw = buildLiveRawOpportunity({
        marketType,
        marketTitle,
        outcomeName,
        yesPrice,
        volume,
        liquidity,
        marketSourceUrl,
        strengths,
        projections
      });
      if (raw) opportunities.push(buildOpportunity(raw, updatedAt));
    }
  }
  return opportunities;
}

function buildLiveRawOpportunity({
  marketType,
  marketTitle,
  outcomeName,
  yesPrice,
  volume,
  liquidity,
  marketSourceUrl,
  strengths,
  projections
}: {
  marketType: MarketType;
  marketTitle: string;
  outcomeName: string;
  yesPrice: number;
  volume: number;
  liquidity: number;
  marketSourceUrl?: string;
  strengths: Map<string, TeamStrength>;
  projections: Map<string, TeamTournamentProjection>;
}): RawOpportunity | null {
  const mockMatch = rawOpportunities.find(
    (item) =>
      slugify(item.marketTitle) === slugify(marketTitle) &&
      slugify(item.outcomeName) === slugify(outcomeName) &&
      item.side === "YES"
  );
  const seedTeam = findSeedTeamByName(outcomeName) ?? findSeedTeamInText(`${marketTitle} ${outcomeName}`);
  const fair = deriveLiveFairProbability({
    marketType,
    marketTitle,
    outcomeName,
    polymarketProbability: yesPrice,
    seedTeam,
    mockMatch,
    strengths,
    projections
  });
  if (!fair) return null;
  const dataQuality: Confidence =
    fair.source === "MOCK" || fair.source === "UNMODELED"
      ? "low"
      : fair.ratingSource === "SEED_FALLBACK"
        ? "low"
      : "medium";
  const yesFair = clampProbability(fair.probability);
  const yesProbabilityEdge = yesFair - yesPrice;
  const side: MarketSide =
    fair.source === "UNMODELED" || fair.source === "MOCK" || yesProbabilityEdge >= 0
      ? "YES"
      : "NO";
  const polymarketProbability = side === "YES" ? yesPrice : clampProbability(1 - yesPrice);
  const fairProbability = side === "YES" ? yesFair : clampProbability(1 - yesFair);

  return {
    marketType,
    marketTitle,
    outcomeName,
    side,
    polymarketProbability,
    fairProbability,
    liquidity,
    volume24h: volume,
    dataQuality,
    priceSource: "LIVE_POLYMARKET",
    volumeSource: "LIVE_POLYMARKET",
    fairValueSource: fair.ratingSource === "SEED_FALLBACK" && (fair.source === "RATING_MODEL" || fair.source === "QUANT_MODEL")
      ? "RATING_FALLBACK"
      : fair.source,
    marketSourceUrl
  };
}

function canonicalOutcomeName(outcomeName: string | undefined, marketTitle: string) {
  if (!outcomeName) return "";
  const seedTeam = findSeedTeamByName(outcomeName) ?? findSeedTeamInText(`${marketTitle} ${outcomeName}`);
  return seedTeam?.name ?? outcomeName;
}

function deriveLiveFairProbability({
  marketType,
  marketTitle,
  polymarketProbability,
  seedTeam,
  mockMatch,
  strengths,
  projections
}: {
  marketType: MarketType;
  marketTitle: string;
  outcomeName: string;
  polymarketProbability: number;
  seedTeam?: SeedTeam;
  mockMatch?: RawOpportunity;
  strengths: Map<string, TeamStrength>;
  projections: Map<string, TeamTournamentProjection>;
}): { probability: number; source: FairValueSource; ratingSource?: TeamStrength["source"] } | null {
  if (!seedTeam && isTeamMarketType(marketType)) return null;

  const teamStrength = seedTeam ? strengths.get(seedTeam.slug) : undefined;
  const projection = seedTeam ? projections.get(seedTeam.slug) : undefined;
  if (seedTeam && marketType === "WINNER") {
    if (projection) {
      return {
        probability: projection.winTournamentProbability,
        source: "QUANT_MODEL",
        ratingSource: projection.strengthSource === "MIXED" ? teamStrength?.source : projection.strengthSource
      };
    }
    return { probability: seedTeam.seedAiProbability, source: "MODEL", ratingSource: "SEED_FALLBACK" };
  }
  if (seedTeam && marketType === "GROUP_WINNER") {
    const groupLetter = marketTitle.match(/group\s+([a-l])/i)?.[1]?.toUpperCase();
    if (!seedTeam.group) return null;
    if (groupLetter && !seedTeam.group.endsWith(groupLetter)) return null;
    if (projection) {
      return {
        probability: projection.groupWinProbability,
        source: "QUANT_MODEL",
        ratingSource: projection.strengthSource === "MIXED" ? teamStrength?.source : projection.strengthSource
      };
    }
    const groupTeams = QUALIFIED_TEAMS.filter((team) => team.group === seedTeam.group);
    const totalSeed = groupTeams.reduce((sum, team) => sum + team.seedAiProbability, 0);
    if (totalSeed <= 0) return null;
    return {
      probability: clampProbability(seedTeam.seedAiProbability / totalSeed),
      source: "MODEL",
      ratingSource: "SEED_FALLBACK"
    };
  }
  if (seedTeam && marketType === "REACH_R16") {
    if (projection) {
      return {
        probability: projection.reachR16Probability,
        source: "QUANT_MODEL",
        ratingSource: projection.strengthSource === "MIXED" ? teamStrength?.source : projection.strengthSource
      };
    }
    return {
      probability: clampProbability(polymarketProbability),
      source: "UNMODELED"
    };
  }
  if (seedTeam && marketType === "REACH_QF") {
    if (projection) {
      return {
        probability: projection.reachQfProbability,
        source: "QUANT_MODEL",
        ratingSource: projection.strengthSource === "MIXED" ? teamStrength?.source : projection.strengthSource
      };
    }
    return {
      probability: clampProbability(polymarketProbability),
      source: "UNMODELED"
    };
  }
  if (seedTeam && marketType === "REACH_SF") {
    if (projection) {
      return {
        probability: projection.reachSfProbability,
        source: "QUANT_MODEL",
        ratingSource: projection.strengthSource === "MIXED" ? teamStrength?.source : projection.strengthSource
      };
    }
    return {
      probability: clampProbability(polymarketProbability),
      source: "UNMODELED"
    };
  }
  if (mockMatch) {
    return { probability: mockMatch.fairProbability, source: "MOCK" };
  }
  if (!isTeamMarketType(marketType)) {
    return { probability: clampProbability(polymarketProbability), source: "UNMODELED" };
  }
  return null;
}

function isTeamMarketType(marketType: MarketType) {
  return ["WINNER", "GROUP_WINNER", "REACH_R16", "REACH_QF", "REACH_SF"].includes(marketType);
}

function isTargetWorldCupMarket(market: GammaMarket) {
  const slug = String(market.eventSlug ?? extractEventSlug(market) ?? market.slug ?? "");
  const title = `${normalizeMarketTitle(market)} ${extractEventTitle(market) ?? ""} ${slug}`.toLowerCase();
  return title.includes("world cup") || isWorldCupEventSlug(slug);
}

function normalizeMarketTitle(market: GammaMarket) {
  const title = String(
    market.title ??
      market.question ??
      market.groupItemTitle ??
      market.group_item_title ??
      market.slug ??
      "World Cup Market"
  );
  const eventTitle = extractEventTitle(market) ?? "";
  if (eventTitle.toLowerCase().includes("world cup")) {
    return eventTitle.trim();
  }
  if (/will\s+.+\s+win\s+the\s+2026\s+fifa\s+world\s+cup/i.test(title)) return "World Cup Winner";
  return title.trim();
}

function inferMarketType(title: string): MarketType {
  const normalized = title.toLowerCase();
  if (normalized.includes("group") && normalized.includes("winner")) return "GROUP_WINNER";
  if (normalized.includes("round of 16") || normalized.includes("16")) return "REACH_R16";
  if (normalized.includes("quarter")) return "REACH_QF";
  if (normalized.includes("semi")) return "REACH_SF";
  if (normalized.includes("continent")) return "CONTINENT_WINNER";
  if (
    normalized === "world cup winner" ||
    normalized === "2026 fifa world cup winner" ||
    /^will\s+.+\s+win\s+the\s+2026\s+fifa\s+world\s+cup\??$/.test(normalized)
  ) {
    return "WINNER";
  }
  return "OTHER";
}

function parseMarketVolume(market: GammaMarket) {
  return (
    parseNumber(market.eventVolume) ??
    parseNumber(market.volumeNum) ??
    parseNumber(market.volume) ??
    parseNumber(market.eventVolume24hr) ??
    parseNumber(market.volume24hr) ??
    parseNumber(market.volume24hrClob) ??
    parseNumber(market.volume24hrAmm) ??
    0
  );
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
  const parsed = Number(value.replace(/[$,%]/g, ""));
  return Number.isFinite(parsed) ? parsed : undefined;
}

function parseYesPrice(market: GammaMarket) {
  const outcomes = parseMaybeJsonArray(market.outcomes);
  const prices = parseMaybeJsonArray(market.outcomePrices);
  const yesIndex = outcomes.findIndex((outcome) => String(outcome).toLowerCase() === "yes");
  if (yesIndex >= 0) return parseNumber(prices[yesIndex]);
  return parseNumber(market.lastTradePrice) ?? parseNumber(market.outcomePrice) ?? parseNumber(market.price);
}

function inferOutcomeName(market: GammaMarket, marketTitle: string) {
  const direct = market.groupItemTitle ?? market.group_item_title ?? market.outcome;
  if (direct) return String(direct);
  return marketTitle
    .replace(/will\s+/i, "")
    .replace(/\s+win.*$/i, "")
    .replace(/\s+to\s+reach.*$/i, "")
    .trim();
}

function buildPolymarketUrl(market: GammaMarket) {
  const slug = String(market.eventSlug ?? extractEventSlug(market) ?? market.slug ?? "");
  return slug ? `https://polymarket.com/event/${slug}` : undefined;
}

function extractEventTitle(market: GammaMarket) {
  const direct = market.eventTitle ?? market.event_title;
  if (direct) return String(direct);
  const events = parseMaybeJsonArray(market.events);
  const firstEvent = events.find((event) => typeof event === "object" && event !== null) as
    | Record<string, unknown>
    | undefined;
  const title = firstEvent?.title ?? firstEvent?.question;
  return title ? String(title) : undefined;
}

function extractEventSlug(market: GammaMarket) {
  const direct = market.eventSlug ?? market.event_slug;
  if (direct) return String(direct);
  const events = parseMaybeJsonArray(market.events);
  const firstEvent = events.find((event) => typeof event === "object" && event !== null) as
    | Record<string, unknown>
    | undefined;
  const slug = firstEvent?.slug;
  return slug ? String(slug) : undefined;
}

function enrichOpportunity(opportunity: Omit<
  MarketOpportunity,
  | "opportunityGrade"
  | "executionStatus"
  | "watchBelow"
  | "invalidAt"
  | "signalTrend"
  | "conservativeExposureMin"
  | "conservativeExposureMax"
  | "breakEvenProbability"
  | "potentialProfitPer100"
  | "maxLossPer100"
>): MarketOpportunity {
  const watchBelow =
    opportunity.side === "BASKET" ? null : clampProbability(opportunity.fairProbability - 0.03);
  const invalidAt = opportunity.side === "BASKET" ? null : clampProbability(opportunity.fairProbability);
  const executionStatus = calculateExecutionStatus(opportunity, watchBelow, invalidAt);
  const opportunityGrade = calculateOpportunityGrade(opportunity, executionStatus);
  const cost = opportunity.polymarketProbability * 100;
  const potentialProfitPer100 = Math.max(0, 100 - cost);
  const maxLossPer100 = cost;
  const exposure = calculateConservativeExposure(opportunity, executionStatus);

  return {
    ...opportunity,
    opportunityGrade,
    executionStatus,
    watchBelow,
    invalidAt,
    signalTrend: calculateSignalTrend(opportunity),
    conservativeExposureMin: exposure?.min ?? null,
    conservativeExposureMax: exposure?.max ?? null,
    breakEvenProbability: opportunity.polymarketProbability,
    potentialProfitPer100,
    maxLossPer100
  };
}

function normalizeStoredOpportunity<T extends Parameters<typeof enrichOpportunity>[0]>(opportunity: T): T {
  if (
    ["REACH_R16", "REACH_QF", "REACH_SF"].includes(opportunity.marketType) &&
    opportunity.fairValueSource !== "BOOKMAKER" &&
    opportunity.fairValueSource !== "QUANT_MODEL"
  ) {
    const fairProbability = clampProbability(opportunity.polymarketProbability);
    const actionableScore = calculateActionableScore(
      0,
      0,
      opportunity.liquidity ?? 0,
      opportunity.volume24h ?? 0,
      "low"
    );
    return {
      ...opportunity,
      fairProbability,
      edgeScore: 0,
      actionableScore,
      fairValueSource: "UNMODELED",
      dataQuality: "low",
      signalStrength: "no_clear_edge",
      signalLabel: signalLabel("no_clear_edge"),
      explanation: `${opportunity.outcomeName} ${opportunity.side} is covered from live Polymarket data, but CupEdge does not yet model fair value for this progression market. No edge signal is shown.`,
      riskNote: "Progression markets require bracket-path simulation and matchup assumptions. CupEdge does not show a fair-value edge until that model is available."
    };
  }
  return opportunity;
}

function calculateValueEdge(price: number, fairProbability: number) {
  if (price <= 0 || price >= 1) return 0;
  return fairProbability / price - 1;
}

function calculateActionableScore(
  edgeScore: number,
  probabilityEdge: number,
  liquidity: number,
  volume24h: number,
  dataQuality: Confidence
) {
  const valueEdgeScore = Math.min(Math.abs(edgeScore) / 0.5, 1) * 35;
  const probabilityEdgeScore = Math.min(Math.abs(probabilityEdge) / 0.08, 1) * 20;
  const liquidityScore = Math.min(liquidity / 2_000_000, 1) * 20;
  const volumeScore = Math.min(volume24h / 500_000, 1) * 15;
  const dataQualityScore = dataQuality === "high" ? 10 : dataQuality === "medium" ? 8 : 3;
  return Math.round(valueEdgeScore + probabilityEdgeScore + liquidityScore + volumeScore + dataQualityScore);
}

function classifySignal(
  edgeScore: number,
  probabilityEdge: number,
  actionableScore: number,
  side: MarketSide,
  sources: { volumeSource: VolumeSource; fairValueSource: FairValueSource }
): OpportunitySignalStrength {
  const isDemo = sources.volumeSource === "MOCK" || sources.fairValueSource === "MOCK";
  const isUnmodeled = sources.fairValueSource === "UNMODELED";
  const isFallback = sources.fairValueSource === "RATING_FALLBACK";
  if (side === "BASKET") {
    if (isDemo && edgeScore >= 0.02) return "basket_monitor";
    if (edgeScore >= 0.04 && actionableScore >= 60) return "basket_strong";
    if (edgeScore >= 0.02) return "basket_monitor";
    return "basket_too_small";
  }
  if (isUnmodeled) return "no_clear_edge";
  if (isFallback) return "demo_signal";
  if (isDemo) return "demo_signal";
  if (edgeScore >= 0.35 && probabilityEdge >= 0.05 && actionableScore >= 70) return "strong_edge";
  if (edgeScore >= 0.1 && probabilityEdge >= 0.03 && actionableScore >= 55) return "watchlist";
  if (edgeScore >= 0.05 && probabilityEdge >= 0.015) return "mild_edge";
  return "no_clear_edge";
}

function calculateExecutionStatus(
  opportunity: Pick<
    MarketOpportunity,
    | "side"
    | "edgeScore"
    | "polymarketProbability"
    | "fairProbability"
    | "actionableScore"
    | "liquidity"
    | "dataQuality"
    | "volumeSource"
    | "fairValueSource"
  >,
  watchBelow: number | null,
  invalidAt: number | null
): ExecutionStatus {
  if (opportunity.side === "BASKET") {
    return opportunity.actionableScore >= 70 ? "ACTIONABLE_WATCH" : "MONITOR_ONLY";
  }
  if (
    opportunity.volumeSource === "MOCK" ||
    opportunity.fairValueSource === "MOCK" ||
    opportunity.fairValueSource === "UNMODELED" ||
    opportunity.fairValueSource === "RATING_FALLBACK"
  ) {
    return "MONITOR_ONLY";
  }
  if ((opportunity.liquidity ?? 0) < 600_000 || opportunity.dataQuality === "low") return "TOO_THIN";
  if (probabilityGap(opportunity) < 0.015 || opportunity.edgeScore < 0.05 || invalidAt === null) return "NEAR_FAIR_VALUE";
  if (watchBelow !== null && opportunity.polymarketProbability <= watchBelow) {
    return "ACTIONABLE_WATCH";
  }
  if (opportunity.polymarketProbability < invalidAt) return "WAIT_FOR_BETTER_PRICE";
  return "NEAR_FAIR_VALUE";
}

function calculateOpportunityGrade(
  opportunity: Pick<
    MarketOpportunity,
    | "edgeScore"
    | "polymarketProbability"
    | "fairProbability"
    | "actionableScore"
    | "dataQuality"
    | "liquidity"
    | "side"
    | "volumeSource"
    | "fairValueSource"
  >,
  executionStatus: ExecutionStatus
): OpportunityGrade {
  if (
    opportunity.volumeSource === "MOCK" ||
    opportunity.fairValueSource === "MOCK" ||
    opportunity.fairValueSource === "UNMODELED" ||
    opportunity.fairValueSource === "RATING_FALLBACK"
  ) return "D";
  if ((opportunity.liquidity ?? 0) < 600_000 || executionStatus === "TOO_THIN") return "D";
  const gap = probabilityGap(opportunity);
  if (
    opportunity.edgeScore >= 0.5 &&
    gap >= 0.05 &&
    opportunity.actionableScore >= 80 &&
    opportunity.dataQuality !== "low"
  ) {
    return "A";
  }
  if (opportunity.edgeScore >= 0.1 && gap >= 0.03 && opportunity.actionableScore >= 55) return "B";
  if (opportunity.edgeScore >= 0.05 && gap >= 0.015) return "C";
  return "D";
}

function probabilityGap(opportunity: Pick<MarketOpportunity, "fairProbability" | "polymarketProbability">) {
  return opportunity.fairProbability - opportunity.polymarketProbability;
}

function calculateSignalTrend(opportunity: Pick<MarketOpportunity, "edgeScore" | "signalStrength">): SignalTrend {
  if (opportunity.signalStrength === "demo_signal") return "STABLE";
  if (opportunity.edgeScore >= 0.35) return "STRENGTHENING";
  return "STABLE";
}

function calculateConservativeExposure(
  opportunity: Pick<
    MarketOpportunity,
    "edgeScore" | "polymarketProbability" | "fairProbability" | "liquidity" | "dataQuality" | "volumeSource" | "fairValueSource"
  >,
  executionStatus: ExecutionStatus
) {
  if (
    opportunity.edgeScore < 0.1 ||
    opportunity.volumeSource === "MOCK" ||
    opportunity.fairValueSource === "MOCK" ||
    opportunity.fairValueSource === "UNMODELED" ||
    opportunity.fairValueSource === "RATING_FALLBACK" ||
    (opportunity.liquidity ?? 0) < 600_000 ||
    opportunity.dataQuality === "low" ||
    executionStatus === "TOO_THIN" ||
    executionStatus === "OVERHEATED" ||
    executionStatus === "MONITOR_ONLY"
  ) {
    return null;
  }
  const denominator = 1 - opportunity.polymarketProbability;
  const kellyRaw = denominator > 0 ? (opportunity.fairProbability - opportunity.polymarketProbability) / denominator : 0;
  const max = clampRange(kellyRaw * 0.15, 0, 0.03);
  return max > 0 ? { min: max / 2, max } : null;
}

function clampRange(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

function signalLabel(signalStrength: OpportunitySignalStrength) {
  const labels: Record<OpportunitySignalStrength, string> = {
    strong_edge: "Strong Edge",
    watchlist: "Watchlist",
    mild_edge: "Mild Edge",
    no_clear_edge: "No Clear Edge",
    overheated: "Overheated",
    demo_signal: "Demo Signal",
    basket_monitor: "Basket Monitor",
    basket_strong: "Strong Basket Signal",
    basket_too_small: "Basket Too Small"
  };
  return labels[signalStrength];
}

function combinedSource(values: string[]) {
  return values.every((value) => value === values[0]) ? values[0] : "MOCK";
}

function buildExplanation(
  raw: RawOpportunity,
  edgeScore: number,
  probabilityEdge: number,
  signalStrength: OpportunitySignalStrength
) {
  if (raw.side === "BASKET") {
    const basketEdge = ((raw.basketEdge ?? 0) * 100).toFixed(1);
    return `${raw.marketTitle} YES basket totals ${(raw.sumYesBuyPrices ?? 0).toFixed(
      2
    )}, creating a theoretical ${basketEdge} percentage point basket edge.`;
  }
  if (raw.fairValueSource === "UNMODELED") {
    return `${raw.outcomeName} ${raw.side} is covered from live Polymarket data, but CupEdge does not yet model fair value for this market. No edge signal is shown.`;
  }

  const valueEdge = (edgeScore * 100).toFixed(0);
  const probabilityGap = Math.abs(probabilityEdge * 100).toFixed(1);

  const qualifier =
    signalStrength === "strong_edge"
      ? "This ranks as a strong value signal."
      : signalStrength === "watchlist"
        ? "This is worth watching, but it is not a confirmed opportunity."
        : "This is a mild signal and belongs in advanced review.";
  return `${raw.outcomeName} ${raw.side} is priced at ${Math.round(
    raw.polymarketProbability * 100
  )}%, while fair value is estimated near ${Math.round(
    raw.fairProbability * 100
  )}%. The probability gap is +${probabilityGap} percentage points, and the value edge is about +${valueEdge}%. ${qualifier}`;
}

function buildRiskNote(side: MarketSide, signalStrength: OpportunitySignalStrength) {
  if (side === "BASKET") {
    return "Theoretical basket space may be consumed by slippage, orderbook depth, and actual fill prices.";
  }
  if (signalStrength === "overheated") {
    return "Overheated signals can persist if public demand or narrative pressure stays high. Do not treat this as a betting or trading recommendation.";
  }
  return "Signal quality depends on liquidity, market depth, and whether fair probability estimates update with new information.";
}

const rawOpportunities: RawOpportunity[] = [
  {
    marketType: "GROUP_WINNER",
    marketTitle: "World Cup Group C Winner",
    outcomeName: "Morocco",
    side: "YES",
    polymarketProbability: 0.39,
    fairProbability: 0.48,
    liquidity: 1_900_000,
    volume24h: 620_000,
    dataQuality: "high"
  },
  {
    marketType: "REACH_R16",
    marketTitle: "South Korea to Reach Round of 16",
    outcomeName: "South Korea",
    side: "YES",
    polymarketProbability: 0.58,
    fairProbability: 0.66,
    liquidity: 1_650_000,
    volume24h: 510_000,
    dataQuality: "high"
  },
  {
    marketType: "GROUP_WINNER",
    marketTitle: "World Cup Group B Winner",
    outcomeName: "Canada",
    side: "YES",
    polymarketProbability: 0.3,
    fairProbability: 0.36,
    liquidity: 1_250_000,
    volume24h: 310_000,
    dataQuality: "high"
  },
  {
    marketType: "GROUP_WINNER",
    marketTitle: "World Cup Group B Winner",
    outcomeName: "Switzerland",
    side: "YES",
    polymarketProbability: 0.44,
    fairProbability: 0.42,
    liquidity: 1_250_000,
    volume24h: 310_000,
    dataQuality: "high"
  },
  {
    marketType: "GROUP_WINNER",
    marketTitle: "World Cup Group B Winner",
    outcomeName: "Qatar",
    side: "YES",
    polymarketProbability: 0.13,
    fairProbability: 0.12,
    liquidity: 1_250_000,
    volume24h: 310_000,
    dataQuality: "high"
  },
  {
    marketType: "GROUP_WINNER",
    marketTitle: "World Cup Group B Winner",
    outcomeName: "Bosnia and Herzegovina",
    side: "YES",
    polymarketProbability: 0.09,
    fairProbability: 0.1,
    liquidity: 1_250_000,
    volume24h: 310_000,
    dataQuality: "high"
  },
  {
    marketType: "REACH_QF",
    marketTitle: "Japan to Reach Quarter-final",
    outcomeName: "Japan",
    side: "YES",
    polymarketProbability: 0.24,
    fairProbability: 0.3,
    liquidity: 980_000,
    volume24h: 220_000,
    dataQuality: "medium"
  },
  {
    marketType: "CONTINENT_WINNER",
    marketTitle: "Winning Continent",
    outcomeName: "South America",
    side: "YES",
    polymarketProbability: 0.28,
    fairProbability: 0.34,
    liquidity: 1_100_000,
    volume24h: 270_000,
    dataQuality: "medium"
  },
  {
    marketType: "GROUP_WINNER",
    marketTitle: "World Cup Group D Winner",
    outcomeName: "United States",
    side: "YES",
    polymarketProbability: 0.52,
    fairProbability: 0.43,
    liquidity: 2_300_000,
    volume24h: 760_000,
    dataQuality: "high"
  },
  {
    marketType: "GROUP_WINNER",
    marketTitle: "World Cup Group D Winner",
    outcomeName: "United States",
    side: "NO",
    polymarketProbability: 0.48,
    fairProbability: 0.57,
    liquidity: 2_300_000,
    volume24h: 760_000,
    dataQuality: "high"
  },
  {
    marketType: "WINNER",
    marketTitle: "World Cup Winner",
    outcomeName: "Argentina",
    side: "YES",
    polymarketProbability: 0.13,
    fairProbability: 0.08,
    liquidity: 4_200_000,
    volume24h: 1_100_000,
    dataQuality: "high"
  },
  {
    marketType: "REACH_SF",
    marketTitle: "England to Reach Semi-final",
    outcomeName: "England",
    side: "YES",
    polymarketProbability: 0.31,
    fairProbability: 0.36,
    liquidity: 1_800_000,
    volume24h: 430_000,
    dataQuality: "high"
  },
  {
    marketType: "GROUP_WINNER",
    marketTitle: "World Cup Group B Winner",
    outcomeName: "All Group B YES Basket",
    side: "BASKET",
    polymarketProbability: 0.96,
    fairProbability: 1,
    liquidity: 840_000,
    volume24h: 180_000,
    dataQuality: "medium",
    sumYesBuyPrices: 0.96,
    basketEdge: 0.04
  },
  {
    marketType: "GROUP_WINNER",
    marketTitle: "World Cup Group H Winner",
    outcomeName: "Spain",
    side: "YES",
    polymarketProbability: 0.62,
    fairProbability: 0.65,
    liquidity: 1_600_000,
    volume24h: 390_000,
    dataQuality: "high"
  },
  {
    marketType: "OTHER",
    marketTitle: "Top Scoring Team",
    outcomeName: "Brazil",
    side: "YES",
    polymarketProbability: 0.18,
    fairProbability: 0.21,
    liquidity: 520_000,
    volume24h: 90_000,
    dataQuality: "low"
  }
];
