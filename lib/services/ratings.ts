import { fetchEloRatings } from "@/lib/data/ratings/elo";
import { fetchSpiRatings } from "@/lib/data/ratings/spi";
import { QUALIFIED_TEAMS, QUALIFIED_TEAM_SLUGS } from "@/lib/data/qualified-teams";
import { prisma } from "@/lib/db/prisma";
import type { RatingSource, TeamRatingInput, TeamStrength } from "@/lib/types/ratings";
import { clampProbability } from "@/lib/utils";

const qualifiedSlugs = [...QUALIFIED_TEAM_SLUGS];
const RATING_CACHE_HOURS = 24;

export async function refreshTeamRatings(forceRefresh = false) {
  const latest = await prisma.teamRating.findFirst({
    orderBy: { capturedAt: "desc" },
    select: { capturedAt: true }
  });
  const minIntervalMs = Number(process.env.RATINGS_UPDATE_MIN_INTERVAL_HOURS ?? RATING_CACHE_HOURS) * 60 * 60 * 1000;
  if (!forceRefresh && latest && Date.now() - latest.capturedAt.getTime() < minIntervalMs) {
    return getTeamStrengthMap();
  }

  const [elo, spi] = await Promise.all([
    safeFetchRatings("ELO", fetchEloRatings),
    safeFetchRatings("SPI", fetchSpiRatings)
  ]);
  if (process.env.CUPEDGE_RATINGS_DEBUG === "1") {
    console.log(`[CupEdge] Rating fetch counts: ELO=${elo.length}, SPI=${spi.length}`);
  }
  const fallback = buildSeedFallbackRatings();
  const capturedAt = new Date();
  const records = mergeRatingsWithFallback([...elo, ...spi], fallback);

  const teams = await prisma.team.findMany({
    where: {
      slug: { in: qualifiedSlugs },
      isQualified: true,
      tournament: "world-cup-2026"
    }
  });

  await prisma.$transaction(async (tx) => {
    for (const rating of records) {
      const team = teams.find((item) => item.slug === rating.slug);
      if (!team) continue;
      await tx.teamRating.create({
        data: {
          teamId: team.id,
          source: rating.source,
          rating: rating.rating,
          normalizedStrength: rating.normalizedStrength,
          rawJson: JSON.stringify(rating.rawJson ?? {}),
          capturedAt
        }
      });
    }

    if (!elo.length && !spi.length) {
      await tx.marketOpportunity.updateMany({
        where: { fairValueSource: "RATING_MODEL" },
        data: { fairValueSource: "RATING_FALLBACK" }
      });
    }
  });

  return getTeamStrengthMap(capturedAt);
}

export async function getTeamStrengthMap(capturedAt?: Date) {
  const latest = capturedAt
    ? { capturedAt }
    : await prisma.teamRating.findFirst({
        orderBy: { capturedAt: "desc" },
        select: { capturedAt: true }
      });

  if (!latest) {
    return buildStrengthMap(buildSeedFallbackRatings());
  }

  const rows = await prisma.teamRating.findMany({
    where: { capturedAt: latest.capturedAt },
    include: { team: true }
  });

  if (!rows.length) {
    return buildStrengthMap(buildSeedFallbackRatings());
  }

  const ratings = rows.map((row) => ({
    slug: row.team.slug,
    teamName: row.team.name,
    source: row.source as RatingSource,
    rating: row.rating,
    normalizedStrength: row.normalizedStrength,
    rawJson: row.rawJson
  }));

  return buildStrengthMap(ratings);
}

async function safeFetchRatings(
  source: RatingSource,
  fetcher: () => Promise<TeamRatingInput[]>
) {
  try {
    const ratings = await fetcher();
    if (ratings.length) return ratings;
  } catch (error) {
    console.warn(`${source} rating fetch failed. Falling back to local rating seed.`, error);
  }
  return [];
}

function mergeRatingsWithFallback(liveRatings: TeamRatingInput[], fallback: TeamRatingInput[]) {
  const keys = new Set(liveRatings.map((rating) => `${rating.slug}:${rating.source}`));
  return [
    ...liveRatings,
    ...fallback.filter((rating) => !keys.has(`${rating.slug}:${rating.source}`))
  ];
}

function buildSeedFallbackRatings(): TeamRatingInput[] {
  const maxSeed = Math.max(...QUALIFIED_TEAMS.map((team) => team.seedAiProbability));
  return QUALIFIED_TEAMS.map((team) => {
    const normalizedStrength = maxSeed > 0
      ? Math.sqrt(team.seedAiProbability / maxSeed)
      : 0.2;
    return {
      slug: team.slug,
      teamName: team.name,
      source: "SEED_FALLBACK",
      rating: Math.round(1250 + normalizedStrength * 750),
      normalizedStrength: clampProbability(normalizedStrength),
      rawJson: { seedAiProbability: team.seedAiProbability }
    };
  });
}

function buildStrengthMap(ratings: TeamRatingInput[]) {
  const bySlug = new Map<string, TeamRatingInput[]>();
  for (const rating of ratings) {
    bySlug.set(rating.slug, [...(bySlug.get(rating.slug) ?? []), rating]);
  }

  const strengths = new Map<string, TeamStrength>();
  for (const team of QUALIFIED_TEAMS) {
    const teamRatings = bySlug.get(team.slug) ?? [];
    const elo = teamRatings.find((rating) => rating.source === "ELO");
    const spi = teamRatings.find((rating) => rating.source === "SPI");
    const fallback = teamRatings.find((rating) => rating.source === "SEED_FALLBACK");
    const ratingStrength =
      elo && spi
        ? elo.normalizedStrength * 0.7 + spi.normalizedStrength * 0.3
        : elo?.normalizedStrength ?? spi?.normalizedStrength ?? fallback?.normalizedStrength ?? 0.2;
    const source: TeamStrength["source"] =
      elo && spi ? "ELO_SPI" : elo ? "ELO" : spi ? "SPI" : "SEED_FALLBACK";

    strengths.set(team.slug, {
      slug: team.slug,
      teamName: team.name,
      eloRating: elo?.rating,
      spiRating: spi?.rating,
      ratingStrength: clampProbability(ratingStrength),
      source
    });
  }

  return strengths;
}
