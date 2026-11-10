import { NextResponse } from "next/server";
import { z } from "zod";
import { createPlan, PlanError } from "@/lib/session/plan";

export const dynamic = "force-dynamic";

const ConfigSchema = z.object({
  mode: z.enum(["full", "quick", "case", "custom"]),
  count: z.number().int().min(1).max(150).optional(),
  timeLimitMinutes: z.number().int().min(0).max(300).optional(),
  categories: z.array(z.string()).optional(),
  caseStudyId: z.string().optional(),
  immediateFeedback: z.boolean().optional(),
});

/** Create an exam plan. Returns question content WITHOUT answer keys or rationales. */
export async function POST(req: Request) {
  const parsed = ConfigSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid configuration" }, { status: 400 });
  // Full exam mode is never practice: force feedback off regardless of request.
  const config = parsed.data.mode === "full" ? { ...parsed.data, immediateFeedback: false } : parsed.data;
  try {
    return NextResponse.json(await createPlan(config));
  } catch (e) {
    if (e instanceof PlanError) return NextResponse.json({ error: e.message }, { status: 422 });
    throw e;
  }
}
