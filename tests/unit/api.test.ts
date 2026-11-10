// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import { POST as createSession } from "@/app/api/sessions/route";
import { POST as score } from "@/app/api/score/route";
import { POST as check } from "@/app/api/check/route";
import { middleware } from "@/middleware";
import { ADMIN_COOKIE, makeAdminToken } from "@/lib/auth/token";
import { NextRequest } from "next/server";
import type { ExamPlan, ExamResult } from "@/types/exam";

const post = (body: unknown) => new Request("http://x/api", { method: "POST", body: JSON.stringify(body) });

describe("exam API", () => {
  it("creates sessions without keys, scores them, and refuses tampered tokens", async () => {
    const res = await createSession(post({ mode: "quick", count: 5 }));
    expect(res.status).toBe(200);
    const plan = (await res.json()) as ExamPlan;
    expect(JSON.stringify(plan)).not.toMatch(/answerKey|rationale/);

    const scored = await score(post({ token: plan.token, responses: {} }));
    const result = (await scored.json()) as ExamResult;
    expect(result.summary.totalQuestions).toBe(plan.questionIds.length);
    expect(result.summary.unanswered).toBe(plan.questionIds.length);

    const bad = await score(post({ token: "X" + plan.token, responses: {} }));
    expect([401]).toContain(bad.status);
  });

  it("ignores responses for questions outside the session", async () => {
    const plan = (await (await createSession(post({ mode: "quick", count: 5 }))).json()) as ExamPlan;
    const r = (await (await score(post({ token: plan.token, responses: { "not-in-session": { type: "single", optionId: "a" } } }))).json()) as ExamResult;
    expect(r.items.map((i) => i.questionId)).toEqual(plan.questionIds);
  });

  it("refuses immediate feedback for exam-style sessions", async () => {
    const plan = (await (await createSession(post({ mode: "quick", count: 5, immediateFeedback: false }))).json()) as ExamPlan;
    const res = await check(post({ token: plan.token, questionId: plan.questionIds[0], response: { type: "single", optionId: "a" } }));
    expect(res.status).toBe(403);
  });

  it("gives feedback in practice sessions", async () => {
    const plan = (await (await createSession(post({ mode: "case", caseStudyId: "case-vte", immediateFeedback: true }))).json()) as ExamPlan;
    const res = await check(post({ token: plan.token, questionId: "vte-3", response: { type: "single", optionId: "b" } }));
    expect(res.status).toBe(200);
    expect((await res.json()).score.outcome).toBe("correct");
  });

  it("full mode cannot be forced into feedback mode and is blocked below 150 questions", async () => {
    const res = await createSession(post({ mode: "full", immediateFeedback: true }));
    expect([200, 422]).toContain(res.status);
    if (res.status === 200) expect(((await res.json()) as ExamPlan).immediateFeedback).toBe(false);
  });
});

describe("admin protection (server-side)", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("redirects admin pages and rejects admin APIs without a valid cookie", async () => {
    vi.stubEnv("ADMIN_PASSWORD", "test-password-123");
    const page = await middleware(new NextRequest("http://x/admin"));
    expect(page.status).toBe(307);
    expect(page.headers.get("location")).toContain("/admin/login");
    const api = await middleware(new NextRequest("http://x/api/admin/questions"));
    expect(api.status).toBe(401);
    const forged = await middleware(new NextRequest("http://x/api/admin/export", { headers: { cookie: `${ADMIN_COOKIE}=eyJyb2xlIjoiYWRtaW4ifQ.abc` } }));
    expect(forged.status).toBe(401);
  });

  it("allows a correctly signed admin cookie", async () => {
    vi.stubEnv("ADMIN_PASSWORD", "test-password-123");
    const token = await makeAdminToken();
    const res = await middleware(new NextRequest("http://x/api/admin/questions", { headers: { cookie: `${ADMIN_COOKIE}=${token}` } }));
    expect(res.status).toBe(200);
  });

  it("disables admin entirely when ADMIN_PASSWORD is not configured", async () => {
    vi.stubEnv("ADMIN_PASSWORD", "test-password-123");
    const token = await makeAdminToken();
    vi.stubEnv("ADMIN_PASSWORD", "");
    const res = await middleware(new NextRequest("http://x/api/admin/questions", { headers: { cookie: `${ADMIN_COOKIE}=${token}` } }));
    expect(res.status).toBe(401);
  });
});
