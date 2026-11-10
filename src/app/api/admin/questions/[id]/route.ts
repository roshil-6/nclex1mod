import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/admin";
import { saveQuestion, WriteError } from "@/lib/question-bank/write";

export const dynamic = "force-dynamic";

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const { id } = await params;
  const body = (await req.json().catch(() => null)) as { id?: string } | null;
  if (!body || body.id !== id) return NextResponse.json({ error: "Body id must match URL id" }, { status: 400 });
  try {
    return NextResponse.json(saveQuestion(body));
  } catch (e) {
    if (e instanceof WriteError) return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
  }
}
