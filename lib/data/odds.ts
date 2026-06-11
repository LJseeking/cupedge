import { MOCK_BOOKMAKER_TARGETS, SEEDED_TEAMS } from "@/lib/data/seed";
import { teamSlugFromName } from "@/lib/data/teams";
import type {
  BookmakerOddRecord,
  BookmakerTeamProbability
} from "@/lib/types/valuation";

const ODDS_API_BASE = "https://api.the-odds-api.com/v4";
const ODDS_SPORT_KEY = "soccer_fifa_world_cup_winner";

type OddsSport = {
  key?: string;
  group?: string;
  title?: string;
  description?: string;
  active?: boolean;
  has_outrights?: boolean;
};

type OddsEvent = {
  bookmakers?: Array<{
    key?: string;
    title?: string;
    markets?: Array<{
      key?: string;
      outcomes?: Array<{
        name?: string;
        price?: number;
      }>;
    }>;
  }>;
};

export async function getWorldCupWinnerOdds(): Promise<BookmakerTeamProbability[]> {
  if (!process.env.THE_ODDS_API_KEY) return getMockBookmakerProbabilities();

  try {
    const probabilities = await fetchWorldCupWinnerOddsFromApi();
    return probabilities.length > 0 ? probabilities : getMockBookmakerProbabilities();
  } catch (error) {
    console.warn("The Odds API fetch failed. Falling back to mock data.", error);
    return getMockBookmakerProbabilities();
  }
}

export async function fetchWorldCupWinnerOddsFromApi(): Promise<BookmakerTeamProbability[]> {
  if (!process.env.THE_ODDS_API_KEY) {
    throw new Error("THE_ODDS_API_KEY is not configured");
  }

  const sportKey = await resolveWorldCupWinnerSportKey();
  const records = await fetchOddsApiRecords(sportKey);
  return aggregateBookmakerRecords(records);
}

export function getMockBookmakerProbabilities() {
  const bookmakerConfigs = [
    { name: "Pinnacle", overround: 1.045, jitter: 0.99 },
    { name: "DraftKings", overround: 1.065, jitter: 1 },
    { name: "Bet365", overround: 1.055, jitter: 1.01 }
  ];

  const records = bookmakerConfigs.flatMap((bookmaker) => {
    const impliedBySlug = SEEDED_TEAMS.map((team) => {
      const target = MOCK_BOOKMAKER_TARGETS[team.slug] ?? team.seedAiProbability;
      const teamJitter = 1 + (team.slug.length % 4 - 1.5) * 0.006;
      const impliedProbability = target * bookmaker.overround * bookmaker.jitter * teamJitter;
      return { team, impliedProbability };
    });
    const total = impliedBySlug.reduce((sum, item) => sum + item.impliedProbability, 0);

    return impliedBySlug.map(({ team, impliedProbability }) => {
      const decimalOdds = 1 / impliedProbability;
      return {
        slug: team.slug,
        teamName: team.name,
        bookmaker: bookmaker.name,
        decimalOdds,
        impliedProbability,
        normalizedProbability: impliedProbability / total,
        rawJson: {
          source: "mock",
          bookmaker: bookmaker.name,
          decimalOdds
        }
      } satisfies BookmakerOddRecord;
    });
  });

  return aggregateBookmakerRecords(records);
}

export async function resolveWorldCupWinnerSportKey() {
  if (!process.env.THE_ODDS_API_KEY) {
    throw new Error("THE_ODDS_API_KEY is not configured");
  }

  const params = new URLSearchParams({
    apiKey: process.env.THE_ODDS_API_KEY,
    all: "true"
  });
  const response = await fetch(`${ODDS_API_BASE}/sports?${params.toString()}`, {
    next: { revalidate: 0 },
    signal: AbortSignal.timeout(8000)
  });

  if (!response.ok) {
    throw new Error(`The Odds API sports endpoint returned ${response.status}`);
  }

  const sports = (await response.json()) as OddsSport[];
  const configuredSportKey = process.env.THE_ODDS_SPORT_KEY || ODDS_SPORT_KEY;
  const exact = sports.find((sport) => sport.key === configuredSportKey);
  if (exact?.key) return exact.key;

  const fallback = sports.find((sport) => {
    const text = [sport.key, sport.group, sport.title, sport.description]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    const hasWorldCup = text.includes("world_cup") || text.includes("world cup");
    const hasFifa = text.includes("fifa");
    const hasWinner = text.includes("winner") || text.includes("outright") || sport.has_outrights;
    return (hasWorldCup || hasFifa) && hasWinner;
  });

  if (!fallback?.key) {
    throw new Error("No World Cup winner sport key found in The Odds API sports list");
  }

  return fallback.key;
}

async function fetchOddsApiRecords(sportKey: string) {
  const marketKey = process.env.ODDS_MARKET || "outrights";
  const params = new URLSearchParams({
    apiKey: process.env.THE_ODDS_API_KEY ?? "",
    regions: process.env.ODDS_REGION || "uk",
    markets: marketKey,
    oddsFormat: "decimal",
    dateFormat: "iso"
  });
  const url = `${ODDS_API_BASE}/sports/${sportKey}/odds/?${params.toString()}`;
  const response = await fetch(url, {
    next: { revalidate: 0 },
    signal: AbortSignal.timeout(8000)
  });

  if (!response.ok) {
    throw new Error(`The Odds API returned ${response.status}`);
  }

  const events = (await response.json()) as OddsEvent[];
  const records: BookmakerOddRecord[] = [];

  for (const event of Array.isArray(events) ? events : []) {
    for (const bookmaker of event.bookmakers ?? []) {
      const market = bookmaker.markets?.find((item) => item.key === marketKey);
      if (!market?.outcomes?.length) continue;

      const normalizedCandidates = market.outcomes
        .map((outcome) => {
          if (!outcome.name || !outcome.price || outcome.price <= 1) return null;
          const slug = teamSlugFromName(outcome.name);
          const seedTeam = SEEDED_TEAMS.find((team) => team.slug === slug);
          if (!seedTeam) return null;
          const impliedProbability = 1 / outcome.price;
          return {
            slug,
            teamName: seedTeam.name,
            bookmaker: bookmaker.title ?? bookmaker.key ?? "Unknown",
            decimalOdds: outcome.price,
            impliedProbability,
            rawJson: outcome
          };
        })
        .filter(Boolean) as Omit<BookmakerOddRecord, "normalizedProbability">[];

      const total = normalizedCandidates.reduce((sum, item) => sum + item.impliedProbability, 0);
      if (total <= 0) continue;

      records.push(
        ...normalizedCandidates.map((item) => ({
          ...item,
          normalizedProbability: item.impliedProbability / total
        }))
      );
    }
  }

  return records;
}

function aggregateBookmakerRecords(records: BookmakerOddRecord[]): BookmakerTeamProbability[] {
  const bySlug = new Map<string, BookmakerOddRecord[]>();
  for (const record of records) {
    const current = bySlug.get(record.slug) ?? [];
    current.push(record);
    bySlug.set(record.slug, current);
  }

  return [...bySlug.entries()].map(([slug, teamRecords]) => {
    const team = SEEDED_TEAMS.find((seed) => seed.slug === slug);
    return {
      teamName: team?.name ?? teamRecords[0].teamName,
      slug,
      bookmakerProbability: median(teamRecords.map((record) => record.normalizedProbability)),
      bookmakerCount: teamRecords.length,
      medianDecimalOdds: median(teamRecords.map((record) => record.decimalOdds)),
      rawJson: teamRecords,
      odds: teamRecords
    };
  });
}

function median(values: number[]) {
  const sorted = [...values].filter(Number.isFinite).sort((a, b) => a - b);
  if (!sorted.length) return 0;
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length % 2) return sorted[middle];
  return (sorted[middle - 1] + sorted[middle]) / 2;
}
