import { QUALIFIED_TEAMS } from "@/lib/data/qualified-teams";
import { prisma } from "@/lib/db/prisma";
import { getTeamStrengthMap } from "@/lib/services/ratings";
import type { TeamTournamentProjection, ProjectionStrengthSource } from "@/lib/types/projection";
import type { TeamStrength } from "@/lib/types/ratings";
import { clampProbability } from "@/lib/utils";

const DEFAULT_SIMULATIONS = 10_000;
const PROJECTION_SOURCE = "QUANT_SIMULATION";

type SimTeam = {
  slug: string;
  name: string;
  group: string;
  rating: number;
  strength: number;
  strengthSource: ProjectionStrengthSource;
};

type Standing = SimTeam & {
  points: number;
  goalDiff: number;
  goalsFor: number;
};

type Counters = {
  groupWin: number;
  reachR32: number;
  reachR16: number;
  reachQf: number;
  reachSf: number;
  reachFinal: number;
  winTournament: number;
};

export async function refreshTournamentProjections(options: { simulations?: number } = {}) {
  const simulations = normalizeSimulationCount(options.simulations);
  const strengths = await getTeamStrengthMap();
  const projections = runTournamentSimulation(strengths, simulations);
  const teams = await prisma.team.findMany({
    where: {
      slug: { in: QUALIFIED_TEAMS.map((team) => team.slug) },
      isQualified: true,
      tournament: "world-cup-2026"
    }
  });
  const teamBySlug = new Map(teams.map((team) => [team.slug, team]));

  await prisma.$transaction(async (tx) => {
    for (const projection of projections) {
      const team = teamBySlug.get(projection.slug);
      if (!team) continue;
      await tx.teamTournamentProjection.upsert({
        where: {
          teamId_source: {
            teamId: team.id,
            source: PROJECTION_SOURCE
          }
        },
        update: {
          strengthSource: projection.strengthSource,
          simulations: projection.simulations,
          groupWinProbability: projection.groupWinProbability,
          reachR32Probability: projection.reachR32Probability,
          reachR16Probability: projection.reachR16Probability,
          reachQfProbability: projection.reachQfProbability,
          reachSfProbability: projection.reachSfProbability,
          reachFinalProbability: projection.reachFinalProbability,
          winTournamentProbability: projection.winTournamentProbability,
          rawJson: JSON.stringify(projection.rawJson ?? {})
        },
        create: {
          teamId: team.id,
          source: PROJECTION_SOURCE,
          strengthSource: projection.strengthSource,
          simulations: projection.simulations,
          groupWinProbability: projection.groupWinProbability,
          reachR32Probability: projection.reachR32Probability,
          reachR16Probability: projection.reachR16Probability,
          reachQfProbability: projection.reachQfProbability,
          reachSfProbability: projection.reachSfProbability,
          reachFinalProbability: projection.reachFinalProbability,
          winTournamentProbability: projection.winTournamentProbability,
          rawJson: JSON.stringify(projection.rawJson ?? {})
        }
      });
    }
  });

  return projections;
}

export async function getTournamentProjectionMap() {
  const rows = await prisma.teamTournamentProjection.findMany({
    where: { source: PROJECTION_SOURCE },
    include: { team: true }
  });

  const projections = rows.map((row) => ({
    slug: row.team.slug,
    teamName: row.team.name,
    source: row.source as TeamTournamentProjection["source"],
    strengthSource: row.strengthSource as ProjectionStrengthSource,
    simulations: row.simulations,
    groupWinProbability: row.groupWinProbability,
    reachR32Probability: row.reachR32Probability,
    reachR16Probability: row.reachR16Probability,
    reachQfProbability: row.reachQfProbability,
    reachSfProbability: row.reachSfProbability,
    reachFinalProbability: row.reachFinalProbability,
    winTournamentProbability: row.winTournamentProbability,
    rawJson: parseRawJson(row.rawJson),
    updatedAt: row.updatedAt
  }));

  return new Map(projections.map((projection) => [projection.slug, projection]));
}

export function runTournamentSimulation(
  strengths: Map<string, TeamStrength>,
  simulations = DEFAULT_SIMULATIONS
): TeamTournamentProjection[] {
  const simCount = normalizeSimulationCount(simulations);
  const teams = QUALIFIED_TEAMS.map((team) => {
    const strength = strengths.get(team.slug);
    const ratingStrength = strength?.ratingStrength ?? seedStrengthFallback(team.seedAiProbability);
    return {
      slug: team.slug,
      name: team.name,
      group: team.group,
      rating: strength?.eloRating ?? normalizedStrengthToRating(ratingStrength),
      strength: ratingStrength,
      strengthSource: (strength?.source ?? "SEED_FALLBACK") as ProjectionStrengthSource
    } satisfies SimTeam;
  });
  const bySlug = new Map(teams.map((team) => [team.slug, team]));
  const counters = new Map(teams.map((team) => [team.slug, emptyCounters()]));
  const rng = seededRandom(20260609);

  for (let index = 0; index < simCount; index += 1) {
    const groupResults = simulateGroups(teams, rng);
    const bracket = buildRoundOf32Bracket(groupResults, bySlug, rng);
    for (const team of bracket) counters.get(team.slug)!.reachR32 += 1;

    const roundOf16 = playKnockoutRound(bracket, rng);
    for (const team of roundOf16) counters.get(team.slug)!.reachR16 += 1;

    const quarterfinals = playKnockoutRound(roundOf16, rng);
    for (const team of quarterfinals) counters.get(team.slug)!.reachQf += 1;

    const semifinals = playKnockoutRound(quarterfinals, rng);
    for (const team of semifinals) counters.get(team.slug)!.reachSf += 1;

    const final = playKnockoutRound(semifinals, rng);
    for (const team of final) counters.get(team.slug)!.reachFinal += 1;

    const champion = playKnockoutRound(final, rng)[0];
    counters.get(champion.slug)!.winTournament += 1;

    for (const winner of groupResults.winners) {
      counters.get(winner.slug)!.groupWin += 1;
    }
  }

  return teams.map((team) => {
    const counts = counters.get(team.slug)!;
    return {
      slug: team.slug,
      teamName: team.name,
      source: PROJECTION_SOURCE,
      strengthSource: team.strengthSource,
      simulations: simCount,
      groupWinProbability: counts.groupWin / simCount,
      reachR32Probability: counts.reachR32 / simCount,
      reachR16Probability: counts.reachR16 / simCount,
      reachQfProbability: counts.reachQf / simCount,
      reachSfProbability: counts.reachSf / simCount,
      reachFinalProbability: counts.reachFinal / simCount,
      winTournamentProbability: counts.winTournament / simCount,
      rawJson: {
        model: "elo_seed_monte_carlo_v1",
        note: "Approximate 2026 tournament simulation using ratings, group round robins, best third-place teams, and deterministic knockout slots."
      }
    };
  });
}

function simulateGroups(teams: SimTeam[], rng: () => number) {
  const byGroup = new Map<string, SimTeam[]>();
  for (const team of teams) {
    byGroup.set(team.group, [...(byGroup.get(team.group) ?? []), team]);
  }

  const winners: SimTeam[] = [];
  const runnersUp: SimTeam[] = [];
  const thirds: Standing[] = [];

  for (const groupTeams of [...byGroup.values()].sort((a, b) => a[0].group.localeCompare(b[0].group))) {
    const standings = groupTeams.map((team) => ({
      ...team,
      points: 0,
      goalDiff: 0,
      goalsFor: 0
    }));
    const standingBySlug = new Map(standings.map((team) => [team.slug, team]));

    for (let i = 0; i < groupTeams.length; i += 1) {
      for (let j = i + 1; j < groupTeams.length; j += 1) {
        applyGroupMatch(standingBySlug.get(groupTeams[i].slug)!, standingBySlug.get(groupTeams[j].slug)!, rng);
      }
    }

    standings.sort(compareStandings);
    winners.push(standings[0]);
    runnersUp.push(standings[1]);
    thirds.push(standings[2]);
  }

  thirds.sort(compareStandings);
  return {
    winners,
    runnersUp,
    bestThirds: thirds.slice(0, 8)
  };
}

function buildRoundOf32Bracket(
  groupResults: { winners: SimTeam[]; runnersUp: SimTeam[]; bestThirds: SimTeam[] },
  bySlug: Map<string, SimTeam>,
  rng: () => number
) {
  const winners = byGroupLetter(groupResults.winners);
  const runnersUp = byGroupLetter(groupResults.runnersUp);
  const thirds = [...groupResults.bestThirds].sort((a, b) => b.strength - a.strength);
  const nextThird = () => thirds.shift() ?? groupResults.bestThirds[Math.floor(rng() * groupResults.bestThirds.length)];
  const winnerLetters = "ABCDEFGHIJKL".split("");
  const runnerLetters = "ABCDEFGHIJKL".split("");
  const slots: SimTeam[] = [];

  for (let index = 0; index < 8; index += 1) {
    slots.push(winners.get(winnerLetters[index])!, nextThird());
  }
  for (let index = 8; index < 12; index += 1) {
    slots.push(winners.get(winnerLetters[index])!, runnersUp.get(runnerLetters[index - 8])!);
  }
  const remainingRunnerPairs = [
    ["E", "F"],
    ["G", "H"],
    ["I", "J"],
    ["K", "L"]
  ];
  for (const [left, right] of remainingRunnerPairs) {
    slots.push(runnersUp.get(left)!, runnersUp.get(right)!);
  }

  return slots.map((team) => bySlug.get(team.slug) ?? team);
}

function playKnockoutRound(teams: SimTeam[], rng: () => number) {
  const winners: SimTeam[] = [];
  for (let index = 0; index < teams.length; index += 2) {
    winners.push(simulateKnockoutMatch(teams[index], teams[index + 1], rng));
  }
  return winners;
}

function applyGroupMatch(a: Standing, b: Standing, rng: () => number) {
  const diff = a.rating - b.rating;
  const drawProbability = clampRange(0.28 - Math.min(Math.abs(diff), 500) / 4000, 0.16, 0.3);
  const aWinNoDraw = winProbability(a.rating, b.rating);
  const roll = rng();

  if (roll < drawProbability) {
    const goals = rng() < 0.52 ? 1 : rng() < 0.8 ? 0 : 2;
    a.points += 1;
    b.points += 1;
    a.goalsFor += goals;
    b.goalsFor += goals;
    return;
  }

  const aWins = (roll - drawProbability) / (1 - drawProbability) < aWinNoDraw;
  const margin = rng() < 0.72 ? 1 : rng() < 0.92 ? 2 : 3;
  const loserGoals = rng() < 0.62 ? 0 : rng() < 0.88 ? 1 : 2;
  const winnerGoals = loserGoals + margin;
  const winner = aWins ? a : b;
  const loser = aWins ? b : a;

  winner.points += 3;
  winner.goalDiff += margin;
  winner.goalsFor += winnerGoals;
  loser.goalDiff -= margin;
  loser.goalsFor += loserGoals;
}

function simulateKnockoutMatch(a: SimTeam, b: SimTeam, rng: () => number) {
  return rng() < winProbability(a.rating, b.rating) ? a : b;
}

function compareStandings(a: Standing, b: Standing) {
  return (
    b.points - a.points ||
    b.goalDiff - a.goalDiff ||
    b.goalsFor - a.goalsFor ||
    b.strength - a.strength ||
    a.slug.localeCompare(b.slug)
  );
}

function byGroupLetter(teams: SimTeam[]) {
  return new Map(teams.map((team) => [team.group.replace("Group ", ""), team]));
}

function winProbability(aRating: number, bRating: number) {
  return clampProbability(1 / (1 + Math.pow(10, (bRating - aRating) / 400)));
}

function normalizedStrengthToRating(strength: number) {
  return 1200 + clampProbability(strength) * 850;
}

function seedStrengthFallback(seedAiProbability: number) {
  const maxSeed = Math.max(...QUALIFIED_TEAMS.map((team) => team.seedAiProbability));
  return maxSeed > 0 ? clampProbability(Math.sqrt(seedAiProbability / maxSeed)) : 0.2;
}

function emptyCounters(): Counters {
  return {
    groupWin: 0,
    reachR32: 0,
    reachR16: 0,
    reachQf: 0,
    reachSf: 0,
    reachFinal: 0,
    winTournament: 0
  };
}

function normalizeSimulationCount(value: number | undefined) {
  const envValue = Number(process.env.TOURNAMENT_SIMULATIONS);
  const requested = value ?? (Number.isFinite(envValue) && envValue > 0 ? envValue : DEFAULT_SIMULATIONS);
  if (!requested || !Number.isFinite(requested)) return DEFAULT_SIMULATIONS;
  return Math.max(1_000, Math.min(50_000, Math.round(requested)));
}

function seededRandom(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

function clampRange(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

function parseRawJson(value: string | null) {
  if (!value) return undefined;
  try {
    return JSON.parse(value);
  } catch {
    return undefined;
  }
}
