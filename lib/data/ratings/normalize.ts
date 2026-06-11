import { QUALIFIED_TEAMS, getQualifiedTeamAliases } from "@/lib/data/qualified-teams";
import type { RatingSource, TeamRatingInput } from "@/lib/types/ratings";

type RawRating = {
  name: string;
  rating: number;
  rawJson?: unknown;
};

export function normalizeRatingRecords(
  rawRatings: RawRating[],
  source: RatingSource,
  normalizeRating: (rating: number) => number
): TeamRatingInput[] {
  const byName = new Map(
    rawRatings.map((rating) => [normalizeNameForRating(rating.name), rating])
  );

  const ratings: TeamRatingInput[] = [];
  for (const team of QUALIFIED_TEAMS) {
    const aliases = getQualifiedTeamAliases(team.slug);
    const match = aliases
      .map((alias) => byName.get(normalizeNameForRating(alias)))
      .find(Boolean);
    if (!match) continue;

    ratings.push({
      slug: team.slug,
      teamName: team.name,
      source,
      rating: match.rating,
      normalizedStrength: normalizeRating(match.rating),
      rawJson: match.rawJson
    });
  }

  return ratings;
}

export function normalizeNameForRating(name: string) {
  return name
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\bthe\b/g, "")
    .trim()
    .replace(/\s+/g, " ");
}
