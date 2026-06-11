import { NextResponse } from "next/server";
import { getRecentMoves } from "@/lib/services/snapshot";

export const dynamic = "force-dynamic";

export async function GET() {
  const moves = await getRecentMoves();
  return NextResponse.json({ data: moves });
}
