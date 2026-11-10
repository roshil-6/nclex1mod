import { NextResponse } from "next/server";
import { z } from "zod";
import { sessionSecret, verifyToken } from "@/lib/auth/token";
import { gradeSession } from "@/lib/scoring/grade";
import { ResponseSchema } from "@/lib/validation/schema";
import type { ExamTokenClaims } from "@/types/exam";

export const dynamic = "force-dynamic";

const Body = z.object({
  token: z.string(),
  responses: z.record(z.string(), ResponseSchema),
});

/** Final submission: grades a signed session. Answer keys are only released here and in /api/check. */
export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid submission" }, { status: 400 });
  const claims = await verifyToken<ExamTokenClaims>(parsed.data.token, sessionSecret());
  if (!claims) return NextResponse.json({ error: "Invalid or tampered session token" }, { status: 401 });
  const allowed = new Set(claims.qids);
  const responses = Object.fromEntries(Object.entries(parsed.data.responses).filter(([id]) => allowed.has(id)));
  return NextResponse.json(gradeSession(claims, responses));
}
