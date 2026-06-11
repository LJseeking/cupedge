import {
  getQualifiedTeamAliases,
  isQualifiedTeamSlug,
  QUALIFIED_TEAMS
} from "@/lib/data/qualified-teams";
import { SEEDED_TEAMS } from "@/lib/data/seed";
import { slugify } from "@/lib/utils";

const aliases: Record<string, string> = Object.fromEntries(
  QUALIFIED_TEAMS.flatMap((team) =>
    [team.name, team.slug.replace(/-/g, " "), ...(team.aliases ?? [])].map((alias) => [
      normalizeTeamName(alias),
      team.slug
    ])
  )
);

export function teamSlugFromName(name: string) {
  const normalized = normalizeTeamName(name);
  return aliases[normalized] ?? slugify(name);
}

export function findSeedTeamByName(name: string) {
  const slug = teamSlugFromName(name);
  if (!isQualifiedTeamSlug(slug)) return undefined;
  return SEEDED_TEAMS.find((team) => team.slug === slug);
}

export function findSeedTeamInText(text: string) {
  const normalized = ` ${normalizeTeamName(text)} `;
  return SEEDED_TEAMS.find((team) =>
    getQualifiedTeamAliases(team.slug).some((alias) => {
      const normalizedAlias = normalizeTeamName(alias);
      return normalized.includes(` ${normalizedAlias} `);
    })
  );
}

export function knownTeamSlugs() {
  return new Set(SEEDED_TEAMS.map((team) => team.slug).filter(isQualifiedTeamSlug));
}

export function knownTeamNames() {
  return SEEDED_TEAMS.map((team) => team.name);
}

function normalizeTeamName(name: string) {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
