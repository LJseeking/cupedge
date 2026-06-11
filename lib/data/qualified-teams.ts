export type QualifiedTeam = {
  name: string;
  slug: string;
  group: string;
  countryCode?: string;
  seedAiProbability: number;
  aliases?: string[];
  sourceNote?: string;
};

const SOURCE_NOTE =
  "User-provided 2026 World Cup qualified teams whitelist for CupEdge MVP data admission.";

export const QUALIFIED_TEAMS: QualifiedTeam[] = [
  team("Mexico", "mexico", "Group A", "MX", 0.018),
  team("South Africa", "south-africa", "Group A", "ZA", 0.005),
  team("South Korea", "south-korea", "Group A", "KR", 0.009, [
    "Korea Republic",
    "Republic of Korea"
  ]),
  team("Czechia", "czechia", "Group A", "CZ", 0.006, ["Czech Republic"]),

  team("Canada", "canada", "Group B", "CA", 0.013),
  team("Bosnia and Herzegovina", "bosnia-and-herzegovina", "Group B", "BA", 0.004, [
    "Bosnia-Herzegovina",
    "Bosnia"
  ]),
  team("Qatar", "qatar", "Group B", "QA", 0.005),
  team("Switzerland", "switzerland", "Group B", "CH", 0.015),

  team("Brazil", "brazil", "Group C", "BR", 0.088),
  team("Morocco", "morocco", "Group C", "MA", 0.023),
  team("Haiti", "haiti", "Group C", "HT", 0.003),
  team("Scotland", "scotland", "Group C", "GB-SCT", 0.007),

  team("United States", "united-states", "Group D", "US", 0.016, [
    "USA",
    "U.S.A.",
    "U.S.",
    "USMNT",
    "United States of America"
  ]),
  team("Paraguay", "paraguay", "Group D", "PY", 0.007),
  team("Australia", "australia", "Group D", "AU", 0.007),
  team("Turkey", "turkey", "Group D", "TR", 0.009, ["Turkiye", "Türkiye"]),

  team("Germany", "germany", "Group E", "DE", 0.055),
  team("Curacao", "curacao", "Group E", "CW", 0.002, ["Curaçao"]),
  team("Ivory Coast", "ivory-coast", "Group E", "CI", 0.007, [
    "Cote d'Ivoire",
    "Côte d'Ivoire"
  ]),
  team("Ecuador", "ecuador", "Group E", "EC", 0.011),

  team("Netherlands", "netherlands", "Group F", "NL", 0.042, [
    "The Netherlands",
    "Holland"
  ]),
  team("Japan", "japan", "Group F", "JP", 0.014),
  team("Sweden", "sweden", "Group F", "SE", 0.013),
  team("Tunisia", "tunisia", "Group F", "TN", 0.006),

  team("Belgium", "belgium", "Group G", "BE", 0.03),
  team("Egypt", "egypt", "Group G", "EG", 0.008),
  team("Iran", "iran", "Group G", "IR", 0.006),
  team("New Zealand", "new-zealand", "Group G", "NZ", 0.003),

  team("Spain", "spain", "Group H", "ES", 0.102),
  team("Cape Verde", "cape-verde", "Group H", "CV", 0.003, ["Cabo Verde"]),
  team("Saudi Arabia", "saudi-arabia", "Group H", "SA", 0.004),
  team("Uruguay", "uruguay", "Group H", "UY", 0.028),

  team("France", "france", "Group I", "FR", 0.098),
  team("Senegal", "senegal", "Group I", "SN", 0.012),
  team("Iraq", "iraq", "Group I", "IQ", 0.003),
  team("Norway", "norway", "Group I", "NO", 0.009),

  team("Argentina", "argentina", "Group J", "AR", 0.079),
  team("Algeria", "algeria", "Group J", "DZ", 0.008),
  team("Austria", "austria", "Group J", "AT", 0.01),
  team("Jordan", "jordan", "Group J", "JO", 0.002),

  team("Portugal", "portugal", "Group K", "PT", 0.061),
  team("DR Congo", "dr-congo", "Group K", "CD", 0.004, [
    "Congo DR",
    "Democratic Republic of the Congo",
    "Dem. Rep. of Congo"
  ]),
  team("Uzbekistan", "uzbekistan", "Group K", "UZ", 0.003),
  team("Colombia", "colombia", "Group K", "CO", 0.027),

  team("England", "england", "Group L", "GB-ENG", 0.084),
  team("Croatia", "croatia", "Group L", "HR", 0.021),
  team("Ghana", "ghana", "Group L", "GH", 0.008),
  team("Panama", "panama", "Group L", "PA", 0.003)
];

export const QUALIFIED_TEAM_SLUGS = new Set(QUALIFIED_TEAMS.map((team) => team.slug));

export function isQualifiedTeamSlug(slug: string) {
  return QUALIFIED_TEAM_SLUGS.has(slug);
}

export function getQualifiedTeamBySlug(slug: string) {
  return QUALIFIED_TEAMS.find((team) => team.slug === slug);
}

export function getQualifiedTeamAliases(slug: string) {
  const qualifiedTeam = getQualifiedTeamBySlug(slug);
  if (!qualifiedTeam) return [];
  return [qualifiedTeam.name, qualifiedTeam.slug.replace(/-/g, " "), ...(qualifiedTeam.aliases ?? [])];
}

function team(
  name: string,
  slug: string,
  group: string,
  countryCode: string,
  seedAiProbability: number,
  aliases: string[] = []
): QualifiedTeam {
  return {
    name,
    slug,
    group,
    countryCode,
    seedAiProbability,
    aliases,
    sourceNote: SOURCE_NOTE
  };
}
