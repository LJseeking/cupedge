import { fetchWorldCupWinnerOddsFromApi, getMockBookmakerProbabilities } from "@/lib/data/odds";
import {
  getMockPolymarketQuotes,
  getWorldCupWinnerMarkets
} from "@/lib/data/polymarket";
import { isQualifiedTeamSlug, QUALIFIED_TEAM_SLUGS } from "@/lib/data/qualified-teams";
import { SEEDED_TEAMS } from "@/lib/data/seed";
import { prisma } from "@/lib/db/prisma";
import {
  calculateProbabilityV2,
  getLlmProbabilityAdjustments,
  type LlmProbabilityAdjustment
} from "@/lib/services/probability-v2";
import { getTournamentProjectionMap } from "@/lib/services/tournament-simulation";
import type { TeamTournamentProjection } from "@/lib/types/projection";
import type {
  BookmakerOddRecord,
  BookmakerTeamProbability,
  Confidence,
  PolymarketTeamQuote,
  TeamDetail,
  TeamSeed,
  TeamStatus,
  ValuationRow
} from "@/lib/types/valuation";
import { clampProbability } from "@/lib/utils";

type UpdateValuationOptions = {
  forceMock?: boolean;
  forceOddsRefresh?: boolean;
};

const TOURNAMENT = "world-cup-2026";
const qualifiedSlugs = [...QUALIFIED_TEAM_SLUGS];
const POLYMARKET_REFRESH_ENABLED =
  (process.env.POLYMARKET_REFRESH_ENABLED ?? "true").toLowerCase() !== "false";

export async function ensureSeedTeams() {
  await prisma.$transaction(async (tx) => {
    await tx.team.deleteMany({
      where: {
        OR: [
          { slug: { notIn: qualifiedSlugs } },
          { tournament: { not: TOURNAMENT } },
          { isQualified: false }
        ]
      }
    });

    for (const team of SEEDED_TEAMS) {
      await tx.team.upsert({
        where: { slug: team.slug },
        update: {
          name: team.name,
          countryCode: team.countryCode,
          group: team.group,
          isQualified: true,
          tournament: TOURNAMENT,
          seedAiProbability: team.seedAiProbability
        },
        create: {
          ...team,
          isQualified: true,
          tournament: TOURNAMENT
        }
      });
    }
  });
}

export async function updateValuations(options: UpdateValuationOptions = {}) {
  await ensureSeedTeams();

  const teams = await prisma.team.findMany({
    where: {
      slug: { in: qualifiedSlugs },
      isQualified: true,
      tournament: TOURNAMENT
    },
    orderBy: { name: "asc" }
  });
  const [polymarketQuotes, bookmakerProbabilities, projectionMap] = options.forceMock
    ? [getMockPolymarketQuotes(), getMockBookmakerProbabilities(), new Map<string, TeamTournamentProjection>()]
    : await Promise.all([
        getPolymarketQuotesForUpdate(),
        getBookmakerProbabilitiesForUpdate(options.forceOddsRefresh),
        getTournamentProjectionMap()
      ]);

  const capturedAt = new Date();
  const teamSeeds = teams.map((team) => ({
    name: team.name,
    slug: team.slug,
    countryCode: team.countryCode ?? undefined,
    group: team.group ?? undefined,
    seedAiProbability: team.seedAiProbability ?? 0
  }));
  const llmAdjustments = options.forceMock
    ? new Map<string, LlmProbabilityAdjustment>()
    : await getLlmProbabilityAdjustments(
        teamSeeds.map((team) => {
          const poly = polymarketQuotes.find((quote) => quote.slug === team.slug);
          const odds = bookmakerProbabilities.find((probability) => probability.slug === team.slug);
          const projection = projectionMap.get(team.slug);
          return {
            slug: team.slug,
            teamName: team.name,
            polymarketProbability: poly?.probability,
            bookmakerProbability: odds?.bookmakerProbability,
            quantProbability: projection?.winTournamentProbability ?? team.seedAiProbability,
            seedProbability: team.seedAiProbability
          };
        })
      );
  const valuationRows = buildValuationRows({
    teams: teamSeeds,
    polymarketQuotes,
    bookmakerProbabilities,
    projectionMap,
    llmAdjustments,
    updatedAt: capturedAt
  });

  await prisma.$transaction(async (tx) => {
    for (const row of valuationRows) {
      const team = teams.find((item) => item.slug === row.slug);
      if (!team) continue;
      const poly = polymarketQuotes.find((item) => item.slug === row.slug);
      const odds = bookmakerProbabilities.find((item) => item.slug === row.slug);

      await tx.teamValuation.upsert({
        where: { teamId: team.id },
        update: {
          polymarketProbability: row.polymarketProbability,
          bookmakerProbability: row.bookmakerProbability,
          aiProbability: row.aiProbability,
          marketConsensusProbability: row.marketConsensusProbability,
          quantProbability: row.quantProbability,
          llmAdjustment: row.llmAdjustment ?? 0,
          llmAdjustmentReason: row.llmAdjustmentReason,
          llmModelCount: row.llmModelCount ?? 0,
          deepseekResearch: row.deepseekResearch,
          gptSummary: row.gptSummary,
          researchSources: row.researchSources,
          probabilityModelVersion: row.probabilityModelVersion ?? "cupedge-v2",
          fairProbability: row.fairProbability,
          edgeScore: row.edgeScore,
          status: row.status,
          confidence: row.confidence,
          summary: row.summary
        },
        create: {
          teamId: team.id,
          polymarketProbability: row.polymarketProbability,
          bookmakerProbability: row.bookmakerProbability,
          aiProbability: row.aiProbability,
          marketConsensusProbability: row.marketConsensusProbability,
          quantProbability: row.quantProbability,
          llmAdjustment: row.llmAdjustment ?? 0,
          llmAdjustmentReason: row.llmAdjustmentReason,
          llmModelCount: row.llmModelCount ?? 0,
          deepseekResearch: row.deepseekResearch,
          gptSummary: row.gptSummary,
          researchSources: row.researchSources,
          probabilityModelVersion: row.probabilityModelVersion ?? "cupedge-v2",
          fairProbability: row.fairProbability,
          edgeScore: row.edgeScore,
          status: row.status,
          confidence: row.confidence,
          summary: row.summary
        }
      });

      await tx.marketSnapshot.createMany({
        data: [
          {
            teamId: team.id,
            source: "POLYMARKET",
            polymarketProbability: row.polymarketProbability,
            bestBid: poly?.bestBid,
            bestAsk: poly?.bestAsk,
            spread: poly?.spread,
            liquidity: poly?.liquidity,
            volume: poly?.volume,
            rawJson: stringifyRaw(poly?.rawJson),
            capturedAt
          },
          {
            teamId: team.id,
            source: "BOOKMAKER",
            bookmakerProbability: row.bookmakerProbability,
            rawJson: stringifyRaw(odds?.rawJson),
            capturedAt
          },
          {
            teamId: team.id,
            source: "FAIR",
            polymarketProbability: row.polymarketProbability,
            bookmakerProbability: row.bookmakerProbability,
            fairProbability: row.fairProbability,
            edgeScore: row.edgeScore,
            bestBid: poly?.bestBid,
            bestAsk: poly?.bestAsk,
            spread: poly?.spread,
            liquidity: poly?.liquidity,
            volume: poly?.volume,
            rawJson: stringifyRaw({
              poly: poly?.rawJson,
              odds: odds?.rawJson,
              model: {
                version: row.probabilityModelVersion,
                marketConsensusProbability: row.marketConsensusProbability,
                quantProbability: row.quantProbability,
                llmAdjustment: row.llmAdjustment,
                llmModelCount: row.llmModelCount,
                llmAdjustmentReason: row.llmAdjustmentReason,
                deepseekResearch: row.deepseekResearch,
                gptSummary: row.gptSummary,
                researchSources: row.researchSources
              }
            }),
            capturedAt
          }
        ]
      });

      for (const odd of odds?.odds ?? []) {
        await tx.bookmakerOdd.create({
          data: {
            teamId: team.id,
            bookmaker: odd.bookmaker,
            decimalOdds: odd.decimalOdds,
            impliedProbability: odd.impliedProbability,
            normalizedProbability: odd.normalizedProbability,
            rawJson: stringifyRaw(odd.rawJson),
            capturedAt
          }
        });
      }
    }
  });

  return valuationRows;
}

async function getPolymarketQuotesForUpdate() {
  if (POLYMARKET_REFRESH_ENABLED) {
    return getWorldCupWinnerMarkets();
  }

  return (await getLatestPolymarketQuotesFromDb()) ?? getMockPolymarketQuotes();
}

async function getBookmakerProbabilitiesForUpdate(forceOddsRefresh = false) {
  if (!process.env.THE_ODDS_API_KEY) {
    return (await getLatestBookmakerProbabilitiesFromDb()) ?? getMockBookmakerProbabilities();
  }

  const cached = await getCachedBookmakerProbabilities();
  if (cached && !forceOddsRefresh) return cached;

  try {
    const apiOdds = await fetchWorldCupWinnerOddsFromApi();
    return apiOdds.length
      ? apiOdds
      : ((await getLatestBookmakerProbabilitiesFromDb()) ?? getMockBookmakerProbabilities());
  } catch (error) {
    console.warn("The Odds API update failed. Reusing database bookmaker odds or mock data.", error);
    return (await getLatestBookmakerProbabilitiesFromDb()) ?? getMockBookmakerProbabilities();
  }
}

async function getCachedBookmakerProbabilities(): Promise<BookmakerTeamProbability[] | null> {
  const latest = await prisma.bookmakerOdd.findFirst({
    orderBy: { capturedAt: "desc" },
    select: { capturedAt: true }
  });

  if (!latest) return null;

  const intervalHours = Number(process.env.ODDS_UPDATE_MIN_INTERVAL_HOURS ?? "12");
  const minIntervalMs = Math.max(0, intervalHours) * 60 * 60 * 1000;
  if (Date.now() - latest.capturedAt.getTime() >= minIntervalMs) return null;

  return getBookmakerProbabilitiesAt(latest.capturedAt, "database_cache");
}

async function getLatestBookmakerProbabilitiesFromDb(): Promise<BookmakerTeamProbability[] | null> {
  const latest = await prisma.bookmakerOdd.findFirst({
    orderBy: { capturedAt: "desc" },
    select: { capturedAt: true }
  });

  if (!latest) return null;

  return getBookmakerProbabilitiesAt(latest.capturedAt, "database_latest");
}

async function getLatestPolymarketQuotesFromDb(): Promise<PolymarketTeamQuote[] | null> {
  const latest = await prisma.marketSnapshot.findFirst({
    where: { source: "POLYMARKET" },
    orderBy: { capturedAt: "desc" },
    select: { capturedAt: true }
  });

  if (!latest) return null;

  const rows = await prisma.marketSnapshot.findMany({
    where: {
      source: "POLYMARKET",
      capturedAt: latest.capturedAt,
      team: {
        is: {
          slug: { in: qualifiedSlugs },
          isQualified: true,
          tournament: TOURNAMENT
        }
      }
    },
    include: { team: true }
  });

  if (!rows.length) return null;

  return rows
    .filter((row) => isQualifiedTeamSlug(row.team.slug))
    .map((row) => ({
      teamName: row.team.name,
      slug: row.team.slug,
      probability: clampProbability(row.polymarketProbability ?? row.team.seedAiProbability ?? 0),
      bestBid: row.bestBid ?? undefined,
      bestAsk: row.bestAsk ?? undefined,
      spread: row.spread ?? undefined,
      liquidity: row.liquidity ?? undefined,
      volume: row.volume ?? undefined,
      rawJson: {
        source: "database_latest",
        capturedAt: latest.capturedAt.toISOString(),
        snapshot: parseRawJson(row.rawJson)
      },
      updatedAt: latest.capturedAt.toISOString()
    }));
}

async function getBookmakerProbabilitiesAt(
  capturedAt: Date,
  source: "database_cache" | "database_latest"
): Promise<BookmakerTeamProbability[] | null> {
  const records = await prisma.bookmakerOdd.findMany({
    where: {
      capturedAt,
      team: {
        is: {
          slug: { in: qualifiedSlugs },
          isQualified: true,
          tournament: TOURNAMENT
        }
      }
    },
    include: { team: true }
  });

  if (!records.length) return null;

  const bySlug = new Map<string, BookmakerOddRecord[]>();
  for (const record of records) {
    const oddsRecord = {
      slug: record.team.slug,
      teamName: record.team.name,
      bookmaker: record.bookmaker,
      decimalOdds: record.decimalOdds,
      impliedProbability: record.impliedProbability,
      normalizedProbability: record.normalizedProbability,
      rawJson: parseRawJson(record.rawJson)
    } satisfies BookmakerOddRecord;
    if (!isQualifiedTeamSlug(oddsRecord.slug)) continue;
    bySlug.set(record.team.slug, [...(bySlug.get(record.team.slug) ?? []), oddsRecord]);
  }

  return [...bySlug.entries()].map(([slug, odds]) => ({
    teamName: odds[0].teamName,
    slug,
    bookmakerProbability: median(odds.map((odd) => odd.normalizedProbability)),
    bookmakerCount: odds.length,
    medianDecimalOdds: median(odds.map((odd) => odd.decimalOdds)),
    rawJson: {
      source,
      capturedAt: capturedAt.toISOString()
    },
    odds: []
  }));
}

export async function getCurrentValuations(): Promise<ValuationRow[]> {
  try {
    const rows = await prisma.teamValuation.findMany({
      where: {
        team: {
          is: {
            slug: { in: qualifiedSlugs },
            isQualified: true,
            tournament: TOURNAMENT
          }
        }
      },
      include: { team: true },
      orderBy: { edgeScore: "desc" }
    });

    if (rows.length > 0) {
      return rows
        .filter((row) => isQualifiedTeamSlug(row.team.slug))
        .map((row) => ({
          id: row.id,
          teamId: row.teamId,
          name: row.team.name,
          slug: row.team.slug,
          countryCode: row.team.countryCode,
          polymarketProbability: row.polymarketProbability,
          bookmakerProbability: row.bookmakerProbability,
          aiProbability: row.aiProbability,
          marketConsensusProbability: row.marketConsensusProbability,
          quantProbability: row.quantProbability,
          llmAdjustment: row.llmAdjustment,
          llmAdjustmentReason: row.llmAdjustmentReason,
          llmModelCount: row.llmModelCount,
          deepseekResearch: row.deepseekResearch,
          gptSummary: row.gptSummary,
          researchSources: row.researchSources,
          probabilityModelVersion: row.probabilityModelVersion,
          fairProbability: row.fairProbability,
          edgeScore: row.edgeScore,
          status: row.status as TeamStatus,
          confidence: row.confidence as Confidence,
          summary: row.summary,
          updatedAt: row.updatedAt
        }));
    }
  } catch (error) {
    console.warn("Database valuation read failed. Using mock valuations.", error);
  }

  return buildMockValuationRows();
}

export async function getTeamDetail(slug: string): Promise<TeamDetail | null> {
  if (!isQualifiedTeamSlug(slug)) return null;
  const valuations = await getCurrentValuations();
  const row = valuations.find((valuation) => valuation.slug === slug);
  if (!row) return null;
  return {
    ...row,
    explanations: buildExplanations(row)
  };
}

export async function getCurrentTeamProbabilityV2Map() {
  const valuations = await getCurrentValuations();
  return new Map(
    valuations.map((row) => [
      row.slug,
      {
        fairProbability: row.fairProbability,
        marketConsensusProbability: row.marketConsensusProbability,
        quantProbability: row.quantProbability,
        llmAdjustment: row.llmAdjustment ?? 0,
        llmModelCount: row.llmModelCount ?? 0,
        probabilityModelVersion: row.probabilityModelVersion ?? "cupedge-v2"
      }
    ])
  );
}

export function buildMockValuationRows() {
  return buildValuationRows({
    teams: SEEDED_TEAMS,
    polymarketQuotes: getMockPolymarketQuotes(),
    bookmakerProbabilities: getMockBookmakerProbabilities(),
    projectionMap: new Map<string, TeamTournamentProjection>(),
    llmAdjustments: new Map<string, LlmProbabilityAdjustment>(),
    updatedAt: new Date()
  });
}

export function buildValuationRows({
  teams,
  polymarketQuotes,
  bookmakerProbabilities,
  projectionMap,
  llmAdjustments,
  updatedAt
}: {
  teams: TeamSeed[];
  polymarketQuotes: PolymarketTeamQuote[];
  bookmakerProbabilities: BookmakerTeamProbability[];
  projectionMap?: Map<string, TeamTournamentProjection>;
  llmAdjustments?: Map<string, LlmProbabilityAdjustment>;
  updatedAt: Date;
}): ValuationRow[] {
  return teams
    .filter((team) => isQualifiedTeamSlug(team.slug))
    .map((team) => {
      const poly = polymarketQuotes.find((quote) => quote.slug === team.slug);
      const odds = bookmakerProbabilities.find((probability) => probability.slug === team.slug);
      const projection = projectionMap?.get(team.slug);
      const aiProbability = clampProbability(projection?.winTournamentProbability ?? team.seedAiProbability);
      const polymarketProbability = clampProbability(poly?.probability ?? aiProbability);
      const bookmakerProbability = odds?.bookmakerProbability;
      const probabilityV2 = calculateProbabilityV2(
        {
          slug: team.slug,
          teamName: team.name,
          polymarketProbability,
          bookmakerProbability,
          quantProbability: aiProbability,
          seedProbability: team.seedAiProbability
        },
        llmAdjustments?.get(team.slug)
      );
      const fairProbability = probabilityV2.fairProbability;
      const edgeScore = fairProbability - polymarketProbability;
      const status = calculateStatus(edgeScore);
      const confidence = calculateConfidence(poly, bookmakerProbability);

      return {
        teamId: team.slug,
        name: team.name,
        slug: team.slug,
        countryCode: team.countryCode,
        polymarketProbability,
        bookmakerProbability,
        aiProbability,
        marketConsensusProbability: probabilityV2.marketConsensusProbability,
        quantProbability: probabilityV2.quantProbability,
        llmAdjustment: probabilityV2.llmAdjustment,
        llmAdjustmentReason: probabilityV2.llmAdjustmentReason,
        llmModelCount: probabilityV2.llmModelCount,
        deepseekResearch: probabilityV2.deepseekResearch,
        gptSummary: probabilityV2.gptSummary,
        researchSources: probabilityV2.researchSources,
        probabilityModelVersion: probabilityV2.probabilityModelVersion,
        fairProbability,
        edgeScore,
        status,
        confidence,
        summary: buildSummary(team.name, status, edgeScore),
        updatedAt
      } satisfies ValuationRow;
    })
    .sort((a, b) => b.edgeScore - a.edgeScore);
}

export function calculateFairProbability(
  bookmakerProbability: number | null | undefined,
  aiProbability: number | null | undefined,
  polymarketProbability?: number | null | undefined,
  llmAdjustment?: number | null | undefined
) {
  return calculateProbabilityV2({
    slug: "unknown",
    teamName: "Unknown",
    bookmakerProbability,
    polymarketProbability,
    quantProbability: aiProbability,
    seedProbability: aiProbability
  }, {
    slug: "unknown",
    adjustment: llmAdjustment ?? 0,
    modelCount: llmAdjustment ? 1 : 0
  }).fairProbability;
}

export function calculateStatus(edgeScore: number): TeamStatus {
  if (edgeScore >= 0.05) return "undervalued";
  if (edgeScore >= 0.02) return "slightly_undervalued";
  if (edgeScore <= -0.05) return "overvalued";
  if (edgeScore <= -0.02) return "slightly_overvalued";
  return "fair";
}

export function calculateConfidence(
  polymarketQuote: PolymarketTeamQuote | undefined,
  bookmakerProbability: number | null | undefined
): Confidence {
  if (!polymarketQuote || bookmakerProbability === undefined || bookmakerProbability === null) {
    return "low";
  }
  if (
    polymarketQuote.bestBid !== undefined &&
    polymarketQuote.bestAsk !== undefined &&
    (polymarketQuote.spread ?? polymarketQuote.bestAsk - polymarketQuote.bestBid) < 0.03
  ) {
    return "high";
  }
  if (polymarketQuote.probability > 0 && bookmakerProbability > 0) return "medium";
  return "low";
}

export function buildSummary(teamName: string, status: TeamStatus, edgeScore: number) {
  if (status.includes("undervalued")) {
    return `${teamName} is priced below its fair probability estimate by ${Math.abs(
      edgeScore * 100
    ).toFixed(1)} percentage points.`;
  }
  if (status.includes("overvalued")) {
    return `${teamName} is priced above its fair probability estimate by ${Math.abs(
      edgeScore * 100
    ).toFixed(1)} percentage points.`;
  }
  return `${teamName} is trading close to the current fair probability estimate.`;
}

export function buildExplanations(row: ValuationRow) {
  if (row.status.includes("undervalued")) {
    return [
      "Polymarket is pricing this team below its fair probability estimate.",
      "CupEdge v2 blends market consensus, quant simulation, and any bounded LLM adjustment.",
      "The edge is large enough to be flagged as a potential value opportunity.",
      "The signal remains probabilistic and can change quickly as market prices move."
    ];
  }

  if (row.status.includes("overvalued")) {
    return [
      "Polymarket is pricing this team above its fair probability estimate.",
      "The market may be overpaying for popularity or recent hype.",
      "The current price offers limited value compared with the fair probability estimate.",
      "The signal does not predict a result; it only compares current market pricing."
    ];
  }

  return [
    "Polymarket is close to the current fair probability estimate.",
    "Market consensus, quant simulation, and bounded LLM adjustment do not show a large mismatch.",
    "The edge is inside the neutral range, so CupEdge marks it as fair."
  ];
}

function stringifyRaw(value: unknown) {
  if (value === undefined) return undefined;
  try {
    return JSON.stringify(value);
  } catch {
    return JSON.stringify({ error: "Unable to serialize raw payload" });
  }
}

function parseRawJson(value: string | null) {
  if (!value) return undefined;
  try {
    return JSON.parse(value);
  } catch {
    return undefined;
  }
}

function median(values: number[]) {
  const sorted = [...values].filter(Number.isFinite).sort((a, b) => a - b);
  if (!sorted.length) return 0;
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length % 2) return sorted[middle];
  return (sorted[middle - 1] + sorted[middle]) / 2;
}
