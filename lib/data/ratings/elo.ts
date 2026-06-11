import { fetchTextWithFallback } from "@/lib/data/http";
import { QUALIFIED_TEAMS, getQualifiedTeamAliases } from "@/lib/data/qualified-teams";
import { normalizeNameForRating, normalizeRatingRecords } from "@/lib/data/ratings/normalize";
import { parseCsv, stripTags } from "@/lib/data/ratings/parse";
import type { TeamRatingInput } from "@/lib/types/ratings";

const DEFAULT_ELO_URLS = [
  "https://www.eloratings.net/"
];

type RawRating = {
  name: string;
  rating: number;
  rawJson?: unknown;
};

export async function fetchEloRatings(): Promise<TeamRatingInput[]> {
  const urls = [
    ...(process.env.ELO_RATINGS_URL ? [process.env.ELO_RATINGS_URL] : []),
    ...buildInternationalFootballTableUrls(),
    ...DEFAULT_ELO_URLS
  ].filter((url, index, all) => all.indexOf(url) === index);

  let best: TeamRatingInput[] = [];
  for (const url of urls) {
    const text = await fetchTextWithFallback(url, 12_000);
    if (!text) continue;

    const rawRatings = url.toLowerCase().endsWith(".csv")
      ? parseEloCsv(text)
      : parseEloHtml(text);
    const normalized = normalizeRatingRecords(rawRatings, "ELO", eloNormalize);
    if (process.env.CUPEDGE_RATINGS_DEBUG === "1") {
      console.log(`[CupEdge] ELO probe ${url}: raw=${rawRatings.length}, matched=${normalized.length}`);
    }
    if (normalized.length > best.length) {
      best = normalized;
    }
    if (best.length >= QUALIFIED_TEAMS.length) return best;
  }

  return best;
}

function buildInternationalFootballTableUrls() {
  const urls: string[] = [];
  const today = new Date();
  for (let offset = 0; offset < 14; offset += 1) {
    const date = new Date(today);
    date.setDate(today.getDate() - offset);
    const day = String(date.getDate()).padStart(2, "0");
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const year = String(date.getFullYear());
    urls.push(`https://www.international-football.net/elo-ratings-table?day=${day}&month=${month}&year=${year}`);
  }
  urls.push("https://www.international-football.net/");
  return urls;
}

function parseEloCsv(text: string): RawRating[] {
  const ratings: RawRating[] = [];
  for (const row of parseCsv(text)) {
    const name = firstValue(row, ["country", "team", "name", "nation"]);
    const rating = parseNumber(firstValue(row, ["elo", "rating", "rank", "points"]));
    if (name && rating) ratings.push({ name, rating, rawJson: row });
  }
  return ratings;
}

function parseEloHtml(html: string): RawRating[] {
  const compact = stripTags(html);
  const records: RawRating[] = [];
  for (const team of QUALIFIED_TEAMS) {
    const names = getQualifiedTeamAliases(team.slug).map(normalizeNameForRating);
    const rating = findTeamRating(compact, names);
    if (rating) records.push({ name: team.name, rating, rawJson: { source: "html_match" } });
  }
  return records;
}

function findTeamRating(text: string, normalizedAliases: string[]) {
  for (const alias of normalizedAliases) {
    const escaped = escapeRegExp(alias);
    const patterns = [
      new RegExp(`(?:^|\\s)${escaped}\\s+(\\d{3,4})(?:\\D|$)`, "i"),
      new RegExp(`(?:^|\\s)(\\d{1,3})\\.?\\s+${escaped}\\s+(\\d{3,4})(?:\\D|$)`, "i"),
      new RegExp(`(?:^|\\s)${escaped}\\s+\\w*\\s*(\\d{3,4})(?:\\D|$)`, "i")
    ];
    for (const pattern of patterns) {
      const match = text.match(pattern);
      const rating = parseNumber(match?.[2] ?? match?.[1]);
      if (rating && rating >= 800 && rating <= 2400) return rating;
    }
  }
  return undefined;
}

function eloNormalize(rating: number) {
  return clamp((rating - 1200) / 900);
}

function firstValue(row: Record<string, string>, keys: string[]) {
  const entries = Object.entries(row);
  for (const key of keys) {
    const found = entries.find(([header]) => header.toLowerCase().replace(/[^a-z]/g, "") === key);
    if (found?.[1]) return found[1];
  }
  return "";
}

function parseNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string") return undefined;
  const parsed = Number(value.replace(/,/g, ""));
  return Number.isFinite(parsed) ? parsed : undefined;
}

function clamp(value: number) {
  return Math.min(1, Math.max(0, value));
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
