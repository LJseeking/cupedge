import { NextResponse } from "next/server";
import { getCurrentValuations } from "@/lib/services/valuation";

export const dynamic = "force-dynamic";

export async function GET() {
  const valuations = await getCurrentValuations();
  return NextResponse.json({
    data: valuations.sort((a, b) => b.edgeScore - a.edgeScore)
  });
}
