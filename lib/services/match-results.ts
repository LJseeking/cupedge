import { findSeedTeamByName, findSeedTeamInText } from "@/lib/data/teams";
import { prisma } from "@/lib/db/prisma";
import type { MatchResult } from "@/lib/types/research";

type SearchResult = {
  title?: string;
  url?: string;
  content?: string;
  published_date?: string;
};

type ParsedResult = {
  homeTeam?: unknown;
  awayTeam?: unknown;
  homeScore?: unknown;
  awayScore?: unknown;
  playedAt?: unknown;
  sourceUrl?: unknown;
  sourceTitle?: unknown;
  sourceSummary?: unknown;
  confidence?: unknown;
};

type RawMatchResult = Omit<MatchResult, "id" | "capturedAt" | "updatedAt">;

const RECENT_RESULT_FALLBACKS: RawMatchResult[] = [
  {
    matchKey: "2026-06-12:united-states:paraguay",
    homeTeam: "United States",
    awayTeam: "Paraguay",
    homeTeamSlug: "united-states",
    awayTeamSlug: "paraguay",
    homeScore: 4,
    awayScore: 1,
    playedAt: new Date("2026-06-12T00:00:00.000Z"),
    sourceUrl: "https://www.ussoccer.com/",
    sourceTitle: "User-reported recent World Cup result",
    sourceSummary: "United States defeated Paraguay 4-1. Used as a fallback until live result search confirms or supersedes it.",
    confidence: "medium",
    rawJson: JSON.stringify({ source: "cupedge_recent_result_fallback" })
  }
];

export async function refreshMatchResults(): Promise<MatchResult[]> {
  const manual = parseManualResults();
  const searched = await fetchSearchedMatchResults();
  const results = dedupeResults([...RECENT_RESULT_FALLBACKS, ...manual, ...searched]);
  if (!results.length) return getCurrentMatchResults();

  await prisma.$transaction(
    results.map((result) =>
      prisma.matchResult.upsert({
        where: { matchKey: result.matchKey },
        update: {
          homeTeam: result.homeTeam,
          awayTeam: result.awayTeam,
          homeTeamSlug: result.homeTeamSlug,
          awayTeamSlug: result.awayTeamSlug,
          homeScore: result.homeScore,
          awayScore: result.awayScore,
          playedAt: normalizeDate(result.playedAt),
          sourceUrl: result.sourceUrl,
          sourceTitle: result.sourceTitle,
          sourceSummary: result.sourceSummary,
          confidence: result.confidence,
          rawJson: result.rawJson
        },
        create: {
          matchKey: result.matchKey,
          homeTeam: result.homeTeam,
          awayTeam: result.awayTeam,
          homeTeamSlug: result.homeTeamSlug,
          awayTeamSlug: result.awayTeamSlug,
          homeScore: result.homeScore,
          awayScore: result.awayScore,
          playedAt: normalizeDate(result.playedAt),
          sourceUrl: result.sourceUrl,
          sourceTitle: result.sourceTitle,
          sourceSummary: result.sourceSummary,
          confidence: result.confidence,
          rawJson: result.rawJson
        }
      })
    )
  );

  return getCurrentMatchResults();
}

export async function getCurrentMatchResults(): Promise<MatchResult[]> {
  try {
    const rows = await prisma.matchResult.findMany({
      orderBy: [{ playedAt: "desc" }, { updatedAt: "desc" }]
    });
    return rows.map((row) => ({
      id: row.id,
      matchKey: row.matchKey,
      homeTeam: row.homeTeam,
      awayTeam: row.awayTeam,
      homeTeamSlug: row.homeTeamSlug,
      awayTeamSlug: row.awayTeamSlug,
      homeScore: row.homeScore,
      awayScore: row.awayScore,
      playedAt: row.playedAt,
      sourceUrl: row.sourceUrl,
      sourceTitle: row.sourceTitle,
      sourceSummary: row.sourceSummary,
      confidence: row.confidence,
      rawJson: row.rawJson,
      capturedAt: row.capturedAt,
      updatedAt: row.updatedAt
    }));
  } catch (error) {
    console.warn("Match result read failed. Using recent fallback results.", error);
    return RECENT_RESULT_FALLBACKS.map((result) => ({
      ...result,
      capturedAt: new Date(),
      updatedAt: new Date()
    }));
  }
}

async function fetchSearchedMatchResults(): Promise<RawMatchResult[]> {
  const tavilyKey = process.env.TAVILY_API_KEY;
  const deepseekKey = process.env.DEEPSEEK_API_KEY;
  if (!tavilyKey || !deepseekKey) return [];

  const searchResults = await fetchTavilyResultSearch(tavilyKey);
  if (!searchResults.length) return [];
  return parseResultsWithDeepSeek(searchResults, deepseekKey);
}

async function fetchTavilyResultSearch(apiKey: string): Promise<SearchResult[]> {
  const queries = parseList(process.env.MATCH_RESULT_SEARCH_QUERIES);
  const effectiveQueries = queries.length
    ? queries
    : [
        "2026 FIFA World Cup United States Paraguay result score",
        "FIFA World Cup 2026 group stage results scores Paraguay United States",
        "2026 World Cup latest match results group stage"
      ];
  const maxResults = Number(process.env.MATCH_RESULT_SEARCH_MAX_RESULTS ?? "5");
  const settled = await Promise.allSettled(
    effectiveQueries.map((query) =>
      fetch("https://api.tavily.com/search", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          query,
          topic: process.env.MATCH_RESULT_SEARCH_TOPIC || "news",
          search_depth: process.env.MATCH_RESULT_SEARCH_DEPTH || "basic",
          max_results: maxResults,
          include_answer: false,
          include_raw_content: false
        }),
        signal: AbortSignal.timeout(Number(process.env.MATCH_RESULT_SEARCH_TIMEOUT_MS ?? "30000"))
      }).then(async (response) => {
        if (!response.ok) {
          const body = await response.text().catch(() => "");
          throw new Error(`Tavily result search returned ${response.status}: ${body.slice(0, 300)}`);
        }
        return response.json() as Promise<{ results?: SearchResult[] }>;
      })
    )
  );

  const byUrl = new Map<string, SearchResult>();
  for (const result of settled) {
    if (result.status !== "fulfilled") {
      console.warn("Match result search failed.", result.reason);
      continue;
    }
    for (const item of result.value.results ?? []) {
      if (!item.url) continue;
      byUrl.set(item.url, item);
    }
  }
  return [...byUrl.values()].slice(0, Number(process.env.MATCH_RESULT_SEARCH_TOTAL_MAX_RESULTS ?? "12"));
}

async function parseResultsWithDeepSeek(
  searchResults: SearchResult[],
  apiKey: string
): Promise<RawMatchResult[]> {
  const prompt = [
    "Extract only completed 2026 FIFA World Cup match results from the search snippets.",
    "Return strict JSON: {\"results\":[{\"homeTeam\":\"United States\",\"awayTeam\":\"Paraguay\",\"homeScore\":4,\"awayScore\":1,\"playedAt\":\"2026-06-12T00:00:00.000Z\",\"sourceUrl\":\"...\",\"sourceTitle\":\"...\",\"sourceSummary\":\"...\",\"confidence\":\"high|medium|low\"}]}",
    "Ignore rumors, previews, odds, and upcoming fixtures. If a score is not explicit, omit the result.",
    "",
    JSON.stringify(searchResults.map((item) => ({
      title: item.title,
      url: item.url,
      content: item.content,
      published_date: item.published_date
    })))
  ].join("\n");

  try {
    const response = await fetch(`${getDeepSeekBase()}/chat/completions`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: process.env.MATCH_RESULT_DEEPSEEK_MODEL || process.env.DEEPSEEK_MODEL || "deepseek-chat",
        temperature: 0,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content: "You extract football match results into conservative JSON. Do not invent scores."
          },
          { role: "user", content: prompt }
        ]
      }),
      signal: AbortSignal.timeout(Number(process.env.MATCH_RESULT_LLM_TIMEOUT_MS ?? "45000"))
    });
    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new Error(`DeepSeek result parser returned ${response.status}: ${body.slice(0, 300)}`);
    }
    const data = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
    const content = data.choices?.[0]?.message?.content ?? "{}";
    const parsed = parseJsonObject(content);
    const rows = Array.isArray(parsed.results) ? parsed.results as ParsedResult[] : [];
    return rows.map(normalizeParsedResult).filter(Boolean) as RawMatchResult[];
  } catch (error) {
    console.warn("DeepSeek match result parsing failed.", error);
    return [];
  }
}

function parseManualResults(): RawMatchResult[] {
  const json = process.env.MATCH_RESULTS_JSON;
  if (json) {
    try {
      const parsed = JSON.parse(json) as unknown;
      const rows = Array.isArray(parsed) ? parsed : [];
      return rows.map((row) => normalizeParsedResult(row as ParsedResult)).filter(Boolean) as RawMatchResult[];
    } catch (error) {
      console.warn("MATCH_RESULTS_JSON parse failed.", error);
    }
  }

  return parseList(process.env.MANUAL_MATCH_RESULTS)
    .map((line) => {
      const match = line.match(/^(.+?)\s+(\d+)\s*-\s*(\d+)\s+(.+?)(?:\s+@\s+(.+))?$/);
      if (!match) return null;
      return normalizeParsedResult({
        homeTeam: match[1],
        homeScore: Number(match[2]),
        awayScore: Number(match[3]),
        awayTeam: match[4],
        playedAt: match[5],
        sourceTitle: "Manual match result",
        sourceSummary: line,
        confidence: "high"
      });
    })
    .filter(Boolean) as RawMatchResult[];
}

function normalizeParsedResult(row: ParsedResult): RawMatchResult | null {
  const homeTeamName = asText(row.homeTeam);
  const awayTeamName = asText(row.awayTeam);
  const homeSeed = homeTeamName ? findSeedTeamByName(homeTeamName) ?? findSeedTeamInText(homeTeamName) : undefined;
  const awaySeed = awayTeamName ? findSeedTeamByName(awayTeamName) ?? findSeedTeamInText(awayTeamName) : undefined;
  const homeScore = asScore(row.homeScore);
  const awayScore = asScore(row.awayScore);
  if (!homeSeed || !awaySeed || homeScore === null || awayScore === null) return null;
  if (homeSeed.group !== awaySeed.group) return null;

  const playedAt = normalizeDate(row.playedAt) ?? new Date();
  return {
    matchKey: buildMatchKey(homeSeed.slug, awaySeed.slug, playedAt),
    homeTeam: homeSeed.name,
    awayTeam: awaySeed.name,
    homeTeamSlug: homeSeed.slug,
    awayTeamSlug: awaySeed.slug,
    homeScore,
    awayScore,
    playedAt,
    sourceUrl: asText(row.sourceUrl),
    sourceTitle: asText(row.sourceTitle),
    sourceSummary: asText(row.sourceSummary),
    confidence: normalizeConfidence(asText(row.confidence)),
    rawJson: JSON.stringify(row)
  };
}

function dedupeResults(results: RawMatchResult[]) {
  const byPair = new Map<string, RawMatchResult>();
  for (const result of results) {
    const key = pairKey(result.homeTeamSlug, result.awayTeamSlug);
    const existing = byPair.get(key);
    if (!existing || confidenceRank(result.confidence) >= confidenceRank(existing.confidence)) {
      byPair.set(key, result);
    }
  }
  return [...byPair.values()];
}

function buildMatchKey(homeSlug: string, awaySlug: string, playedAt: Date | string | null | undefined) {
  const date = normalizeDate(playedAt)?.toISOString().slice(0, 10) ?? "unknown-date";
  return `${date}:${homeSlug}:${awaySlug}`;
}

function pairKey(a: string, b: string) {
  return [a, b].sort().join(":");
}

function parseJsonObject(content: string) {
  try {
    return JSON.parse(content) as { results?: unknown[] };
  } catch {
    const match = content.match(/\{[\s\S]*\}/);
    if (!match) return {};
    try {
      return JSON.parse(match[0]) as { results?: unknown[] };
    } catch {
      return {};
    }
  }
}

function asText(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function asScore(value: unknown) {
  const score = typeof value === "number" ? value : Number(value);
  return Number.isInteger(score) && score >= 0 && score < 30 ? score : null;
}

function normalizeDate(value: unknown) {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? undefined : value;
  if (typeof value !== "string" && typeof value !== "number") return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function normalizeConfidence(value: string | undefined) {
  if (value === "high" || value === "medium" || value === "low") return value;
  return "medium";
}

function confidenceRank(value: string) {
  if (value === "high") return 3;
  if (value === "medium") return 2;
  return 1;
}

function parseList(value: string | undefined) {
  return (value ?? "")
    .split(/\n|,/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function getDeepSeekBase() {
  return (process.env.DEEPSEEK_API_BASE || "https://api.deepseek.com").replace(/\/$/, "");
}
