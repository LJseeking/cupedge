import { getMockBookmakerProbabilities } from "../lib/data/odds";
import { getMockPolymarketQuotes } from "../lib/data/polymarket";
import { SEEDED_TEAMS } from "../lib/data/seed";
import { prisma } from "../lib/db/prisma";
import { refreshMarketOpportunities } from "../lib/services/opportunities";
import { buildValuationRows, ensureSeedTeams, updateValuations } from "../lib/services/valuation";
import { clampProbability } from "../lib/utils";

async function main() {
  await prisma.bookmakerOdd.deleteMany();
  await prisma.marketOpportunity.deleteMany();
  await prisma.marketSnapshot.deleteMany();
  await prisma.teamValuation.deleteMany();
  await ensureSeedTeams();

  const teams = await prisma.team.findMany();
  const previousCapturedAt = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const previousQuotes = getMockPolymarketQuotes().map((quote, index) => {
    const shift = [0.012, -0.009, 0.006, -0.004][index % 4];
    const probability = clampProbability(quote.probability + shift);
    return {
      ...quote,
      probability,
      bestBid: quote.bestBid === undefined ? undefined : clampProbability(quote.bestBid + shift),
      bestAsk: quote.bestAsk === undefined ? undefined : clampProbability(quote.bestAsk + shift),
      midPrice: quote.midPrice === undefined ? undefined : clampProbability(quote.midPrice + shift),
      spread:
        quote.bestBid !== undefined && quote.bestAsk !== undefined
          ? quote.bestAsk - quote.bestBid
          : undefined,
      updatedAt: previousCapturedAt.toISOString()
    };
  });

  const previousRows = buildValuationRows({
    teams: SEEDED_TEAMS,
    polymarketQuotes: previousQuotes,
    bookmakerProbabilities: getMockBookmakerProbabilities(),
    updatedAt: previousCapturedAt
  });

  for (const row of previousRows) {
    const team = teams.find((item) => item.slug === row.slug);
    if (!team) continue;
    await prisma.marketSnapshot.create({
      data: {
        teamId: team.id,
        source: "FAIR",
        polymarketProbability: row.polymarketProbability,
        bookmakerProbability: row.bookmakerProbability,
        fairProbability: row.fairProbability,
        edgeScore: row.edgeScore,
        capturedAt: previousCapturedAt
      }
    });
  }

  await updateValuations({ forceMock: true });
  await refreshMarketOpportunities({ forceMock: true });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
