import { NextResponse } from "next/server";
import { refreshMarketOpportunities } from "@/lib/services/opportunities";
import { refreshTeamRatings } from "@/lib/services/ratings";
import { refreshTournamentProjections } from "@/lib/services/tournament-simulation";
import { ensureSeedTeams, updateValuations } from "@/lib/services/valuation";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return runUpdateJob(request);
}

export async function POST(request: Request) {
  return runUpdateJob(request);
}

async function runUpdateJob(request: Request) {
  const expectedSecret = process.env.CRON_SECRET;
  const authorization = request.headers.get("authorization");

  if (!expectedSecret || authorization !== `Bearer ${expectedSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const forceOddsRefresh = new URL(request.url).searchParams.get("force") === "true";
  await ensureSeedTeams();
  const ratings = await refreshTeamRatings(forceOddsRefresh);
  const projections = await refreshTournamentProjections();
  const valuations = await updateValuations({ forceOddsRefresh });
  const opportunities = await refreshMarketOpportunities();

  return NextResponse.json({
    ok: true,
    forceOddsRefresh,
    updatedTeams: valuations.length,
    updatedRatings: ratings.size,
    updatedProjections: projections.length,
    updatedOpportunities: opportunities.length,
    updatedAt: new Date().toISOString()
  });
}
