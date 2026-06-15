function hasArg(name: string) {
  return process.argv.includes(name);
}

function readArg(prefix: string) {
  return process.argv.find((arg) => arg.startsWith(prefix))?.replace(prefix, "");
}

function printHelp() {
  console.log(`
CupEdge homepage data update

Usage:
  npm run update:home
  npm run update:home -- --force
  npm run update:home -- --curl-first

Options:
  --force       Force upstream refreshes where supported.
  --curl-first  Try curl-based fetching before the built-in fetch client.
  --curl-only   Use curl-based fetching only.
  --proxy=URL   Route curl requests through a proxy.
  --deep-scan   Enable deeper Polymarket scanning.
  --help        Show this help message.
`.trim());
}

function applyNetworkOptions() {
  const curlFirst = hasArg("--curl-first");
  const curlOnly = hasArg("--curl-only");
  const deepScan = hasArg("--deep-scan");
  const proxy = readArg("--proxy=");

  if (proxy) {
    process.env.CUPEDGE_CURL_PROXY = proxy;
  }
  if (curlFirst || curlOnly) {
    process.env.CUPEDGE_HTTP_MODE = curlOnly ? "curl-only" : "curl-first";
    process.env.CUPEDGE_HTTP_DEBUG = "1";
    process.env.CUPEDGE_POLYMARKET_DEBUG = "1";
  }
  if (deepScan) {
    process.env.CUPEDGE_POLYMARKET_DEEP_SCAN = "1";
  }
}

async function main() {
  if (hasArg("--help")) {
    printHelp();
    return;
  }

  applyNetworkOptions();
  const force = hasArg("--force");
  if (force) {
    process.env.RATINGS_UPDATE_MIN_INTERVAL_HOURS = "0";
  }

  const { prisma } = await import("../lib/db/prisma");
  const { refreshUpcomingMatches } = await import("../lib/services/upcoming-matches");
  const { ensureSeedTeams } = await import("../lib/services/valuation");

  await ensureSeedTeams();
  const matches = await refreshUpcomingMatches();

  console.log(`[CupEdge] Updated homepage data for ${matches.length} upcoming matches.`);
  for (const match of matches) {
    const marketStatus = [match.homeProbability, match.drawProbability, match.awayProbability].every(
      (value) => value !== null && value !== undefined
    )
      ? "market prices matched"
      : "fair probabilities only";
    console.log(`- ${match.homeTeam} vs ${match.awayTeam}: ${marketStatus}`);
  }

  await prisma.$disconnect();
}

export {};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
