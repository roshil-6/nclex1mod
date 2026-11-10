"use client";
import { saveSession, sessionFromPlan } from "@/lib/session/store";
import type { ExamConfig, ExamPlan } from "@/types/exam";

/** Create a brand-new, independent session (also used for retakes). Returns its id. */
export async function startExam(config: ExamConfig): Promise<string> {
  const res = await fetch("/api/sessions", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(config),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(body.error ?? `Could not start (${res.status})`);
  const plan = body as ExamPlan;
  await saveSession(sessionFromPlan(plan, config));
  return plan.sessionId;
}
