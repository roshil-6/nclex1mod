import { NextResponse } from "next/server";
import { eligibleUnits, loadBank, poolStats } from "@/lib/question-bank/stats";

export const dynamic = "force-dynamic";

/** Public, key-free summary of what is available for exams. */
export async function GET() {
  const bank = loadBank();
  return NextResponse.json(poolStats(bank, eligibleUnits(bank)));
}
