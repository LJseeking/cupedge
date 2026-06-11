import { QUALIFIED_TEAMS } from "@/lib/data/qualified-teams";
import type { PolymarketTeamQuote, TeamSeed } from "@/lib/types/valuation";
import { clampProbability } from "@/lib/utils";

export const SEEDED_TEAMS: TeamSeed[] = QUALIFIED_TEAMS.map((team) => ({
  name: team.name,
  slug: team.slug,
  countryCode: team.countryCode,
  group: team.group,
  seedAiProbability: team.seedAiProbability
}));

export const MOCK_BOOKMAKER_TARGETS: Record<string, number> = Object.fromEntries(
  SEEDED_TEAMS.map((team) => [team.slug, team.seedAiProbability])
);

const MOCK_POLYMARKET_SHIFTS = [
  -0.018,
  0.012,
  -0.01,
  0.008,
  -0.006,
  0.005,
  -0.004,
  0.003
];

export const MOCK_POLYMARKET_QUOTES: PolymarketTeamQuote[] = SEEDED_TEAMS.map((team, index) => {
  const shift = MOCK_POLYMARKET_SHIFTS[index % MOCK_POLYMARKET_SHIFTS.length];
  const fallbackPrice = clampProbability(Math.max(0.002, team.seedAiProbability + shift));
  const hasOrderbook = index % 5 !== 1;
  const spread = index % 4 === 0 ? 0.018 : 0.024;
  const bestBid = hasOrderbook ? clampProbability(Math.max(0.001, fallbackPrice - spread / 2)) : undefined;
  const bestAsk = hasOrderbook ? clampProbability(Math.min(0.98, fallbackPrice + spread / 2)) : undefined;

  return quote(
    team.name,
    team.slug,
    fallbackPrice,
    bestBid,
    bestAsk,
    80000 + index * 43000,
    420000 + index * 170000
  );
});

function quote(
  teamName: string,
  slug: string,
  fallbackPrice: number,
  bestBid?: number,
  bestAsk?: number,
  liquidity?: number,
  volume?: number
): PolymarketTeamQuote {
  const midPrice =
    bestBid !== undefined && bestAsk !== undefined ? (bestBid + bestAsk) / 2 : undefined;

  return {
    teamName,
    slug,
    probability: midPrice ?? fallbackPrice,
    bestBid,
    bestAsk,
    midPrice,
    spread: bestBid !== undefined && bestAsk !== undefined ? bestAsk - bestBid : undefined,
    liquidity,
    volume,
    updatedAt: new Date().toISOString(),
    rawJson: {
      source: "mock",
      fallbackPrice,
      bestBid,
      bestAsk,
      liquidity,
      volume
    }
  };
}
