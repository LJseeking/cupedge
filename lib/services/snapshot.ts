import { isQualifiedTeamSlug, QUALIFIED_TEAM_SLUGS } from "@/lib/data/qualified-teams";
import { prisma } from "@/lib/db/prisma";
import { getCurrentValuations } from "@/lib/services/valuation";
import type { MoveSignal, TeamMove, ValuationRow } from "@/lib/types/valuation";
import { clampProbability } from "@/lib/utils";

type SnapshotRow = {
  team: { name: string; slug: string };
  polymarketProbability: number | null;
  edgeScore: number | null;
  capturedAt: Date;
};

const TOURNAMENT = "world-cup-2026";
const qualifiedSlugs = [...QUALIFIED_TEAM_SLUGS];

export async function getRecentMoves(): Promise<TeamMove[]> {
  try {
    const snapshots = await prisma.marketSnapshot.findMany({
      where: {
        source: "FAIR",
        team: {
          is: {
            slug: { in: qualifiedSlugs },
            isQualified: true,
            tournament: TOURNAMENT
          }
        }
      },
      include: { team: true },
      orderBy: { capturedAt: "desc" },
      take: 200
    });

    const groups = groupSnapshotsByCapturedAt(snapshots);
    if (groups.length >= 2) {
      return buildMovesFromSnapshots(groups[1], groups[0]);
    }
    if (groups.length === 1) {
      return buildMovesFromSyntheticPrevious(groups[0]);
    }
  } catch (error) {
    console.warn("Database snapshot read failed. Using mock moves.", error);
  }

  const valuations = await getCurrentValuations();
  return buildMockMoves(valuations);
}

function groupSnapshotsByCapturedAt(rows: SnapshotRow[]) {
  const groups = new Map<number, SnapshotRow[]>();
  for (const row of rows) {
    if (!isQualifiedTeamSlug(row.team.slug)) continue;
    const key = row.capturedAt.getTime();
    const current = groups.get(key) ?? [];
    current.push(row);
    groups.set(key, current);
  }

  return [...groups.entries()]
    .sort(([a], [b]) => b - a)
    .map(([, rows]) => rows);
}

function buildMovesFromSnapshots(previousRows: SnapshotRow[], currentRows: SnapshotRow[]) {
  const previousBySlug = new Map(previousRows.map((row) => [row.team.slug, row]));

  return currentRows
    .map((current) => {
      const previous = previousBySlug.get(current.team.slug);
      if (!previous) return null;
      const previousPolymarket = previous.polymarketProbability ?? 0;
      const currentPolymarket = current.polymarketProbability ?? 0;
      const previousEdge = previous.edgeScore ?? 0;
      const currentEdge = current.edgeScore ?? 0;

      return {
        team: current.team.name,
        slug: current.team.slug,
        previousPolymarket,
        currentPolymarket,
        change: currentPolymarket - previousPolymarket,
        previousEdge,
        currentEdge,
        signal: getMoveSignal(previousPolymarket, currentPolymarket, previousEdge, currentEdge)
      } satisfies TeamMove;
    })
    .filter((move): move is TeamMove => move !== null)
    .sort((a, b) => Math.abs(b.change) - Math.abs(a.change));
}

function buildMovesFromSyntheticPrevious(currentRows: SnapshotRow[]) {
  const previousRows = currentRows.map((row, index) => {
    const shift = syntheticShift(index);
    return {
      ...row,
      polymarketProbability: clampProbability((row.polymarketProbability ?? 0) + shift.price),
      edgeScore: (row.edgeScore ?? 0) - shift.edge
    };
  });

  return buildMovesFromSnapshots(previousRows, currentRows);
}

function buildMockMoves(valuations: ValuationRow[]) {
  return valuations
    .slice(0, 12)
    .map((row, index) => {
      const shift = syntheticShift(index);
      const previousPolymarket = clampProbability(row.polymarketProbability + shift.price);
      const previousEdge = row.edgeScore - shift.edge;
      return {
        team: row.name,
        slug: row.slug,
        previousPolymarket,
        currentPolymarket: row.polymarketProbability,
        change: row.polymarketProbability - previousPolymarket,
        previousEdge,
        currentEdge: row.edgeScore,
        signal: getMoveSignal(
          previousPolymarket,
          row.polymarketProbability,
          previousEdge,
          row.edgeScore
        )
      } satisfies TeamMove;
    })
    .sort((a, b) => Math.abs(b.change) - Math.abs(a.change));
}

function syntheticShift(index: number) {
  const cycle = [
    { price: 0.012, edge: 0.014 },
    { price: -0.009, edge: -0.012 },
    { price: 0.006, edge: -0.007 },
    { price: -0.004, edge: 0.006 }
  ];
  return cycle[index % cycle.length];
}

export function getMoveSignal(
  previousPolymarket: number,
  currentPolymarket: number,
  previousEdge: number,
  currentEdge: number
): MoveSignal {
  if (previousEdge < 0.05 && currentEdge >= 0.05) return "new_value_signal";
  if (previousEdge > -0.05 && currentEdge <= -0.05) return "overheat_signal";
  if (currentPolymarket < previousPolymarket && currentEdge > previousEdge) {
    return "became_cheaper";
  }
  if (currentPolymarket > previousPolymarket && currentEdge < previousEdge) {
    return "became_expensive";
  }
  return "stable";
}
