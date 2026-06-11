async function main() {
  const curlFirst = process.argv.includes("--curl-first");
  const curlOnly = process.argv.includes("--curl-only");
  const force = process.argv.includes("--force");
  if (curlFirst || curlOnly) {
    process.env.CUPEDGE_HTTP_MODE = curlOnly ? "curl-only" : "curl-first";
    process.env.CUPEDGE_HTTP_DEBUG = "1";
  }
  process.env.CUPEDGE_RATINGS_DEBUG = "1";

  const { ensureSeedTeams } = await import("../lib/services/valuation");
  const { refreshTeamRatings } = await import("../lib/services/ratings");
  const { prisma } = await import("../lib/db/prisma");

  await ensureSeedTeams();
  const ratings = await refreshTeamRatings(force);
  console.log(`Updated rating strengths for ${ratings.size} teams.`);

  await prisma.$disconnect();
}

export {};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
