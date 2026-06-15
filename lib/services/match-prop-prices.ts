import type { MatchPropMarketPrice, UpcomingMatch } from "@/lib/types/research";
import { clampProbability } from "@/lib/utils";

type GammaRow = Record<string, unknown>;

const POLYMARKET_BASE = "https://gamma-api.polymarket.com";
const PROP_PRICE_TIMEOUT_MS = Number(process.env.UPCOMING_MATCH_PROP_PRICE_TIMEOUT_MS ?? "2500");
const TEAM_CODES: Record<string, string[]> = {
  "spain": ["esp", "spa"],
  "cape-verde": ["cvi", "cve", "cpv", "cv"],
  "cabo-verde": ["cvi", "cve", "cpv", "cv"],
  "germany": ["ger", "deu"],
  "curacao": ["cur", "cuw", "kor"],
  "netherlands": ["ned", "nld"],
  "ivory-coast": ["civ"],
  "united-states": ["usa"],
  "south-korea": ["kor"],
  "morocco": ["mar"],
  "brazil": ["bra"],
  "argentina": ["arg"],
  "france": ["fra"],
  "portugal": ["por", "prt"],
  "england": ["eng"],
  "japan": ["jpn"],
  "uruguay": ["uru", "ury"]
};

export async function getPolymarketPropPrices(match: UpcomingMatch): Promise<MatchPropMarketPrice[]> {
  const overridePrices = getOverridePropPrices(match);
  if (overridePrices.length) return overridePrices;

  const slug = polymarketEventSlug(match);
  if (!slug) return [];

  const [gammaPrices, pagePrices] = await Promise.allSettled([
    fetchGammaPropPrices(slug, match),
    fetchSportsPagePropPrices(slug, match)
  ]);

  return dedupePropPrices([
    ...(gammaPrices.status === "fulfilled" ? gammaPrices.value : []),
    ...(pagePrices.status === "fulfilled" ? pagePrices.value : [])
  ]);
}

function getOverridePropPrices(match: UpcomingMatch) {
  const raw = process.env.UPCOMING_MATCH_PROP_PRICE_OVERRIDES;
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const slug = polymarketEventSlug(match);
    const override = parsed.find((item) => {
      if (!item || typeof item !== "object") return false;
      const row = item as Record<string, unknown>;
      if (slug && typeof row.slug === "string" && row.slug === slug) return true;
      const homeTeam = typeof row.homeTeam === "string" ? foldText(row.homeTeam) : "";
      const awayTeam = typeof row.awayTeam === "string" ? foldText(row.awayTeam) : "";
      return homeTeam === foldText(match.homeTeam) && awayTeam === foldText(match.awayTeam);
    }) as { prices?: unknown[]; sourceUrl?: string } | undefined;
    if (!override || !Array.isArray(override.prices)) return [];
    const prices: MatchPropMarketPrice[] = [];
    for (const item of override.prices) {
      if (!item || typeof item !== "object") continue;
      const row = item as Record<string, unknown>;
      const key = typeof row.key === "string" ? row.key : "";
      const label = typeof row.label === "string" ? row.label : key;
      const marketProbability = validProbability(parseNumber(row.marketProbability));
      if (!key || marketProbability === undefined) continue;
      prices.push({
        key,
        label,
        marketProbability,
        provider: "POLYMARKET",
        sourceUrl: typeof row.sourceUrl === "string" ? row.sourceUrl : override.sourceUrl ?? null
      });
    }
    return prices;
  } catch {
    return [];
  }
}

async function fetchGammaPropPrices(slug: string, match: UpcomingMatch) {
  const base = (process.env.POLYMARKET_API_BASE || POLYMARKET_BASE).replace(/\/$/, "");
  const data = await fetchJson<unknown>(`${base}/events?slug=${encodeURIComponent(slug)}`, PROP_PRICE_TIMEOUT_MS);
  const event = Array.isArray(data) ? data[0] : data;
  if (!event || typeof event !== "object") return [];
  const eventRow = event as GammaRow;
  const markets = flattenGammaMarkets([eventRow]);
  const prices: MatchPropMarketPrice[] = [];
  const sourceUrl = `https://polymarket.com/sports/world-cup/${slug}`;

  for (const market of markets) {
    prices.push(...parseTotalMarket(market, sourceUrl));
    prices.push(...parseSpreadMarket(market, match, sourceUrl));
  }

  return prices;
}

async function fetchSportsPagePropPrices(slug: string, match: UpcomingMatch) {
  const urls = [
    `https://polymarket.com/zh/sports/world-cup/${slug}`,
    `https://polymarket.com/sports/world-cup/${slug}`
  ];
  const prices: MatchPropMarketPrice[] = [];
  for (const sourceUrl of urls) {
    const html = await fetchText(sourceUrl, PROP_PRICE_TIMEOUT_MS);
    if (!html) continue;
    const text = htmlToText(html);
    prices.push(
      ...parseTotalPricesFromText(text, sourceUrl),
      ...parseSpreadPricesFromText(text, match, sourceUrl)
    );
  }
  return dedupePropPrices(prices);
}

function parseTotalMarket(market: GammaRow, sourceUrl: string): MatchPropMarketPrice[] {
  const title = marketText(market);
  if (!/(total|goals|over\/under|over under|o\/u)/i.test(title)) return [];

  const line = parseLine(title);
  if (line === undefined) return [];

  const outcomes = parseMaybeJsonArray(market.outcomes).map(String);
  const outcomePrices = parseMaybeJsonArray(market.outcomePrices).map(parseNumber);
  if (!outcomes.length || outcomes.length !== outcomePrices.length) return [];

  const prices: MatchPropMarketPrice[] = [];
  outcomes.forEach((outcome, index) => {
    const price = validProbability(outcomePrices[index]);
    if (price === undefined) return;
    if (/\bo(?:ver)?\b/i.test(outcome)) {
      prices.push(propPrice(`total-over-${line}`, `Over ${line}`, price, sourceUrl));
    }
    if (/\bu(?:nder)?\b/i.test(outcome)) {
      prices.push(propPrice(`total-under-${line}`, `Under ${line}`, price, sourceUrl));
    }
    if (/^yes$/i.test(outcome) && /\bover\b/i.test(title)) {
      prices.push(propPrice(`total-over-${line}`, `Over ${line}`, price, sourceUrl));
    }
    if (/^yes$/i.test(outcome) && /\bunder\b/i.test(title)) {
      prices.push(propPrice(`total-under-${line}`, `Under ${line}`, price, sourceUrl));
    }
  });

  return prices;
}

function parseSpreadMarket(market: GammaRow, match: UpcomingMatch, sourceUrl: string): MatchPropMarketPrice[] {
  const title = marketText(market);
  if (!/(spread|handicap|line|[-+]\s*\d+(?:\.5)?)/i.test(title)) return [];

  const outcomes = parseMaybeJsonArray(market.outcomes).map(String);
  const outcomePrices = parseMaybeJsonArray(market.outcomePrices).map(parseNumber);
  if (!outcomes.length || outcomes.length !== outcomePrices.length) return [];

  const prices: MatchPropMarketPrice[] = [];
  outcomes.forEach((outcome, index) => {
    const price = validProbability(outcomePrices[index]);
    if (price === undefined) return;
    const side = teamSideFromText(`${title} ${outcome}`, match);
    const line = parseSignedLine(`${outcome} ${title}`);
    if (!side || line === undefined) return;
    prices.push(propPrice(`spread-${side}-${Math.abs(line)}`, `${side === "home" ? match.homeTeam : match.awayTeam} ${formatSignedLine(line)}`, price, sourceUrl));
  });

  if (!prices.length) {
    const side = teamSideFromText(title, match);
    const line = parseSignedLine(title);
    const yesPrice = yesOutcomePrice(outcomes, outcomePrices);
    if (side && line !== undefined && yesPrice !== undefined) {
      prices.push(propPrice(`spread-${side}-${Math.abs(line)}`, `${side === "home" ? match.homeTeam : match.awayTeam} ${formatSignedLine(line)}`, yesPrice, sourceUrl));
    }
  }

  return prices;
}

function parseTotalPricesFromText(text: string, sourceUrl: string): MatchPropMarketPrice[] {
  const prices: MatchPropMarketPrice[] = [];
  const pattern = /\b([OU])\s*(\d+\.5)\s+(\d+(?:\.\d+)?)\s*(?:¢|c|%)/gi;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(text))) {
    const side = match[1].toUpperCase();
    const line = Number(match[2]);
    const price = parsePercentLike(match[3]);
    if (price === undefined) continue;
    prices.push(propPrice(`total-${side === "O" ? "over" : "under"}-${line}`, `${side === "O" ? "Over" : "Under"} ${line}`, price, sourceUrl));
  }
  return prices;
}

function parseSpreadPricesFromText(text: string, match: UpcomingMatch, sourceUrl: string): MatchPropMarketPrice[] {
  const prices: MatchPropMarketPrice[] = [];
  const teamPattern = teamAliasPattern(match);
  const pattern = new RegExp(`\\b(${teamPattern})\\s*([+-]\\s*\\d+(?:\\.5)?)\\s+(\\d+(?:\\.\\d+)?)\\s*(?:¢|c|%)`, "gi");
  let item: RegExpExecArray | null;
  while ((item = pattern.exec(text))) {
    const side = teamSideFromText(item[1], match);
    const signedLine = Number(item[2].replace(/\s+/g, ""));
    const price = parsePercentLike(item[3]);
    if (!side || price === undefined || !Number.isFinite(signedLine)) continue;
    prices.push(propPrice(`spread-${side}-${Math.abs(signedLine)}`, `${side === "home" ? match.homeTeam : match.awayTeam} ${formatSignedLine(signedLine)}`, price, sourceUrl));
  }
  return prices;
}

function flattenGammaMarkets(rows: GammaRow[]) {
  const flattened: GammaRow[] = [];
  for (const row of rows) {
    const nestedMarkets = parseMaybeJsonArray(row.markets);
    if (nestedMarkets.length) {
      for (const market of nestedMarkets) {
        if (typeof market === "object" && market !== null) {
          flattened.push({
            ...(market as GammaRow),
            eventSlug: row.slug,
            eventTitle: row.title ?? row.question
          });
        }
      }
      continue;
    }
    flattened.push(row);
  }
  return flattened;
}

function polymarketEventSlug(match: UpcomingMatch) {
  const source = match.marketSourceUrl ?? match.marketSlug ?? "";
  const sportsMatch = source.match(/\/sports\/world-cup\/([^/?#]+)/i);
  if (sportsMatch) return sportsMatch[1];
  const eventMatch = source.match(/\/event\/([^/?#]+)/i);
  if (eventMatch) return eventMatch[1];
  const slug = match.marketSlug ?? "";
  if (/^fifwc-/i.test(slug)) return slug;
  return "";
}

function marketText(market: GammaRow) {
  return [
    market.question,
    market.title,
    market.groupItemTitle,
    market.description,
    market.slug,
    market.eventTitle
  ].map((value) => String(value ?? "")).join(" ");
}

function parseLine(text: string) {
  const matched = text.match(/\b(\d+(?:\.5)?)\b/);
  const line = Number(matched?.[1]);
  return Number.isFinite(line) ? line : undefined;
}

function parseSignedLine(text: string) {
  const matched = text.match(/([+-])\s*(\d+(?:\.5)?)/);
  if (!matched) return undefined;
  const value = Number(matched[2]);
  if (!Number.isFinite(value)) return undefined;
  return matched[1] === "-" ? -value : value;
}

function teamSideFromText(text: string, match: UpcomingMatch): "home" | "away" | null {
  const folded = foldText(text);
  if (teamAliases(match.homeTeam, match.homeTeamSlug).some((alias) => folded.includes(alias))) return "home";
  if (teamAliases(match.awayTeam, match.awayTeamSlug).some((alias) => folded.includes(alias))) return "away";
  return null;
}

function teamAliases(team: string, slug?: string | null) {
  const normalizedSlug = slug ?? "";
  const parts = [
    team,
    normalizedSlug,
    ...normalizedSlug.split("-"),
    ...(TEAM_CODES[normalizedSlug] ?? []),
    ...(TEAM_CODES[foldText(team).replace(/\s+/g, "-")] ?? [])
  ];
  return parts
    .map((part) => foldText(part))
    .filter((part) => part.length >= 2);
}

function teamAliasPattern(match: UpcomingMatch) {
  const aliases = [
    ...teamAliases(match.homeTeam, match.homeTeamSlug),
    ...teamAliases(match.awayTeam, match.awayTeamSlug),
    shortCode(match.homeTeam),
    shortCode(match.awayTeam)
  ].filter(Boolean);
  return [...new Set(aliases)].map(escapeRegex).join("|");
}

function shortCode(team: string) {
  return foldText(team).split(/\s+/).map((part) => part[0]).join("").slice(0, 4);
}

function yesOutcomePrice(outcomes: string[], prices: Array<number | undefined>) {
  const yesIndex = outcomes.findIndex((outcome) => /^yes$/i.test(outcome));
  return validProbability(prices[yesIndex]);
}

function propPrice(key: string, label: string, marketProbability: number, sourceUrl: string): MatchPropMarketPrice {
  return {
    key,
    label,
    marketProbability,
    provider: "POLYMARKET",
    sourceUrl
  };
}

function dedupePropPrices(prices: MatchPropMarketPrice[]) {
  const byKey = new Map<string, MatchPropMarketPrice>();
  for (const price of prices) {
    if (!byKey.has(price.key)) byKey.set(price.key, price);
  }
  return [...byKey.values()].sort((a, b) => a.key.localeCompare(b.key));
}

async function fetchJson<T>(url: string, timeoutMs: number): Promise<T | null> {
  try {
    const response = await fetch(url, {
      next: { revalidate: 0 },
      signal: AbortSignal.timeout(timeoutMs)
    });
    if (!response.ok) return null;
    return await response.json() as T;
  } catch {
    return null;
  }
}

async function fetchText(url: string, timeoutMs: number) {
  try {
    const response = await fetch(url, {
      next: { revalidate: 0 },
      signal: AbortSignal.timeout(timeoutMs)
    });
    if (!response.ok) return "";
    return await response.text();
  } catch {
    return "";
  }
}

function htmlToText(html: string) {
  return decodeHtmlEntities(html)
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function decodeHtmlEntities(value: string) {
  return value
    .replace(/&quot;/g, "\"")
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
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

function validProbability(value: number | undefined) {
  if (value === undefined || value <= 0 || value >= 1) return undefined;
  return clampProbability(value);
}

function parsePercentLike(value: string | undefined) {
  if (!value) return undefined;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return undefined;
  return clampProbability(parsed > 1 ? parsed / 100 : parsed);
}

function formatSignedLine(value: number) {
  return `${value > 0 ? "+" : ""}${value}`;
}

function foldText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[’‘]/g, "'")
    .toLowerCase();
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
