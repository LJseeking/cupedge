import { findSeedTeamByName, findSeedTeamInText } from "@/lib/data/teams";
import { prisma } from "@/lib/db/prisma";
import type { MarketOpportunity } from "@/lib/types/opportunity";
import type { ResearchInsight, ResearchScopeType } from "@/lib/types/research";
import type { ValuationRow } from "@/lib/types/valuation";

type InsightInput = {
  scopeType: ResearchScopeType;
  scopeKey: string;
  teamSlug?: string | null;
  marketSlug?: string | null;
  opportunityId?: string | null;
  matchSlug?: string | null;
  deepseekResearch?: string | null;
  gptSummary?: string | null;
  llmAdjustment?: number | null;
  researchSources?: string | null;
  confidence?: string | null;
  modelCount?: number | null;
  capturedAt: Date;
};

export function opportunityResearchKey(opportunity: Pick<MarketOpportunity, "marketSlug" | "outcomeName" | "side">) {
  return `${opportunity.marketSlug}:${opportunity.outcomeName}:${opportunity.side}`;
}

export async function refreshResearchInsights({
  valuations,
  opportunities
}: {
  valuations: ValuationRow[];
  opportunities: MarketOpportunity[];
}) {
  const capturedAt = new Date();
  const valuationBySlug = new Map(valuations.map((valuation) => [valuation.slug, valuation]));
  const inputs: InsightInput[] = [];

  for (const valuation of valuations) {
    if (!hasResearchPayload(valuation)) continue;
    inputs.push({
      scopeType: "TEAM",
      scopeKey: valuation.slug,
      teamSlug: valuation.slug,
      deepseekResearch: valuation.deepseekResearch,
      gptSummary: valuation.gptSummary,
      llmAdjustment: valuation.llmAdjustment,
      researchSources: valuation.researchSources,
      confidence: valuation.confidence,
      modelCount: valuation.llmModelCount,
      capturedAt
    });
  }

  for (const opportunity of opportunities) {
    if (opportunity.side === "BASKET") continue;
    const team = findOpportunityTeam(opportunity);
    const valuation = team ? valuationBySlug.get(team.slug) : undefined;
    if (!valuation || !hasResearchPayload(valuation)) continue;
    inputs.push({
      scopeType: "OPPORTUNITY",
      scopeKey: opportunityResearchKey(opportunity),
      teamSlug: team?.slug,
      marketSlug: opportunity.marketSlug,
      opportunityId: opportunity.id,
      deepseekResearch: valuation.deepseekResearch,
      gptSummary: valuation.gptSummary,
      llmAdjustment: valuation.llmAdjustment,
      researchSources: valuation.researchSources,
      confidence: valuation.confidence,
      modelCount: valuation.llmModelCount,
      capturedAt
    });
  }

  for (const marketInsight of buildMarketInsights(opportunities, valuationBySlug, capturedAt)) {
    inputs.push(marketInsight);
  }

  await prisma.$transaction(
    inputs.map((input) =>
      prisma.researchInsight.upsert({
        where: {
          scopeType_scopeKey: {
            scopeType: input.scopeType,
            scopeKey: input.scopeKey
          }
        },
        update: {
          teamSlug: input.teamSlug,
          marketSlug: input.marketSlug,
          opportunityId: input.opportunityId,
          matchSlug: input.matchSlug,
          deepseekResearch: input.deepseekResearch,
          gptSummary: input.gptSummary,
          llmAdjustment: input.llmAdjustment ?? 0,
          researchSources: input.researchSources,
          confidence: input.confidence,
          modelCount: input.modelCount ?? 0,
          capturedAt: input.capturedAt
        },
        create: {
          scopeType: input.scopeType,
          scopeKey: input.scopeKey,
          teamSlug: input.teamSlug,
          marketSlug: input.marketSlug,
          opportunityId: input.opportunityId,
          matchSlug: input.matchSlug,
          deepseekResearch: input.deepseekResearch,
          gptSummary: input.gptSummary,
          llmAdjustment: input.llmAdjustment ?? 0,
          researchSources: input.researchSources,
          confidence: input.confidence,
          modelCount: input.modelCount ?? 0,
          capturedAt: input.capturedAt
        }
      })
    )
  );

  return inputs.length;
}

export async function getResearchInsight(scopeType: ResearchScopeType, scopeKey: string): Promise<ResearchInsight | null> {
  const row = await prisma.researchInsight.findUnique({
    where: {
      scopeType_scopeKey: {
        scopeType,
        scopeKey
      }
    }
  });
  return row ? mapResearchInsight(row) : null;
}

export async function getResearchInsightForOpportunity(opportunity: MarketOpportunity) {
  return getResearchInsight("OPPORTUNITY", opportunityResearchKey(opportunity));
}

export async function getResearchInsightForMarket(marketSlug: string) {
  return getResearchInsight("MARKET", marketSlug);
}

export async function getResearchInsightForTeam(teamSlug: string) {
  return getResearchInsight("TEAM", teamSlug);
}

function buildMarketInsights(
  opportunities: MarketOpportunity[],
  valuationBySlug: Map<string, ValuationRow>,
  capturedAt: Date
) {
  const byMarket = new Map<string, Array<{ opportunity: MarketOpportunity; valuation: ValuationRow }>>();
  for (const opportunity of opportunities) {
    if (opportunity.side === "BASKET") continue;
    const team = findOpportunityTeam(opportunity);
    const valuation = team ? valuationBySlug.get(team.slug) : undefined;
    if (!valuation || !hasResearchPayload(valuation)) continue;
    byMarket.set(opportunity.marketSlug, [
      ...(byMarket.get(opportunity.marketSlug) ?? []),
      { opportunity, valuation }
    ]);
  }

  return [...byMarket.entries()].map(([marketSlug, rows]) => {
    const uniqueByTeam = new Map<string, ValuationRow>();
    for (const row of rows) {
      uniqueByTeam.set(row.valuation.slug, row.valuation);
    }
    const uniqueValuations = [...uniqueByTeam.values()].slice(0, 6);
    const marketTitle = rows[0]?.opportunity.marketTitle ?? marketSlug;
    return {
      scopeType: "MARKET" as const,
      scopeKey: marketSlug,
      marketSlug,
      deepseekResearch: uniqueValuations
        .map((valuation) => `${valuation.name}: ${valuation.deepseekResearch ?? "No DeepSeek note."}`)
        .join("\n"),
      gptSummary: uniqueValuations
        .map((valuation) => `${valuation.name}: ${valuation.gptSummary ?? valuation.llmAdjustmentReason ?? "No Gemini summary."}`)
        .join("\n"),
      llmAdjustment: median(uniqueValuations.map((valuation) => valuation.llmAdjustment ?? 0)),
      researchSources: mergeSources(uniqueValuations.map((valuation) => valuation.researchSources)),
      confidence: "market_aggregate",
      modelCount: Math.max(...uniqueValuations.map((valuation) => valuation.llmModelCount ?? 0), 0),
      capturedAt,
      // Keep the title visible in the generated text even if the market is not team-specific.
      teamSlug: null,
      opportunityId: null,
      matchSlug: null,
      _marketTitle: marketTitle
    } satisfies InsightInput & { _marketTitle: string };
  });
}

function findOpportunityTeam(opportunity: Pick<MarketOpportunity, "outcomeName" | "marketTitle">) {
  return findSeedTeamByName(opportunity.outcomeName) ??
    findSeedTeamInText(`${opportunity.marketTitle} ${opportunity.outcomeName}`);
}

function hasResearchPayload(row: ValuationRow) {
  return Boolean(row.deepseekResearch || row.gptSummary || row.researchSources || row.llmAdjustmentReason || (row.llmAdjustment ?? 0) !== 0);
}

function mapResearchInsight(row: {
  id: string;
  scopeType: string;
  scopeKey: string;
  teamSlug: string | null;
  marketSlug: string | null;
  opportunityId: string | null;
  matchSlug: string | null;
  deepseekResearch: string | null;
  gptSummary: string | null;
  llmAdjustment: number;
  researchSources: string | null;
  confidence: string | null;
  modelCount: number;
  capturedAt: Date;
  updatedAt: Date;
}): ResearchInsight {
  return {
    id: row.id,
    scopeType: row.scopeType as ResearchScopeType,
    scopeKey: row.scopeKey,
    teamSlug: row.teamSlug,
    marketSlug: row.marketSlug,
    opportunityId: row.opportunityId,
    matchSlug: row.matchSlug,
    deepseekResearch: row.deepseekResearch,
    gptSummary: row.gptSummary,
    llmAdjustment: row.llmAdjustment,
    researchSources: row.researchSources,
    confidence: row.confidence,
    modelCount: row.modelCount,
    capturedAt: row.capturedAt,
    updatedAt: row.updatedAt
  };
}

function mergeSources(values: Array<string | null | undefined>) {
  const sources = new Set<string>();
  for (const value of values) {
    for (const source of (value ?? "").split(/\n+/)) {
      const trimmed = source.trim();
      if (trimmed) sources.add(trimmed);
    }
  }
  return [...sources].slice(0, 8).join("\n") || undefined;
}

function median(values: number[]) {
  const sorted = [...values].filter(Number.isFinite).sort((a, b) => a - b);
  if (!sorted.length) return 0;
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length % 2) return sorted[middle];
  return (sorted[middle - 1] + sorted[middle]) / 2;
}
