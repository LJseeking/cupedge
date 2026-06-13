import { NextResponse } from "next/server";
import { refreshMatchResults } from "@/lib/services/match-results";
import { refreshMarketOpportunities } from "@/lib/services/opportunities";
import { refreshTeamRatings } from "@/lib/services/ratings";
import { refreshResearchInsights } from "@/lib/services/research-insights";
import { refreshTournamentProjections } from "@/lib/services/tournament-simulation";
import { refreshUpcomingMatches } from "@/lib/services/upcoming-matches";
import { ensureSeedTeams, updateValuations } from "@/lib/services/valuation";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return runUpdateJob(request);
}

export async function POST(request: Request) {
  return runUpdateJob(request);
}

async function runUpdateJob(request: Request) {
  try {
    const expectedSecret = process.env.CRON_SECRET;
    const authorization = request.headers.get("authorization");

    if (!expectedSecret || authorization !== `Bearer ${expectedSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const forceOddsRefresh = new URL(request.url).searchParams.get("force") === "true";
    await ensureSeedTeams();
    const ratings = await refreshTeamRatings(forceOddsRefresh);
    const matchResults = await refreshMatchResults();
    const projections = await refreshTournamentProjections();
    const valuations = await updateValuations({ forceOddsRefresh });
    const opportunities = await refreshMarketOpportunities();
    const researchInsights = await refreshResearchInsights({ valuations, opportunities });
    const upcomingMatches = await refreshUpcomingMatches();

    return NextResponse.json({
      ok: true,
      forceOddsRefresh,
      updatedTeams: valuations.length,
      updatedRatings: ratings.size,
      updatedMatchResults: matchResults.length,
      updatedProjections: projections.length,
      updatedOpportunities: opportunities.length,
      updatedResearchInsights: researchInsights,
      updatedUpcomingMatches: upcomingMatches.length,
      updatedAt: new Date().toISOString()
    });
  } catch (error) {
    console.error("CupEdge update-data job failed", error);
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Unknown update-data error"
      },
      { status: 500 }
    );
  }
}
