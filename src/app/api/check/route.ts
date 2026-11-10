import { NextResponse } from "next/server";
import { z } from "zod";
import { sessionSecret, verifyToken } from "@/lib/auth/token";
import { loadBank } from "@/lib/question-bank/bank";
import { gradeItem } from "@/lib/scoring/grade";
import { ResponseSchema } from "@/lib/validation/schema";
import type { ExamTokenClaims } from "@/types/exam";

export const dynamic = "force-dynamic";

const Body = z.object({ token: z.string(), questionId: z.string(), response: ResponseSchema });

/**
 * Practice-mode immediate feedback for a single answered question.
 * Refused for exam-mode sessions: the signed token records whether feedback was enabled.
 */
export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  const claims = await verifyToken<ExamTokenClaims>(parsed.data.token, sessionSecret());
  if (!claims) return NextResponse.json({ error: "Invalid session token" }, { status: 401 });
  if (!claims.fb) return NextResponse.json({ error: "Immediate feedback is disabled for this session" }, { status: 403 });
  if (!claims.qids.includes(parsed.data.questionId))
    return NextResponse.json({ error: "Question not in this session" }, { status: 403 });
  const q = loadBank().questions.find((x) => x.id === parsed.data.questionId);
  if (!q) return NextResponse.json({ error: "Question no longer available" }, { status: 404 });
  return NextResponse.json(gradeItem(q, parsed.data.response));
}
