import { fetchJsonWithFallback, fetchTextWithFallback } from "@/lib/data/http";
import { findSeedTeamByName, findSeedTeamInText, teamSlugFromName } from "@/lib/data/teams";
import { prisma } from "@/lib/db/prisma";
import {
  getCuratedSportsMarketSlug,
  getCuratedSportsMarketUrl,
  getPolymarketPropPrices
} from "@/lib/services/match-prop-prices";
import { getCurrentValuations } from "@/lib/services/valuation";
import type { UpcomingMatch } from "@/lib/types/research";
import { clampProbability } from "@/lib/utils";

type GammaRow = Record<string, unknown>;
type TavilySearchResult = {
  title?: string;
  url?: string;
  content?: string;
  published_date?: string;
};
type ChatCompletionResponse = {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
};
type MatchResearchPayload = {
  deepseekResearch?: string;
  gptSummary?: string;
  llmAdjustment?: number;
  researchSources?: string;
};

const DEFAULT_UPCOMING_MATCH_LIMIT = 3;
const POLYMARKET_BASE = "https://gamma-api.polymarket.com";
const POLYMARKET_GAMES_PAGE =
  process.env.POLYMARKET_GAMES_PAGE_URL || "https://polymarket.com/zh/sports/world-cup/games";
const MARKET_SLUG_CODES: Record<string, string[]> = {
  "mexico": ["mex"],
  "south-africa": ["zaf", "rsa"],
  "south-korea": ["kor"],
  "czechia": ["cze", "czh"],
  "canada": ["can"],
  "bosnia-and-herzegovina": ["bih"],
  "qatar": ["qat"],
  "switzerland": ["che", "sui"],
  "brazil": ["bra"],
  "morocco": ["mar"],
  "haiti": ["hti"],
  "scotland": ["sco"],
  "united-states": ["usa"],
  "paraguay": ["pry", "par"],
  "australia": ["aus"],
  "turkey": ["tur"],
  "germany": ["deu", "ger"],
  "curacao": ["kor", "cuw", "cur"],
  "ivory-coast": ["civ"],
  "ecuador": ["ecu"],
  "netherlands": ["nld", "ned"],
  "japan": ["jpn"],
  "sweden": ["swe"],
  "tunisia": ["tun"],
  "belgium": ["bel"],
  "egypt": ["egy"],
  "iran": ["irn"],
  "new-zealand": ["nzl"],
  "spain": ["esp", "spa"],
  "cape-verde": ["cvi", "cpv", "cve", "cv"],
  "saudi-arabia": ["sau"],
  "uruguay": ["ury", "uru"],
  "france": ["fra"],
  "senegal": ["sen"],
  "iraq": ["irq"],
  "norway": ["nor"],
  "argentina": ["arg"],
  "algeria": ["dza", "alg"],
  "austria": ["aut"],
  "jordan": ["jor"],
  "portugal": ["prt", "por"],
  "dr-congo": ["cod", "drc"],
  "uzbekistan": ["uzb"],
  "colombia": ["col"],
  "england": ["eng"],
  "croatia": ["hrv", "cro"],
  "ghana": ["gha"],
  "panama": ["pan"]
};
const MARKET_TEXT_ALIASES: Record<string, string[]> = {
  "germany": ["Germany", "GER", "DEU"],
  "curacao": ["Curacao", "Curaçao", "KOR"],
  "netherlands": ["Netherlands", "NED", "NLD"],
  "japan": ["Japan", "JPN"],
  "ivory-coast": ["Ivory Coast", "Cote d'Ivoire", "Côte d'Ivoire", "d'Ivoire", "CIV"],
  "ecuador": ["Ecuador", "ECU"],
  "australia": ["Australia", "AUS"],
  "turkey": ["Turkey", "TUR"],
  "spain": ["Spain", "ESP", "SPA"],
  "cape-verde": ["Cape Verde", "Cabo Verde", "CV", "CVI", "CPV", "CVE"]
};
const CODE_TO_TEAM_SLUG = buildCodeToTeamSlugMap();

export async function refreshUpcomingMatches() {
  const limit = parsePositiveInteger(process.env.UPCOMING_MATCH_LIMIT, DEFAULT_UPCOMING_MATCH_LIMIT);
  const matches = await fetchUpcomingMatchesFromPolymarketGames(limit);
  const valuations = await getCurrentValuations();
  const valuationBySlug = new Map(valuations.map((valuation) => [valuation.slug, valuation]));
  const enriched = await refreshUpcomingMatchResearch(
    matches.map((match) => enrichMatchFairProbabilities(match, valuationBySlug))
  );

  if (!enriched.length) return [];

  await prisma.$transaction([
    prisma.upcomingMatch.deleteMany({}),
    ...enriched.map((match) =>
      prisma.upcomingMatch.create({
        data: {
          matchSlug: match.matchSlug,
          marketSlug: match.marketSlug,
          marketTitle: match.marketTitle,
          homeTeam: match.homeTeam,
          awayTeam: match.awayTeam,
          homeTeamSlug: match.homeTeamSlug,
          awayTeamSlug: match.awayTeamSlug,
          startTime: normalizeDate(match.startTime),
          homeProbability: match.homeProbability,
          drawProbability: match.drawProbability,
          awayProbability: match.awayProbability,
          fairHomeProbability: match.fairHomeProbability,
          fairDrawProbability: match.fairDrawProbability,
          fairAwayProbability: match.fairAwayProbability,
          llmAdjustment: match.llmAdjustment,
          deepseekResearch: match.deepseekResearch,
          gptSummary: match.gptSummary,
          researchSources: match.researchSources,
          marketSourceUrl: match.marketSourceUrl
        }
      })
    )
  ]);

  return enriched;
}

export async function getUpcomingMatches(limit = 6): Promise<UpcomingMatch[]> {
  const now = new Date();
  let rows: Awaited<ReturnType<typeof prisma.upcomingMatch.findMany>> = [];
  try {
    rows = await prisma.upcomingMatch.findMany({
      where: {
        OR: [{ startTime: null }, { startTime: { gte: now } }]
      },
      orderBy: [{ startTime: "asc" }, { updatedAt: "desc" }],
      take: limit
    });
  } catch (error) {
    console.warn("Upcoming match read failed. Falling back to default match card.", error);
  }

  const hasLegacyScheduleRows = rows.some((row) => {
    const sourceUrl = row.marketSourceUrl ?? "";
    return sourceUrl && !sourceUrl.includes("polymarket.com");
  });
  const hasMissingMoneylineRows = rows.some((row) => !hasMoneylinePrices({
    home: row.homeProbability ?? undefined,
    draw: row.drawProbability ?? undefined,
    away: row.awayProbability ?? undefined
  }));
  if (!rows.length || hasLegacyScheduleRows || hasMissingMoneylineRows) {
    const valuations = await getCurrentValuations();
    const valuationBySlug = new Map(valuations.map((valuation) => [valuation.slug, valuation]));
    const matches = await fetchUpcomingMatchesFromPolymarketGames(limit);
    if (matches.length) {
      return enrichMatchesWithPropPrices(
        matches.map((match) => enrichMatchFairProbabilities(match, valuationBySlug))
      );
    }
  }

  return enrichMatchesWithPropPrices(rows.map((row) => ({
    id: row.id,
    matchSlug: row.matchSlug,
    marketSlug: row.marketSlug,
    marketTitle: row.marketTitle,
    homeTeam: row.homeTeam,
    awayTeam: row.awayTeam,
    homeTeamSlug: row.homeTeamSlug,
    awayTeamSlug: row.awayTeamSlug,
    startTime: row.startTime,
    homeProbability: row.homeProbability,
    drawProbability: row.drawProbability,
    awayProbability: row.awayProbability,
    fairHomeProbability: row.fairHomeProbability,
    fairDrawProbability: row.fairDrawProbability,
    fairAwayProbability: row.fairAwayProbability,
    llmAdjustment: row.llmAdjustment,
    deepseekResearch: row.deepseekResearch,
    gptSummary: row.gptSummary,
    researchSources: row.researchSources,
    marketSourceUrl: row.marketSourceUrl,
    updatedAt: row.updatedAt
  })));
}

async function enrichMatchesWithPropPrices(matches: UpcomingMatch[]) {
  if (!matches.length) return matches;
  const maxMatches = parsePositiveInteger(process.env.UPCOMING_MATCH_PROP_PRICE_LIMIT, 3);
  const enriched = await Promise.all(
    matches.map(async (match, index) => {
      const curatedMarketUrl = getCuratedSportsMarketUrl(match);
      const curatedMarketSlug = getCuratedSportsMarketSlug(match);
      const baseMatch = {
        ...match,
        marketSlug: match.marketSlug ?? curatedMarketSlug,
        marketSourceUrl: curatedMarketUrl ?? match.marketSourceUrl
      };
      if (index >= maxMatches) return baseMatch;
      const prices = await getPolymarketPropPrices(baseMatch);
      return prices.length ? { ...baseMatch, propMarketPrices: prices } : baseMatch;
    })
  );
  return enriched;
}

async function fetchUpcomingMatchesFromPolymarketGames(limit: number): Promise<UpcomingMatch[]> {
  const base = (process.env.POLYMARKET_API_BASE || POLYMARKET_BASE).replace(/\/$/, "");
  try {
    const html = await fetchTextWithFallback(POLYMARKET_GAMES_PAGE, 15_000);
    const fromGamesPage = html ? parsePolymarketGamesPage(html, limit) : [];
    const enriched = await enrichPolymarketMatchesWithGamma(base, fromGamesPage, limit);
    if (enriched.length) return enriched.slice(0, limit);
  } catch (error) {
    console.warn("Polymarket games page request failed.", error);
  }
  return enrichPolymarketMatchesWithGamma(base, getCuratedUpcomingMatches(limit), limit);
}

async function enrichPolymarketMatchesWithGamma(base: string, matches: UpcomingMatch[], limit: number) {
  const enriched: UpcomingMatch[] = [];
  for (const match of matches.slice(0, limit)) {
    const rows = match.marketSlug
      ? await fetchGammaRows(`${base}/events?slug=${encodeURIComponent(match.marketSlug)}`)
      : [];
    enriched.push(parseMatchFromGamma(match.matchSlug, rows, match) ?? match);
  }
  return enriched;
}

function parsePolymarketGamesPage(html: string, limit: number) {
  const hrefMatches = [...html.matchAll(/href=["'](?:https:\/\/polymarket\.com)?\/(?:zh\/)?sports\/world-cup\/(fifwc-[^"'?#/]+)["']/gi)];
  const slugs = hrefMatches.map((match) => match[1]);
  const matches: UpcomingMatch[] = [];
  const seen = new Set<string>();
  for (const slug of slugs) {
    if (seen.has(slug)) continue;
    seen.add(slug);
    const parsed = matchFromPolymarketSlug(slug);
    if (parsed) matches.push(parsed);
    if (matches.length >= limit) break;
  }
  return matches;
}

function matchFromPolymarketSlug(slug: string): UpcomingMatch | null {
  const parts = slug.match(/^fifwc-([a-z0-9]+)-([a-z0-9]+)-(\d{4}-\d{2}-\d{2})$/i);
  if (!parts) return null;
  const homeTeamSlug = CODE_TO_TEAM_SLUG[parts[1].toLowerCase()];
  const awayTeamSlug = CODE_TO_TEAM_SLUG[parts[2].toLowerCase()];
  if (!homeTeamSlug || !awayTeamSlug) return null;
  const homeSeed = findSeedTeamByName(titleizeSlug(homeTeamSlug)) ?? findSeedTeamInText(titleizeSlug(homeTeamSlug));
  const awaySeed = findSeedTeamByName(titleizeSlug(awayTeamSlug)) ?? findSeedTeamInText(titleizeSlug(awayTeamSlug));
  const homeTeam = homeSeed?.name ?? titleizeSlug(homeTeamSlug);
  const awayTeam = awaySeed?.name ?? titleizeSlug(awayTeamSlug);

  return {
    matchSlug: slug,
    marketSlug: slug,
    marketTitle: `${homeTeam} vs ${awayTeam}`,
    homeTeam,
    awayTeam,
    homeTeamSlug,
    awayTeamSlug,
    startTime: new Date(`${parts[3]}T12:00:00Z`),
    llmAdjustment: 0,
    marketSourceUrl: `https://polymarket.com/zh/sports/world-cup/${slug}`,
    updatedAt: new Date()
  };
}

function getCuratedUpcomingMatches(limit: number) {
  return [
    matchFromPolymarketSlug("fifwc-esp-cvi-2026-06-15"),
    matchFromPolymarketSlug("fifwc-bel-egy-2026-06-15"),
    matchFromPolymarketSlug("fifwc-sau-uru-2026-06-15")
  ].filter((match): match is UpcomingMatch => Boolean(match)).slice(0, limit);
}

async function fetchGammaRows(url: string) {
  try {
    const data = await fetchJsonWithFallback<unknown>(url, 12_000);
    const payload = typeof data === "object" && data !== null ? data as Record<string, unknown> : {};
    const rows = Array.isArray(data)
      ? data
      : Array.isArray(payload.data)
        ? payload.data
        : Object.keys(payload).length
          ? [payload]
          : [];
    return rows as GammaRow[];
  } catch (error) {
    console.warn(`Upcoming match Gamma request failed for ${url}`, error);
    return [];
  }
}

function parseMatchFromGamma(matchSlug: string, rows: GammaRow[], expected?: UpcomingMatch): UpcomingMatch | null {
  const row = rows[0];
  if (!row) return null;
  const candidates = rows.flatMap((candidate) => {
    const markets = parseMaybeJsonArray(candidate.markets)
      .filter((item): item is GammaRow => typeof item === "object" && item !== null)
      .map((market) => ({
        ...market,
        eventSlug: candidate.slug,
        eventTitle: candidate.title ?? candidate.question,
        eventStartDate: candidate.startDate ?? candidate.startTime ?? candidate.endDate
      }));
    return markets.length ? markets : [candidate];
  });
  const source = candidates
    .map((candidate) => ({
      candidate,
      parsed: parseGammaMatchCandidate(matchSlug, candidate, row, expected)
    }))
    .find((item) => item.parsed)?.parsed;
  return source ?? null;
}

function parseGammaMatchCandidate(matchSlug: string, source: GammaRow, row: GammaRow, expected?: UpcomingMatch): UpcomingMatch | null {
  const title = String(source.question ?? source.title ?? row.title ?? row.question ?? matchSlug);
  const teams = expected ? {
    homeTeam: expected.homeTeam,
    awayTeam: expected.awayTeam,
    homeTeamSlug: expected.homeTeamSlug ?? teamSlugFromName(expected.homeTeam),
    awayTeamSlug: expected.awayTeamSlug ?? teamSlugFromName(expected.awayTeam)
  } : parseTeamsFromTitle(title, matchSlug);
  if (!teams) return null;
  if (expected && !textLooksLikeFixture(source, expected)) return null;
  const outcomes = parseMaybeJsonArray(source.outcomes).map(String);
  const prices = parseMaybeJsonArray(source.outcomePrices).map(parseNumber);
  const probabilities = parseMoneylineProbabilities(outcomes, prices, teams);
  if (!hasMoneylinePrices(probabilities)) return null;
  const startTime = parseDate(source.startDate ?? source.startTime ?? source.eventStartDate ?? row.startDate ?? row.startTime ?? source.endDate ?? row.endDate);
  const eventSlug = String(source.eventSlug ?? row.slug ?? source.slug ?? matchSlug);

  return {
    matchSlug,
    marketSlug: String(source.slug ?? row.slug ?? matchSlug),
    marketTitle: title,
    homeTeam: teams.homeTeam,
    awayTeam: teams.awayTeam,
    homeTeamSlug: teams.homeTeamSlug,
    awayTeamSlug: teams.awayTeamSlug,
    startTime,
    homeProbability: probabilities.home,
    drawProbability: probabilities.draw,
    awayProbability: probabilities.away,
    llmAdjustment: 0,
    marketSourceUrl: eventSlug ? `https://polymarket.com/event/${eventSlug}` : `https://polymarket.com/search?q=${encodeURIComponent(`${teams.homeTeam} ${teams.awayTeam}`)}`,
    updatedAt: new Date()
  };
}

function enrichMatchFairProbabilities(
  match: UpcomingMatch,
  valuationBySlug: Map<string, Awaited<ReturnType<typeof getCurrentValuations>>[number]>
): UpcomingMatch {
  const home = match.homeTeamSlug ? valuationBySlug.get(match.homeTeamSlug) : undefined;
  const away = match.awayTeamSlug ? valuationBySlug.get(match.awayTeamSlug) : undefined;
  const homeStrength = Math.max(0.001, home?.fairProbability ?? home?.aiProbability ?? 0.01);
  const awayStrength = Math.max(0.001, away?.fairProbability ?? away?.aiProbability ?? 0.01);
  const homeNoDraw = homeStrength / (homeStrength + awayStrength);
  const draw = clampProbability(0.26 - Math.abs(homeNoDraw - 0.5) * 0.12);
  const homeBase = clampProbability((1 - draw) * homeNoDraw);
  const awayBase = clampProbability((1 - draw) * (1 - homeNoDraw));
  const llmAdjustment = clampMatchAdjustment((home?.llmAdjustment ?? 0) - (away?.llmAdjustment ?? 0));
  const fairHome = clampProbability(homeBase + llmAdjustment);
  const fairAway = clampProbability(awayBase - llmAdjustment);
  const total = fairHome + draw + fairAway;

  return {
    ...match,
    fairHomeProbability: fairHome / total,
    fairDrawProbability: draw / total,
    fairAwayProbability: fairAway / total,
    llmAdjustment,
    deepseekResearch: [
      home?.deepseekResearch ? `${match.homeTeam}: ${home.deepseekResearch}` : "",
      away?.deepseekResearch ? `${match.awayTeam}: ${away.deepseekResearch}` : ""
    ].filter(Boolean).join("\n") || undefined,
    gptSummary: [
      home?.gptSummary ? `${match.homeTeam}: ${home.gptSummary}` : "",
      away?.gptSummary ? `${match.awayTeam}: ${away.gptSummary}` : ""
    ].filter(Boolean).join("\n") || undefined,
    researchSources: mergeSources([home?.researchSources, away?.researchSources])
  };
}

async function refreshUpcomingMatchResearch(matches: UpcomingMatch[]) {
  if (!isMatchResearchEnabled()) return matches;
  const tavilyKey = process.env.TAVILY_API_KEY;
  const deepseekKey = process.env.DEEPSEEK_API_KEY;
  const geminiKey = process.env.GEMINI_API_KEY || process.env.LLM_SUMMARY_API_KEY;
  if (!tavilyKey || !deepseekKey) {
    console.warn("Upcoming match research skipped because Tavily or DeepSeek key is missing.");
    return matches;
  }

  const results: UpcomingMatch[] = [];
  for (const match of matches) {
    try {
      const searchResults = await fetchMatchSearchResults(match, tavilyKey);
      if (!searchResults.length) {
        results.push(match);
        continue;
      }
      const deepseek = await fetchMatchDeepSeekResearch(match, searchResults, deepseekKey);
      let research = deepseek;
      if (geminiKey) {
        try {
          research = await fetchMatchGeminiSummary(match, searchResults, deepseek, geminiKey);
        } catch (error) {
          console.warn(`Gemini match summary failed for ${match.homeTeam} vs ${match.awayTeam}. Continuing with DeepSeek only.`, error);
          research = buildGeminiFallbackSummary(match, deepseek);
        }
      } else {
        research = buildGeminiFallbackSummary(match, deepseek);
      }
      results.push(applyMatchResearch(match, research));
    } catch (error) {
      console.warn(`Upcoming match research failed for ${match.homeTeam} vs ${match.awayTeam}.`, error);
      results.push(match);
    }
  }
  return results;
}

function isMatchResearchEnabled() {
  return (process.env.LLM_RESEARCH_ENABLED ?? "false").toLowerCase() === "true" &&
    (process.env.UPCOMING_MATCH_RESEARCH_ENABLED ?? "true").toLowerCase() !== "false";
}

async function fetchMatchSearchResults(match: UpcomingMatch, apiKey: string): Promise<TavilySearchResult[]> {
  const queries = buildMatchResearchQueries(match);
  const maxResults = parsePositiveInteger(process.env.UPCOMING_MATCH_SEARCH_MAX_RESULTS, 4);
  const settled = await Promise.allSettled(
    queries.map((query) =>
      fetch("https://api.tavily.com/search", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          query,
          topic: process.env.RESEARCH_SEARCH_TOPIC || "news",
          search_depth: process.env.RESEARCH_SEARCH_DEPTH || "basic",
          max_results: maxResults,
          include_answer: true,
          include_raw_content: false
        }),
        signal: AbortSignal.timeout(Number(process.env.RESEARCH_SEARCH_TIMEOUT_MS ?? "30000"))
      }).then(async (response) => {
        if (!response.ok) {
          const body = await response.text().catch(() => "");
          throw new Error(`Tavily match search returned ${response.status}: ${body.slice(0, 300)}`);
        }
        return response.json() as Promise<{ results?: TavilySearchResult[] }>;
      })
    )
  );

  const seen = new Set<string>();
  const results: TavilySearchResult[] = [];
  for (const result of settled) {
    if (result.status !== "fulfilled") {
      console.warn("Tavily upcoming match query failed.", result.reason);
      continue;
    }
    for (const item of result.value.results ?? []) {
      if (!item.url || seen.has(item.url)) continue;
      seen.add(item.url);
      results.push(item);
    }
  }
  const bettingRelevant = results.filter(isBettingRelevantSearchResult);
  const sourcePool = bettingRelevant.length ? bettingRelevant : results;
  return sourcePool.slice(0, parsePositiveInteger(process.env.UPCOMING_MATCH_SEARCH_TOTAL_MAX_RESULTS, 10));
}

function buildMatchResearchQueries(match: UpcomingMatch) {
  const date = formatMatchDateForQuery(match.startTime);
  const fixture = `${match.homeTeam} vs ${match.awayTeam}`;
  return [
    `${fixture} ${date} injury suspension predicted lineup team news -watch -stream -tv`,
    `${fixture} ${date} odds movement betting preview prediction -watch -stream -tv`,
    `${match.homeTeam} ${match.awayTeam} coach press conference tactics form World Cup -watch -stream -tv`,
    `${fixture} weather venue pitch travel rest advantage World Cup -watch -stream -tv`
  ];
}

function isBettingRelevantSearchResult(result: TavilySearchResult) {
  const text = [result.title, result.content, result.url].filter(Boolean).join(" ").toLowerCase();
  const positiveSignals = [
    "injury",
    "injuries",
    "injured",
    "suspension",
    "suspended",
    "lineup",
    "line-up",
    "starting xi",
    "squad",
    "rotation",
    "rest",
    "travel",
    "weather",
    "pitch",
    "tactical",
    "tactics",
    "coach",
    "manager",
    "press conference",
    "form",
    "odds",
    "betting",
    "prediction",
    "preview",
    "expected goals",
    "xg"
  ];
  const lowValueSignals = [
    "how to watch",
    "watch live",
    "live stream",
    "streaming",
    "tv channel",
    "where to watch",
    "broadcast",
    "start time",
    "kickoff time",
    "kick-off time"
  ];
  const positiveScore = positiveSignals.reduce((score, signal) => score + (text.includes(signal) ? 1 : 0), 0);
  const lowValueScore = lowValueSignals.reduce((score, signal) => score + (text.includes(signal) ? 1 : 0), 0);
  return positiveScore > lowValueScore;
}

async function fetchMatchDeepSeekResearch(
  match: UpcomingMatch,
  searchResults: TavilySearchResult[],
  apiKey: string
): Promise<MatchResearchPayload> {
  const response = await fetch(`${getDeepSeekBase()}/chat/completions`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: process.env.DEEPSEEK_MODEL || "deepseek-chat",
      temperature: 0.1,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "You extract bet-relevant football match intelligence from web search snippets. Do not invent facts. Ignore broadcast, live-stream, schedule-only, and generic tournament background unless it directly changes match probability. Return strict JSON. All display text must include both '中文：' and 'English:' sections."
        },
        {
          role: "user",
          content: JSON.stringify({
            task:
              "为下注前复核提取这场比赛的增量信息。只关注会影响主胜/平/客胜概率的事实：伤停、停赛、预计首发/轮换、战术匹配、近期状态、赛程/旅行/休息、天气/场地、教练发布会、赔率/盘口变化。不要写比赛时间、球场、电视转播、观看方式或普通赛程信息。只使用给定搜索结果；如果没有下注相关增量信息，明确写“没有发现下注相关增量信息”，并列出缺失的关键类别。",
            match: matchResearchContext(match),
            searchResults: searchResults.map(searchResultForPrompt),
            outputShape: {
              deepseekResearch:
                "中文：1) 下注相关信息；2) 概率方向影响；3) 证据强弱；4) 不足与不确定性。只保留对下注有用的信息。\nEnglish: Same meaning in English.",
              sources: ["https://example.com/source"]
            },
            rules: [
              "Do not mention how to watch, TV channel, streaming, kickoff time, or venue unless weather/pitch/travel materially affects probability.",
              "Coach quote is useful only if it implies tactics, lineup, motivation, rotation, or risk posture.",
              "If only schedule/broadcast/background sources are available, say there is no bet-relevant incremental information.",
              "Never turn generic preview text into a probability signal."
            ]
          })
        }
      ]
    }),
    signal: AbortSignal.timeout(Number(process.env.DEEPSEEK_RESEARCH_TIMEOUT_MS ?? "90000"))
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`DeepSeek match research returned ${response.status}: ${body.slice(0, 500)}`);
  }
  const data = (await response.json()) as ChatCompletionResponse;
  const payload = safeParseObject(data.choices?.[0]?.message?.content ?? "");
  return {
    deepseekResearch: typeof payload.deepseekResearch === "string" ? payload.deepseekResearch.slice(0, 1400) : undefined,
    researchSources: stringifySources(payload.sources)
  };
}

async function fetchMatchGeminiSummary(
  match: UpcomingMatch,
  searchResults: TavilySearchResult[],
  deepseek: MatchResearchPayload,
  apiKey: string
): Promise<MatchResearchPayload> {
  const maxAdjustment = getMatchLlmMaxAdjustment();
  const response = await fetch(`${getGeminiBase()}/chat/completions`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: process.env.GEMINI_SUMMARY_MODEL || process.env.LLM_SUMMARY_MODEL || "gemini-2.5-flash",
      temperature: 0.1,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "You are a final betting-focused match forecasting reviewer. Use only bet-relevant evidence from search snippets and DeepSeek research to produce a bilingual display summary and a small home-vs-away fair-probability adjustment. Ignore broadcast, schedule-only, and generic preview information. Return strict JSON only."
        },
        {
          role: "user",
          content: JSON.stringify({
            task:
              "复核这场比赛的下注相关增量信息，解释它是否足以影响公允概率。adjustment 是加到主队胜率、同时从客队胜率扣除的十进制概率；只有伤停/首发/战术/状态/赔率/天气等强证据才允许非零。普通新闻、观看信息、比赛时间或泛泛预览必须 adjustment=0。",
            maxAdjustment,
            match: matchResearchContext(match),
            deepseekResearch: deepseek.deepseekResearch,
            searchResults: searchResults.map(searchResultForPrompt),
            outputShape: {
              gptSummary:
                "中文：下注前结论、可用证据、概率影响、是否值得因为新闻调整公允概率。\nEnglish: Same meaning in English.",
              adjustment: 0,
              reason: "中文：调整原因。\nEnglish: Same meaning in English.",
              sources: ["https://example.com/source"]
            },
            rules: [
              "Do not exceed maxAdjustment in either direction.",
              "Use 0 if there is no strong current evidence.",
              "Do not invent injuries, lineups, or results.",
              "Do not treat broadcast details, kickoff time, venue, or generic previews as betting evidence.",
              "Return JSON only."
            ]
          })
        }
      ]
    }),
    signal: AbortSignal.timeout(Number(process.env.GEMINI_SUMMARY_TIMEOUT_MS ?? "90000"))
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`Gemini match summary returned ${response.status}: ${body.slice(0, 500)}`);
  }
  const data = (await response.json()) as ChatCompletionResponse;
  const payload = safeParseObject(data.choices?.[0]?.message?.content ?? "");
  return {
    deepseekResearch: deepseek.deepseekResearch,
    gptSummary: typeof payload.gptSummary === "string"
      ? payload.gptSummary.slice(0, 1400)
      : buildGeminiFallbackText(match, deepseek),
    llmAdjustment: boundMatchLlmAdjustment(Number(payload.adjustment ?? 0)),
    researchSources: mergeSources([deepseek.researchSources, stringifySources(payload.sources)])
  };
}

function buildGeminiFallbackSummary(match: UpcomingMatch, deepseek: MatchResearchPayload): MatchResearchPayload {
  return {
    ...deepseek,
    gptSummary: buildGeminiFallbackText(match, deepseek),
    llmAdjustment: 0
  };
}

function buildGeminiFallbackText(match: UpcomingMatch, deepseek: MatchResearchPayload) {
  const excerpt = extractFirstResearchSentence(deepseek.deepseekResearch);
  return [
    `中文：Gemini 本轮没有返回可解析的总结，因此不做额外概率修正。DeepSeek 已完成 ${match.homeTeam} vs ${match.awayTeam} 的搜索研究；当前保留量化公允概率，并参考 DeepSeek 要点：${excerpt || "暂无足够强的新消息。"}。`,
    `English: Gemini did not return a parseable summary in this run, so no extra probability adjustment is applied. DeepSeek search research was completed for ${match.homeTeam} vs ${match.awayTeam}; the fair probability remains driven by the quantitative model, with DeepSeek notes considered: ${excerpt || "no sufficiently strong new information."}`
  ].join("\n");
}

function extractFirstResearchSentence(value: string | null | undefined) {
  if (!value) return "";
  const chinese = value.match(/中文[:：]\s*([\s\S]*?)(?:English\s*:|$)/i)?.[1]?.trim();
  const source = chinese || value;
  return source
    .replace(/\s+/g, " ")
    .split(/[。.!！?？]/)[0]
    ?.slice(0, 180)
    .trim();
}

function applyMatchResearch(match: UpcomingMatch, research: MatchResearchPayload): UpcomingMatch {
  const llmAdjustment = boundMatchLlmAdjustment(research.llmAdjustment ?? match.llmAdjustment ?? 0);
  const fairHome = clampProbability((match.fairHomeProbability ?? 0) + llmAdjustment);
  const fairAway = clampProbability((match.fairAwayProbability ?? 0) - llmAdjustment);
  const fairDraw = clampProbability(match.fairDrawProbability ?? 0);
  const total = fairHome + fairDraw + fairAway;
  return {
    ...match,
    fairHomeProbability: total > 0 ? fairHome / total : match.fairHomeProbability,
    fairDrawProbability: total > 0 ? fairDraw / total : match.fairDrawProbability,
    fairAwayProbability: total > 0 ? fairAway / total : match.fairAwayProbability,
    llmAdjustment,
    deepseekResearch: research.deepseekResearch ?? match.deepseekResearch,
    gptSummary: research.gptSummary ?? buildGeminiFallbackText(match, research),
    researchSources: mergeSources([research.researchSources, match.researchSources])
  };
}

function parseTeamsFromTitle(title: string, slug: string) {
  const normalized = title.replace(/\s+/g, " ").trim();
  const vsMatch = normalized.match(/^(.+?)\s+(?:vs\.?|v)\s+(.+?)(?:\s+Moneyline|\s+Winner|\?|$)/i);
  const slugParts = slug.split("-");
  const fallbackHome = slugParts[1] === "qat" ? "Qatar" : undefined;
  const fallbackAway = slugParts[2] === "che" ? "Switzerland" : undefined;
  const homeTeam = cleanTeamName(vsMatch?.[1] ?? fallbackHome ?? "Qatar");
  const awayTeam = cleanTeamName(vsMatch?.[2] ?? fallbackAway ?? "Switzerland");
  const homeSeed = findSeedTeamByName(homeTeam) ?? findSeedTeamInText(homeTeam);
  const awaySeed = findSeedTeamByName(awayTeam) ?? findSeedTeamInText(awayTeam);
  return {
    homeTeam: homeSeed?.name ?? homeTeam,
    awayTeam: awaySeed?.name ?? awayTeam,
    homeTeamSlug: homeSeed?.slug ?? teamSlugFromName(homeTeam),
    awayTeamSlug: awaySeed?.slug ?? teamSlugFromName(awayTeam)
  };
}

function parseMoneylineProbabilities(
  outcomes: string[],
  prices: Array<number | undefined>,
  teams: { homeTeam: string; awayTeam: string; homeTeamSlug?: string; awayTeamSlug?: string }
) {
  const byOutcome = new Map<string, number>();
  outcomes.forEach((outcome, index) => {
    const price = prices[index];
    if (price !== undefined && price > 0 && price < 1) byOutcome.set(outcome.toLowerCase(), price);
  });
  return {
    home: findOutcomePrice(byOutcome, outcomeAliases(teams.homeTeam, teams.homeTeamSlug, ["home"])),
    draw: findOutcomePrice(byOutcome, ["draw", "tie"]),
    away: findOutcomePrice(byOutcome, outcomeAliases(teams.awayTeam, teams.awayTeamSlug, ["away"]))
  };
}

function outcomeAliases(teamName: string, teamSlug: string | null | undefined, fallbacks: string[]) {
  const codes = teamSlug ? MARKET_SLUG_CODES[teamSlug] ?? [] : [];
  const aliases = teamSlug ? MARKET_TEXT_ALIASES[teamSlug] ?? [] : [];
  return [teamName, ...aliases, ...codes, ...codes.map((code) => code.toUpperCase()), ...fallbacks];
}

function findOutcomePrice(outcomes: Map<string, number>, candidates: string[]) {
  for (const [name, price] of outcomes.entries()) {
    if (candidates.some((candidate) => name.includes(candidate.toLowerCase()))) return price;
  }
  return undefined;
}

function hasMoneylinePrices(probabilities: { home?: number; draw?: number; away?: number }) {
  return probabilities.home !== undefined &&
    probabilities.draw !== undefined &&
    probabilities.away !== undefined;
}

function textLooksLikeFixture(source: GammaRow, expected: UpcomingMatch) {
  const text = foldText([
    source.question,
    source.title,
    source.eventTitle,
    source.slug,
    source.eventSlug
  ].map((value) => String(value ?? "")).join(" "));
  const home = foldText(expected.homeTeam);
  const away = foldText(expected.awayTeam);
  const homeSlug = expected.homeTeamSlug ?? teamSlugFromName(expected.homeTeam);
  const awaySlug = expected.awayTeamSlug ?? teamSlugFromName(expected.awayTeam);
  const homeCodes = MARKET_SLUG_CODES[homeSlug] ?? [homeSlug.slice(0, 3)];
  const awayCodes = MARKET_SLUG_CODES[awaySlug] ?? [awaySlug.slice(0, 3)];
  const homeAliases = [home, ...(MARKET_TEXT_ALIASES[homeSlug] ?? []).map(foldText), ...homeCodes.map(foldText)];
  const awayAliases = [away, ...(MARKET_TEXT_ALIASES[awaySlug] ?? []).map(foldText), ...awayCodes.map(foldText)];
  const hasHome = homeAliases.some((alias) => text.includes(alias));
  const hasAway = awayAliases.some((alias) => text.includes(alias));
  return hasHome && hasAway;
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

function buildCodeToTeamSlugMap() {
  const byCode: Record<string, string> = {};
  for (const [teamSlug, codes] of Object.entries(MARKET_SLUG_CODES)) {
    for (const code of codes) {
      byCode[code.toLowerCase()] = teamSlug;
    }
  }
  return byCode;
}

function titleizeSlug(slug: string) {
  return slug
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function foldText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[’‘]/g, "'")
    .toLowerCase();
}

function parseNumber(value: unknown) {
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) ? number : undefined;
}

function parseDate(value: unknown) {
  if (typeof value !== "string" && typeof value !== "number") return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function normalizeDate(value: Date | string | null | undefined) {
  if (!value) return undefined;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function cleanTeamName(value: string) {
  return value
    .replace(/\bMoneyline\b/gi, "")
    .replace(/\bWinner\b/gi, "")
    .replace(/\?+$/g, "")
    .trim();
}

function clampMatchAdjustment(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.min(0.08, Math.max(-0.08, value));
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

function parsePositiveInteger(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function matchResearchContext(match: UpcomingMatch) {
  return {
    homeTeam: match.homeTeam,
    awayTeam: match.awayTeam,
    startTimeBeijing: formatMatchDateForQuery(match.startTime),
    polymarket: {
      home: match.homeProbability,
      draw: match.drawProbability,
      away: match.awayProbability,
      sourceUrl: match.marketSourceUrl
    },
    cupedgeFair: {
      home: match.fairHomeProbability,
      draw: match.fairDrawProbability,
      away: match.fairAwayProbability
    }
  };
}

function searchResultForPrompt(result: TavilySearchResult) {
  return {
    title: result.title,
    url: result.url,
    content: result.content,
    publishedDate: result.published_date
  };
}

function formatMatchDateForQuery(value: Date | string | null | undefined) {
  const date = normalizeDate(value);
  if (!date) return "upcoming";
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}

function getDeepSeekBase() {
  return (process.env.DEEPSEEK_API_BASE || "https://api.deepseek.com").replace(/\/$/, "");
}

function getGeminiBase() {
  return normalizeOpenAiCompatibleBase(
    process.env.GEMINI_API_BASE ||
      process.env.LLM_SUMMARY_API_BASE ||
      "https://platform.powermatrix.tech"
  );
}

function normalizeOpenAiCompatibleBase(value: string) {
  const trimmed = value.replace(/\/$/, "");
  try {
    const url = new URL(trimmed);
    if (!url.pathname || url.pathname === "/") {
      url.pathname = "/v1";
      return url.toString().replace(/\/$/, "");
    }
    return trimmed;
  } catch {
    return trimmed;
  }
}

function safeParseObject(content: string): Record<string, unknown> {
  if (!content) return {};
  try {
    const parsed = JSON.parse(content);
    return typeof parsed === "object" && parsed !== null ? parsed as Record<string, unknown> : {};
  } catch {
    const match = content.match(/\{[\s\S]*\}/);
    if (!match) return {};
    try {
      const parsed = JSON.parse(match[0]);
      return typeof parsed === "object" && parsed !== null ? parsed as Record<string, unknown> : {};
    } catch {
      return {};
    }
  }
}

function stringifySources(value: unknown) {
  if (!Array.isArray(value)) return undefined;
  const sources = value
    .filter((source): source is string => typeof source === "string")
    .slice(0, 5);
  return sources.length ? sources.join("\n") : undefined;
}

function getMatchLlmMaxAdjustment() {
  const value = Number(process.env.UPCOMING_MATCH_LLM_ADJUSTMENT_MAX_ABS ?? process.env.LLM_ADJUSTMENT_MAX_ABS ?? "0.03");
  return Number.isFinite(value) && value > 0 ? value : 0.03;
}

function boundMatchLlmAdjustment(value: number) {
  if (!Number.isFinite(value)) return 0;
  const max = getMatchLlmMaxAdjustment();
  return Math.min(max, Math.max(-max, value));
}
