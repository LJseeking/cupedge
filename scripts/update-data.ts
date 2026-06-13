async function main() {
  const forceMock = process.argv.includes("--mock");
  const curlFirst = process.argv.includes("--curl-first");
  const curlOnly = process.argv.includes("--curl-only");
  const deepScan = process.argv.includes("--deep-scan");
  const forceOddsRefresh = process.argv.includes("--force");
  const proxyArg = process.argv.find((arg) => arg.startsWith("--proxy="));
  if (proxyArg) {
    process.env.CUPEDGE_CURL_PROXY = proxyArg.replace("--proxy=", "");
  }
  if (curlFirst || curlOnly) {
    process.env.CUPEDGE_HTTP_MODE = curlOnly ? "curl-only" : "curl-first";
    process.env.CUPEDGE_HTTP_DEBUG = "1";
    process.env.CUPEDGE_POLYMARKET_DEBUG = "1";
  }
  process.env.CUPEDGE_RATINGS_DEBUG = "1";
  if (deepScan) {
    process.env.CUPEDGE_POLYMARKET_DEEP_SCAN = "1";
  }

  const { prisma } = await import("../lib/db/prisma");
  const { refreshMatchResults } = await import("../lib/services/match-results");
  const { refreshMarketOpportunities } = await import("../lib/services/opportunities");
  const { refreshTeamRatings } = await import("../lib/services/ratings");
  const { refreshResearchInsights } = await import("../lib/services/research-insights");
  const { refreshTournamentProjections } = await import("../lib/services/tournament-simulation");
  const { refreshUpcomingMatches } = await import("../lib/services/upcoming-matches");
  const { ensureSeedTeams, updateValuations } = await import("../lib/services/valuation");

  await ensureSeedTeams();
  const ratings = await refreshTeamRatings(forceOddsRefresh);
  const matchResults = await refreshMatchResults();
  const projections = await refreshTournamentProjections();
  const valuations = await updateValuations({ forceMock, forceOddsRefresh });
  const opportunities = await refreshMarketOpportunities({ forceMock });
  const researchInsights = await refreshResearchInsights({ valuations, opportunities });
  const upcomingMatches = await refreshUpcomingMatches();
  const sourceCounts = await prisma.marketOpportunity.groupBy({
    by: ["priceSource", "volumeSource", "fairValueSource"],
    _count: true
  });
  console.log(`Updated ${valuations.length} team valuations, ${ratings.size} team ratings, ${matchResults.length} match results, ${projections.length} tournament projections, ${opportunities.length} market opportunities, ${researchInsights} research insights, and ${upcomingMatches.length} upcoming matches.`);
  console.log(`[CupEdge] Market opportunity source counts: ${JSON.stringify(sourceCounts)}`);

  await prisma.$disconnect();
}

export {};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
