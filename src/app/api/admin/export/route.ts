import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/admin";
import { loadBank } from "@/lib/question-bank/bank";

export const dynamic = "force-dynamic";

export async function GET() {
  const denied = await requireAdmin();
  if (denied) return denied;
  const bank = loadBank();
  return new NextResponse(JSON.stringify({ version: bank.version, exportedAt: new Date().toISOString(), cases: bank.cases, questions: bank.questions }, null, 2), {
    headers: {
      "content-type": "application/json",
      "content-disposition": `attachment; filename="question-bank-${bank.version}.json"`,
    },
  });
}
