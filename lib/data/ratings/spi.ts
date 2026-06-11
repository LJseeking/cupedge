import { fetchTextWithFallback } from "@/lib/data/http";
import { normalizeRatingRecords } from "@/lib/data/ratings/normalize";
import { parseCsv } from "@/lib/data/ratings/parse";
import type { TeamRatingInput } from "@/lib/types/ratings";

const DEFAULT_SPI_URL =
  "https://projects.fivethirtyeight.com/soccer-api/international/spi_global_rankings_intl.csv";

type RawRating = {
  name: string;
  rating: number;
  rawJson?: unknown;
};

export async function fetchSpiRatings(): Promise<TeamRatingInput[]> {
  const url = process.env.SPI_RATINGS_URL || DEFAULT_SPI_URL;
  const text = await fetchTextWithFallback(url, 12_000);
  if (!text) return [];
  const rows = parseCsv(text);
  const rawRatings: RawRating[] = [];
  for (const row of rows) {
    const name = firstValue(row, ["name", "team", "country", "nation"]);
    const rating = parseNumber(firstValue(row, ["spi", "rating", "globalrating"]));
    if (name && rating) rawRatings.push({ name, rating, rawJson: row });
  }

  return normalizeRatingRecords(rawRatings, "SPI", spiNormalize);
}

function spiNormalize(rating: number) {
  return Math.min(1, Math.max(0, rating / 100));
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
