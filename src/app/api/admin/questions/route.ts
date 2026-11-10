import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/admin";
import { loadBank, questionEligibility } from "@/lib/question-bank/bank";
import { importQuestions, WriteError } from "@/lib/question-bank/write";

export const dynamic = "force-dynamic";

export async function GET() {
  const denied = await requireAdmin();
  if (denied) return denied;
  const bank = loadBank();
  return NextResponse.json({
    version: bank.version,
    cases: bank.cases,
    invalid: bank.invalid,
    questions: bank.questions.map((q) => ({ ...q, file: bank.fileOf[q.id], eligibility: questionEligibility(q, bank) })),
  });
}

/** Import question records: body { items: Question[], overwrite?: boolean } */
export async function POST(req: Request) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const body = (await req.json().catch(() => null)) as { items?: unknown; overwrite?: boolean } | null;
  const items = Array.isArray(body?.items) ? body!.items : Array.isArray(body) ? (body as unknown[]) : null;
  if (!items) return NextResponse.json({ error: "Expected { items: [...] } or an array" }, { status: 400 });
  try {
    return NextResponse.json(importQuestions(items, !!body?.overwrite));
  } catch (e) {
    if (e instanceof WriteError) return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
  }
}
