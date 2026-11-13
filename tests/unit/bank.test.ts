// @vitest-environment node
import { describe, expect, it } from "vitest";
import { eligibleUnits, loadBank, questionEligibility, toPublic } from "@/lib/question-bank/bank";
import { createPlan, pickUnits, PlanError } from "@/lib/session/plan";
import { QuestionSchema } from "@/lib/validation/schema";
import { gradeSession } from "@/lib/scoring/grade";
import { sessionSecret, verifyToken } from "@/lib/auth/token";
import type { ExamTokenClaims } from "@/types/exam";

const bank = loadBank();

describe("question bank", () => {
  it("loads with no invalid records", () => {
    expect(bank.invalid).toEqual([]);
    expect(bank.questions.length).toBeGreaterThan(0);
  });

  it("every question passes the schema and has a rationale", () => {
    for (const q of bank.questions) {
      expect(QuestionSchema.safeParse(q).success).toBe(true);
      expect(q.rationale.length).toBeGreaterThan(40);
    }
  });

  it("covers every supported question type", () => {
    const types = new Set(bank.questions.map((q) => q.questionType));
    for (const t of ["single", "multiple", "matrix-single", "matrix-multiple", "dropdown", "highlight", "bowtie"]) expect(types.has(t as never)).toBe(true);
  });

  it("every case study has all parts in order", () => {
    for (const c of bank.cases) {
      const parts = bank.questions.filter((q) => q.caseStudyId === c.id).map((q) => q.caseStudyPart).sort();
      expect(parts).toEqual(Array.from({ length: c.totalParts }, (_, i) => i + 1));
    }
  });

  it("question ids are unique", () => {
    expect(new Set(bank.questions.map((q) => q.id)).size).toBe(bank.questions.length);
  });

  it("toPublic strips answer key, rationale and review notes", () => {
    const p = toPublic(bank.questions[0]) as Record<string, unknown>;
    expect(p.answerKey).toBeUndefined();
    expect(p.rationale).toBeUndefined();
    expect(p.reviewNotes).toBeUndefined();
  });

  it("unverified or disabled questions are not eligible", () => {
    const q = { ...bank.questions[0], answerVerificationStatus: "unverified" as const };
    expect(questionEligibility(q, bank).eligible).toBe(false);
    const d = { ...bank.questions[0], enabled: false };
    expect(questionEligibility(d, bank).reasons).toContain("disabled");
  });

  it("an incomplete case study is excluded as a whole", () => {
    const c = bank.cases[0];
    const broken = {
      ...bank,
      questions: bank.questions.map((q) => (q.caseStudyId === c.id && q.caseStudyPart === 2 ? { ...q, enabled: false } : q)),
    };
    expect(eligibleUnits(broken).some((u) => u.id === c.id)).toBe(false);
  });

  it("schema rejects an answer key that references a missing option", () => {
    const q = bank.questions.find((x) => x.questionType === "single")!;
    const r = QuestionSchema.safeParse({ ...q, answerKey: { type: "single", optionId: "zzz" } });
    expect(r.success).toBe(false);
  });
});

describe("exam planning", () => {
  it("never duplicates questions and keeps case studies whole and ordered", async () => {
    for (let i = 0; i < 20; i++) {
      const plan = await createPlan({ mode: "custom", count: 30 });
      expect(new Set(plan.questionIds).size).toBe(plan.questionIds.length);
      expect(plan.questionIds.length).toBeLessThanOrEqual(30);
      for (const c of plan.cases) {
        const positions = plan.questions.map((q, n) => (q.caseStudyId === c.id ? n : -1)).filter((n) => n >= 0);
        expect(positions.length).toBe(c.totalParts);
        expect(positions[positions.length - 1] - positions[0]).toBe(c.totalParts - 1);
        const parts = positions.map((n) => plan.questions[n].caseStudyPart);
        expect(parts).toEqual(Array.from({ length: c.totalParts }, (_, k) => k + 1));
      }
    }
  });

  it("quick practice defaults to a 50-question sitting and caps requests at 50", async () => {
    for (let i = 0; i < 10; i++) {
      const plan = await createPlan({ mode: "quick" });
      expect(plan.questionIds).toHaveLength(50);
      expect(new Set(plan.questionIds).size).toBe(50);
    }
    expect((await createPlan({ mode: "quick", count: 120 })).questionIds).toHaveLength(50);
    expect((await createPlan({ mode: "custom" })).questionIds).toHaveLength(50);
  });

  it("delivers no answer keys", async () => {
    const plan = await createPlan({ mode: "quick", count: 10 });
    expect(JSON.stringify(plan)).not.toContain("answerKey");
    expect(JSON.stringify(plan)).not.toContain("rationale");
  });

  it("builds a full exam of exactly 150 unique questions with whole, ordered case studies", async () => {
    const plan = await createPlan({ mode: "full", immediateFeedback: true });
    expect(plan.questionIds).toHaveLength(150);
    expect(new Set(plan.questionIds).size).toBe(150);
    expect(plan.durationSec).toBe(5 * 60 * 60);
    expect(plan.immediateFeedback).toBe(false);
    for (const c of plan.cases) {
      const pos = plan.questions.map((q, n) => (q.caseStudyId === c.id ? n : -1)).filter((n) => n >= 0);
      expect(pos[pos.length - 1] - pos[0]).toBe(c.totalParts - 1);
    }
  });

  it("refuses the full exam when fewer than 150 validated questions exist", async () => {
    const reduced = { ...bank, questions: bank.questions.map((q, i) => (i === 0 ? { ...q, enabled: false } : q)) };
    expect(eligibleUnits(reduced).reduce((n, u) => n + u.questionIds.length, 0)).toBeLessThan(150);
    await expect(createPlan({ mode: "full" }, reduced)).rejects.toBeInstanceOf(PlanError);
  });

  it("case-study mode returns exactly one complete case", async () => {
    const plan = await createPlan({ mode: "case", caseStudyId: "case-dka" });
    expect(plan.cases.map((c) => c.id)).toEqual(["case-dka"]);
    expect(plan.questionIds).toHaveLength(6);
  });

  it("pickUnits fits whole units within target", () => {
    const units = [
      { kind: "case" as const, id: "c", questionIds: ["1", "2", "3", "4", "5", "6"], category: "x" },
      { kind: "single" as const, id: "a", questionIds: ["a"], category: "x" },
      { kind: "single" as const, id: "b", questionIds: ["b"], category: "x" },
    ];
    const r = pickUnits(units, 2, () => 0.99);
    expect(r.flatMap((u) => u.questionIds).length).toBeLessThanOrEqual(2);
  });

  it("issues a signed token whose claims match the plan", async () => {
    const plan = await createPlan({ mode: "quick", count: 5, immediateFeedback: true });
    const claims = await verifyToken<ExamTokenClaims>(plan.token, sessionSecret());
    expect(claims?.qids).toEqual(plan.questionIds);
    expect(claims?.fb).toBe(true);
    expect(await verifyToken(plan.token.slice(0, -2) + "xx", sessionSecret())).toBeNull();
  });
});

describe("grading against real records", () => {
  it("answer keys score full marks and empty responses score zero", () => {
    const qids = bank.questions.map((q) => q.id);
    const claims: ExamTokenClaims = { sid: "t", mode: "custom", qids, fb: false, v: bank.version, iat: 0 };
    const perfect = gradeSession(claims, Object.fromEntries(bank.questions.map((q) => [q.id, q.answerKey])), bank);
    expect(perfect.summary.correct).toBe(qids.length);
    expect(perfect.summary.percentage).toBe(100);
    const empty = gradeSession(claims, {}, bank);
    expect(empty.summary.unanswered).toBe(qids.length);
    expect(empty.summary.earned).toBe(0);
    expect(perfect.summary.byCase.length).toBe(bank.cases.length);
  });
});
