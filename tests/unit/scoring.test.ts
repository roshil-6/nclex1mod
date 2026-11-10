import { describe, expect, it } from "vitest";
import { isAnswered, maxPoints, scoreQuestion, summarise } from "@/lib/scoring/score";
import type { Question } from "@/lib/validation/schema";

type Q = Pick<Question, "id" | "answerKey" | "scoringPolicy" | "matrixRows" | "dropdownFields">;
const base = { matrixRows: [], dropdownFields: [] };

describe("single answer", () => {
  const q: Q = { ...base, id: "s", answerKey: { type: "single", optionId: "b" }, scoringPolicy: "dichotomous" };
  it("scores correct / incorrect / unanswered", () => {
    expect(scoreQuestion(q, { type: "single", optionId: "b" })).toMatchObject({ earned: 1, max: 1, outcome: "correct" });
    expect(scoreQuestion(q, { type: "single", optionId: "a" })).toMatchObject({ earned: 0, outcome: "incorrect" });
    expect(scoreQuestion(q, undefined)).toMatchObject({ earned: 0, max: 1, outcome: "unanswered" });
    expect(scoreQuestion(q, { type: "single", optionId: null }).outcome).toBe("unanswered");
  });
  it("rejects a response of the wrong shape", () => {
    expect(scoreQuestion(q, { type: "multiple", optionIds: ["b"] }).earned).toBe(0);
  });
});

describe("multiple response", () => {
  const key = { type: "multiple" as const, optionIds: ["a", "b", "d"] };
  const pm: Q = { ...base, id: "m", answerKey: key, scoringPolicy: "plus-minus" };
  const dich: Q = { ...base, id: "m2", answerKey: key, scoringPolicy: "dichotomous" };
  it("plus-minus: +1 correct, -1 incorrect, floor 0", () => {
    expect(maxPoints(pm)).toBe(3);
    expect(scoreQuestion(pm, { type: "multiple", optionIds: ["a", "b", "d"] })).toMatchObject({ earned: 3, outcome: "correct" });
    expect(scoreQuestion(pm, { type: "multiple", optionIds: ["a", "b"] })).toMatchObject({ earned: 2, outcome: "partial" });
    expect(scoreQuestion(pm, { type: "multiple", optionIds: ["a", "b", "c"] })).toMatchObject({ earned: 1, outcome: "partial" });
    expect(scoreQuestion(pm, { type: "multiple", optionIds: ["c", "e", "a"] })).toMatchObject({ earned: 0, outcome: "incorrect" });
    expect(scoreQuestion(pm, { type: "multiple", optionIds: ["a", "b", "c", "d", "e", "f"] }).earned).toBe(0);
  });
  it("ignores duplicate ids in a response", () => {
    expect(scoreQuestion(pm, { type: "multiple", optionIds: ["a", "a", "a"] }).earned).toBe(1);
  });
  it("dichotomous: all or nothing, order-insensitive", () => {
    expect(scoreQuestion(dich, { type: "multiple", optionIds: ["d", "a", "b"] }).earned).toBe(1);
    expect(scoreQuestion(dich, { type: "multiple", optionIds: ["a", "b"] }).earned).toBe(0);
  });
});

describe("matrix single (one answer per row)", () => {
  const q: Q = {
    ...base,
    id: "ms",
    matrixRows: [
      { id: "r1", text: "1" },
      { id: "r2", text: "2" },
      { id: "r3", text: "3" },
    ],
    answerKey: { type: "matrix-single", selections: { r1: "x", r2: "y", r3: "x" } },
    scoringPolicy: "zero-one",
  };
  it("zero-one per row", () => {
    expect(maxPoints(q)).toBe(3);
    expect(scoreQuestion(q, { type: "matrix-single", selections: { r1: "x", r2: "y", r3: "x" } })).toMatchObject({ earned: 3, outcome: "correct" });
    expect(scoreQuestion(q, { type: "matrix-single", selections: { r1: "x", r2: "x" } })).toMatchObject({ earned: 1, outcome: "partial" });
    expect(scoreQuestion(q, { type: "matrix-single", selections: {} }).outcome).toBe("unanswered");
  });
  it("dichotomous requires every row", () => {
    const d = { ...q, scoringPolicy: "dichotomous" as const };
    expect(scoreQuestion(d, { type: "matrix-single", selections: { r1: "x", r2: "y" } }).earned).toBe(0);
    expect(scoreQuestion(d, { type: "matrix-single", selections: { r1: "x", r2: "y", r3: "x" } }).earned).toBe(1);
  });
});

describe("matrix multiple", () => {
  const q: Q = {
    ...base,
    id: "mm",
    matrixRows: [
      { id: "r1", text: "1" },
      { id: "r2", text: "2" },
      { id: "r3", text: "3" },
    ],
    answerKey: { type: "matrix-multiple", selections: { r1: ["a"], r2: ["a", "b"], r3: [] } },
    scoringPolicy: "plus-minus",
  };
  it("plus-minus over cells", () => {
    expect(maxPoints(q)).toBe(3);
    expect(scoreQuestion(q, { type: "matrix-multiple", selections: { r1: ["a"], r2: ["b", "a"] } })).toMatchObject({ earned: 3, outcome: "correct" });
    // one wrong cell in a row that should be empty costs a point
    expect(scoreQuestion(q, { type: "matrix-multiple", selections: { r1: ["a"], r2: ["a", "b"], r3: ["c"] } }).earned).toBe(2);
    expect(scoreQuestion(q, { type: "matrix-multiple", selections: { r1: ["b"] } }).earned).toBe(0);
  });
  it("zero-one per row requires exact row set", () => {
    const z = { ...q, scoringPolicy: "zero-one" as const };
    expect(maxPoints(z)).toBe(3);
    expect(scoreQuestion(z, { type: "matrix-multiple", selections: { r1: ["a"], r2: ["a"] } }).earned).toBe(2); // r1 + empty r3
  });
});

describe("dropdown", () => {
  const q: Q = {
    ...base,
    id: "d",
    dropdownFields: [
      { id: "f1", options: [{ id: "a", text: "a" }, { id: "b", text: "b" }] },
      { id: "f2", options: [{ id: "c", text: "c" }, { id: "d", text: "d" }] },
    ],
    answerKey: { type: "dropdown", values: { f1: "a", f2: "d" } },
    scoringPolicy: "zero-one",
  };
  it("scores each field independently", () => {
    expect(scoreQuestion(q, { type: "dropdown", values: { f1: "a", f2: "d" } })).toMatchObject({ earned: 2, outcome: "correct" });
    expect(scoreQuestion(q, { type: "dropdown", values: { f1: "a", f2: "c" } })).toMatchObject({ earned: 1, outcome: "partial" });
    expect(scoreQuestion(q, { type: "dropdown", values: { f2: "d" } }).earned).toBe(1);
    expect(scoreQuestion({ ...q, scoringPolicy: "dichotomous" }, { type: "dropdown", values: { f1: "a", f2: "c" } }).earned).toBe(0);
  });
});

describe("highlight", () => {
  const q: Q = { ...base, id: "h", answerKey: { type: "highlight", itemIds: ["a", "c"] }, scoringPolicy: "plus-minus" };
  it("plus-minus", () => {
    expect(scoreQuestion(q, { type: "highlight", itemIds: ["a", "c"] }).earned).toBe(2);
    expect(scoreQuestion(q, { type: "highlight", itemIds: ["a", "b"] }).earned).toBe(0);
    expect(scoreQuestion(q, { type: "highlight", itemIds: [] }).outcome).toBe("unanswered");
  });
});

describe("bowtie", () => {
  const q: Q = {
    ...base,
    id: "b",
    answerKey: { type: "bowtie", left: ["l1", "l2"], center: ["c1"], right: ["r1", "r2"] },
    scoringPolicy: "zero-one",
  };
  it("one point per correctly filled slot", () => {
    expect(maxPoints(q)).toBe(5);
    expect(scoreQuestion(q, { type: "bowtie", left: ["l2", "l1"], center: ["c1"], right: ["r1", "r2"] })).toMatchObject({ earned: 5, outcome: "correct" });
    expect(scoreQuestion(q, { type: "bowtie", left: ["l1", "x"], center: ["c2"], right: ["r2"] }).earned).toBe(2);
    expect(scoreQuestion({ ...q, scoringPolicy: "dichotomous" }, { type: "bowtie", left: ["l1", "x"], center: ["c1"], right: ["r1", "r2"] }).earned).toBe(0);
  });
});

describe("isAnswered", () => {
  it("handles every type", () => {
    expect(isAnswered({ type: "matrix-multiple", selections: { a: [] } })).toBe(false);
    expect(isAnswered({ type: "dropdown", values: { a: "" } })).toBe(false);
    expect(isAnswered({ type: "bowtie", left: [], center: ["x"], right: [] })).toBe(true);
  });
});

describe("summarise", () => {
  it("totals, percentage, category and case groups", () => {
    const s = summarise(
      [
        { questionId: "1", earned: 1, max: 1, outcome: "correct" },
        { questionId: "2", earned: 1, max: 3, outcome: "partial" },
        { questionId: "3", earned: 0, max: 2, outcome: "unanswered" },
      ],
      {
        "1": { category: "A", caseStudyId: null },
        "2": { category: "B", caseStudyId: "c", caseTitle: "Case" },
        "3": { category: "B", caseStudyId: "c", caseTitle: "Case" },
      },
    );
    expect(s).toMatchObject({ totalQuestions: 3, correct: 1, partial: 1, unanswered: 1, earned: 2, max: 6, percentage: 33.3 });
    expect(s.byCategory.map((g) => [g.label, g.questions])).toEqual([
      ["A", 1],
      ["B", 2],
    ]);
    expect(s.byCase[0]).toMatchObject({ label: "Case", questions: 2, earned: 1, max: 5 });
  });
});
