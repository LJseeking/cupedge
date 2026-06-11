import { NextResponse } from "next/server";
import { getTeamDetail } from "@/lib/services/valuation";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const team = await getTeamDetail(slug);
  if (!team) {
    return NextResponse.json({ error: "Team not found" }, { status: 404 });
  }
  return NextResponse.json({ data: team });
}
