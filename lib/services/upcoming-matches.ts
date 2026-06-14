import { fetchJsonWithFallback } from "@/lib/data/http";
import { findSeedTeamByName, findSeedTeamInText, teamSlugFromName } from "@/lib/data/teams";
import { prisma } from "@/lib/db/prisma";
import { getCurrentValuations } from "@/lib/services/valuation";
import type { UpcomingMatch } from "@/lib/types/research";
import { clampProbability } from "@/lib/utils";

type GammaRow = Record<string, unknown>;
type CctvGame = {
  id?: number | string;
  gameName?: string;
  roundType?: string;
  startTime?: string;
  gameStatus?: number;
  statusDesc?: string;
  homeName?: string;
  guestName?: string;
};

const DEFAULT_UPCOMING_MATCH_LIMIT = 3;
const POLYMARKET_BASE = "https://gamma-api.polymarket.com";
const CCTV_SCHEDULE_BASE = "https://cbs-u.sports.cctv.com/pc";
const CCTV_SCHEDULE_PAGE = "https://worldcup.cctv.com/2026/schedule/index.shtml";
const CCTV_TEAM_NAME_MAP: Record<string, string> = {
  "墨西哥": "Mexico",
  "南非": "South Africa",
  "韩国": "South Korea",
  "捷克": "Czechia",
  "加拿大": "Canada",
  "波黑": "Bosnia and Herzegovina",
  "卡塔尔": "Qatar",
  "瑞士": "Switzerland",
  "巴西": "Brazil",
  "摩洛哥": "Morocco",
  "海地": "Haiti",
  "苏格兰": "Scotland",
  "美国": "United States",
  "巴拉圭": "Paraguay",
  "澳大利亚": "Australia",
  "土耳其": "Turkey",
  "德国": "Germany",
  "库拉索": "Curacao",
  "科特迪瓦": "Ivory Coast",
  "厄瓜多尔": "Ecuador",
  "荷兰": "Netherlands",
  "日本": "Japan",
  "瑞典": "Sweden",
  "突尼斯": "Tunisia",
  "比利时": "Belgium",
  "埃及": "Egypt",
  "伊朗": "Iran",
  "新西兰": "New Zealand",
  "西班牙": "Spain",
  "佛得角": "Cape Verde",
  "沙特阿拉伯": "Saudi Arabia",
  "乌拉圭": "Uruguay",
  "法国": "France",
  "塞内加尔": "Senegal",
  "伊拉克": "Iraq",
  "挪威": "Norway",
  "阿根廷": "Argentina",
  "阿尔及利亚": "Algeria",
  "奥地利": "Austria",
  "约旦": "Jordan",
  "葡萄牙": "Portugal",
  "刚果民主共和国": "DR Congo",
  "乌兹别克斯坦": "Uzbekistan",
  "哥伦比亚": "Colombia",
  "英格兰": "England",
  "克罗地亚": "Croatia",
  "加纳": "Ghana",
  "巴拿马": "Panama"
};

export async function refreshUpcomingMatches() {
  const limit = parsePositiveInteger(process.env.UPCOMING_MATCH_LIMIT, DEFAULT_UPCOMING_MATCH_LIMIT);
  const officialMatches = await fetchUpcomingMatchesFromCctv(limit);
  const polymarketMatches = await fetchUpcomingMatchesFromPolymarket();
  const matches = officialMatches.map((match) => mergePolymarketMatch(match, polymarketMatches));
  const valuations = await getCurrentValuations();
  const valuationBySlug = new Map(valuations.map((valuation) => [valuation.slug, valuation]));
  const enriched = matches.map((match) => enrichMatchFairProbabilities(match, valuationBySlug));

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

  if (!rows.length) {
    const valuations = await getCurrentValuations();
    const valuationBySlug = new Map(valuations.map((valuation) => [valuation.slug, valuation]));
    const officialMatches = await fetchUpcomingMatchesFromCctv(limit);
    if (officialMatches.length) {
      return officialMatches.map((match) => enrichMatchFairProbabilities(match, valuationBySlug));
    }
  }

  return rows.map((row) => ({
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
  }));
}

async function fetchUpcomingMatchesFromCctv(limit: number): Promise<UpcomingMatch[]> {
  const base = (process.env.CCTV_SCHEDULE_API_BASE || CCTV_SCHEDULE_BASE).replace(/\/$/, "");
  const season = process.env.WORLD_CUP_SEASON || "2026";
  const leagueId = process.env.WORLD_CUP_LEAGUE_ID || "3400";
  const url = `${base}/game/season_game_list?leagueId=${encodeURIComponent(leagueId)}&season=${encodeURIComponent(season)}&client=pc`;

  try {
    const data = await fetchJsonWithFallback<unknown>(url, 15_000);
    const now = new Date();
    return extractCctvGames(data)
      .map(cctvGameToUpcomingMatch)
      .filter((match): match is UpcomingMatch => Boolean(match))
      .filter((match) => {
        const startTime = normalizeDate(match.startTime);
        return Boolean(startTime && startTime >= now);
      })
      .sort((a, b) => (normalizeDate(a.startTime)?.getTime() ?? 0) - (normalizeDate(b.startTime)?.getTime() ?? 0))
      .slice(0, limit);
  } catch (error) {
    console.warn("CCTV upcoming match schedule request failed.", error);
    return [];
  }
}

async function fetchUpcomingMatchesFromPolymarket(): Promise<UpcomingMatch[]> {
  const base = (process.env.POLYMARKET_API_BASE || POLYMARKET_BASE).replace(/\/$/, "");
  const slugs = parseList(process.env.UPCOMING_MATCH_SLUGS);
  const matchSlugs = slugs.length ? slugs : [];
  const matches: UpcomingMatch[] = [];

  for (const slug of matchSlugs) {
    const rows = await fetchGammaRows(`${base}/events?slug=${encodeURIComponent(slug)}`);
    const parsed = parseMatchFromGamma(slug, rows);
    if (parsed) matches.push(parsed);
  }

  return matches;
}

function extractCctvGames(data: unknown): CctvGame[] {
  if (typeof data !== "object" || data === null) return [];
  const payload = data as Record<string, unknown>;
  if (Array.isArray(payload.results)) return payload.results as CctvGame[];
  if (Array.isArray(payload.data)) return payload.data as CctvGame[];
  const nested = payload.data && typeof payload.data === "object" ? payload.data as Record<string, unknown> : {};
  if (Array.isArray(nested.results)) return nested.results as CctvGame[];
  if (Array.isArray(nested.list)) return nested.list as CctvGame[];
  return [];
}

function cctvGameToUpcomingMatch(game: CctvGame): UpcomingMatch | null {
  const homeTeam = canonicalCctvTeamName(game.homeName);
  const awayTeam = canonicalCctvTeamName(game.guestName);
  const startTime = parseCctvDate(game.startTime);
  if (!homeTeam || !awayTeam || !startTime) return null;

  const homeSeed = findSeedTeamByName(homeTeam) ?? findSeedTeamInText(homeTeam);
  const awaySeed = findSeedTeamByName(awayTeam) ?? findSeedTeamInText(awayTeam);
  const matchSlug = `cctv-${game.id ?? `${teamSlugFromName(homeTeam)}-${teamSlugFromName(awayTeam)}-${startTime.toISOString().slice(0, 10)}`}`;
  const round = game.roundType ? ` / ${game.roundType}` : "";

  return {
    matchSlug,
    marketSlug: null,
    marketTitle: `${homeSeed?.name ?? homeTeam} vs ${awaySeed?.name ?? awayTeam}${round}`,
    homeTeam: homeSeed?.name ?? homeTeam,
    awayTeam: awaySeed?.name ?? awayTeam,
    homeTeamSlug: homeSeed?.slug ?? teamSlugFromName(homeTeam),
    awayTeamSlug: awaySeed?.slug ?? teamSlugFromName(awayTeam),
    startTime,
    llmAdjustment: 0,
    marketSourceUrl: CCTV_SCHEDULE_PAGE,
    updatedAt: new Date()
  };
}

function canonicalCctvTeamName(value: unknown) {
  if (typeof value !== "string") return "";
  const trimmed = value.trim();
  return CCTV_TEAM_NAME_MAP[trimmed] ?? trimmed;
}

function parseCctvDate(value: unknown) {
  if (typeof value !== "string") return undefined;
  const normalized = value.trim().replace(" ", "T");
  const date = new Date(`${normalized}+08:00`);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function mergePolymarketMatch(official: UpcomingMatch, polymarketMatches: UpcomingMatch[]) {
  const polymarket = polymarketMatches.find((match) =>
    match.homeTeamSlug === official.homeTeamSlug &&
    match.awayTeamSlug === official.awayTeamSlug
  );
  if (!polymarket) return official;

  return {
    ...official,
    marketSlug: polymarket.marketSlug,
    homeProbability: polymarket.homeProbability,
    drawProbability: polymarket.drawProbability,
    awayProbability: polymarket.awayProbability,
    marketSourceUrl: polymarket.marketSourceUrl ?? official.marketSourceUrl
  };
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

function parseMatchFromGamma(matchSlug: string, rows: GammaRow[]): UpcomingMatch | null {
  const row = rows[0];
  if (!row) return null;
  const market = parseMaybeJsonArray(row.markets).find((item) => typeof item === "object" && item !== null) as GammaRow | undefined;
  const source = market ?? row;
  const title = String(source.question ?? source.title ?? row.title ?? row.question ?? matchSlug);
  const teams = parseTeamsFromTitle(title, matchSlug);
  if (!teams) return null;
  const outcomes = parseMaybeJsonArray(source.outcomes).map(String);
  const prices = parseMaybeJsonArray(source.outcomePrices).map(parseNumber);
  const probabilities = parseMoneylineProbabilities(outcomes, prices, teams);
  const startTime = parseDate(source.startDate ?? row.startDate ?? source.endDate ?? row.endDate);

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
    marketSourceUrl: `https://polymarket.com/zh/sports/world-cup/${matchSlug}`,
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
  teams: { homeTeam: string; awayTeam: string }
) {
  const byOutcome = new Map<string, number>();
  outcomes.forEach((outcome, index) => {
    const price = prices[index];
    if (price !== undefined && price > 0 && price < 1) byOutcome.set(outcome.toLowerCase(), price);
  });
  return {
    home: findOutcomePrice(byOutcome, [teams.homeTeam, "home"]),
    draw: findOutcomePrice(byOutcome, ["draw", "tie"]),
    away: findOutcomePrice(byOutcome, [teams.awayTeam, "away"])
  };
}

function findOutcomePrice(outcomes: Map<string, number>, candidates: string[]) {
  for (const [name, price] of outcomes.entries()) {
    if (candidates.some((candidate) => name.includes(candidate.toLowerCase()))) return price;
  }
  return undefined;
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

function parseList(value: string | undefined) {
  return (value ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function parsePositiveInteger(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}
