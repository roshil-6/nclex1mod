import type { AnswerKey, Question, Response, ScoringPolicy } from "@/lib/validation/schema";

/**
 * Scoring engine.
 *
 * Every item is broken into scoring "units" and a policy is applied:
 *
 *  - dichotomous: 1 point only if the whole response exactly matches the key, else 0. Max 1.
 *  - zero-one:    1 point per independent unit answered correctly (matrix row, dropdown field,
 *                 bowtie slot). No deductions. Max = number of units.
 *  - plus-minus:  +1 for every keyed selection chosen, −1 for every non-keyed selection chosen,
 *                 floored at 0 for the item. Max = number of keyed selections.
 *
 * These are this application's documented practice policies. They are modelled on publicly
 * described next-generation item scoring ideas but are NOT an official NCLEX algorithm.
 */

export interface QuestionScore {
  questionId: string;
  earned: number;
  max: number;
  /** "correct" = full marks, "partial" = some credit, "incorrect" = answered with 0, "unanswered". */
  outcome: "correct" | "partial" | "incorrect" | "unanswered";
}

const uniq = (xs: string[]) => Array.from(new Set(xs));

export function isAnswered(response: Response | undefined | null): boolean {
  if (!response) return false;
  switch (response.type) {
    case "single":
      return !!response.optionId;
    case "multiple":
      return response.optionIds.length > 0;
    case "matrix-single":
      return Object.values(response.selections).some(Boolean);
    case "matrix-multiple":
      return Object.values(response.selections).some((c) => c.length > 0);
    case "dropdown":
      return Object.values(response.values).some(Boolean);
    case "highlight":
      return response.itemIds.length > 0;
    case "bowtie":
      return response.left.length + response.center.length + response.right.length > 0;
  }
}

/** Plus/minus over a set of selections. */
function plusMinus(selected: string[], keyed: string[]) {
  const key = new Set(keyed);
  let pts = 0;
  for (const s of uniq(selected)) pts += key.has(s) ? 1 : -1;
  return { earned: Math.max(0, pts), max: key.size };
}

function setEquals(a: string[], b: string[]) {
  const A = new Set(a);
  const B = new Set(b);
  return A.size === B.size && [...A].every((x) => B.has(x));
}

/** Units: list of booleans "this unit is correct". */
function unitResults(question: Pick<Question, "matrixRows" | "dropdownFields">, r: Response, k: AnswerKey): boolean[] {
  switch (k.type) {
    case "matrix-single": {
      const sel = r.type === "matrix-single" ? r.selections : {};
      return question.matrixRows.map((row) => sel[row.id] !== undefined && sel[row.id] === k.selections[row.id]);
    }
    case "matrix-multiple": {
      const sel = r.type === "matrix-multiple" ? r.selections : {};
      return question.matrixRows.map((row) => setEquals(sel[row.id] ?? [], k.selections[row.id] ?? []));
    }
    case "dropdown": {
      const v = r.type === "dropdown" ? r.values : {};
      return question.dropdownFields.map((f) => v[f.id] !== undefined && v[f.id] === k.values[f.id]);
    }
    case "bowtie": {
      const out: boolean[] = [];
      for (const side of ["left", "center", "right"] as const) {
        const chosen = r.type === "bowtie" ? uniq(r[side]) : [];
        const key = new Set(k[side]);
        // one unit per keyed slot: credited if a chosen option fills it
        const hits = chosen.filter((c) => key.has(c)).length;
        for (let i = 0; i < k[side].length; i++) out.push(i < hits);
      }
      return out;
    }
    default:
      return [];
  }
}

function exactMatch(question: Pick<Question, "matrixRows" | "dropdownFields">, r: Response, k: AnswerKey): boolean {
  if (r.type !== k.type) return false;
  switch (k.type) {
    case "single":
      return r.type === "single" && r.optionId === k.optionId;
    case "multiple":
      return r.type === "multiple" && setEquals(r.optionIds, k.optionIds);
    case "highlight":
      return r.type === "highlight" && setEquals(r.itemIds, k.itemIds);
    case "matrix-multiple": {
      if (r.type !== "matrix-multiple") return false;
      // also require no stray selections on rows that are not part of the key
      return question.matrixRows.every((row) => setEquals(r.selections[row.id] ?? [], k.selections[row.id] ?? []));
    }
    case "bowtie":
      return (
        r.type === "bowtie" &&
        setEquals(r.left, k.left) &&
        setEquals(r.center, k.center) &&
        setEquals(r.right, k.right)
      );
    default:
      return unitResults(question, r, k).every(Boolean);
  }
}

export function maxPoints(question: Pick<Question, "answerKey" | "scoringPolicy" | "matrixRows" | "dropdownFields">): number {
  const { answerKey: k, scoringPolicy: p } = question;
  if (p === "dichotomous") return 1;
  switch (k.type) {
    case "multiple":
      return k.optionIds.length;
    case "highlight":
      return k.itemIds.length;
    case "matrix-multiple":
      return p === "plus-minus" ? Object.values(k.selections).flat().length : question.matrixRows.length;
    case "matrix-single":
      return question.matrixRows.length;
    case "dropdown":
      return question.dropdownFields.length;
    case "bowtie":
      return k.left.length + k.center.length + k.right.length;
    case "single":
      return 1;
  }
}

export function scoreQuestion(
  question: Pick<Question, "id" | "answerKey" | "scoringPolicy" | "matrixRows" | "dropdownFields">,
  response: Response | undefined | null,
): QuestionScore {
  const max = maxPoints(question);
  if (!isAnswered(response)) return { questionId: question.id, earned: 0, max, outcome: "unanswered" };
  const r = response as Response;
  const k = question.answerKey;
  const policy: ScoringPolicy = question.scoringPolicy;
  let earned = 0;

  if (r.type !== k.type) {
    earned = 0;
  } else if (policy === "dichotomous") {
    earned = exactMatch(question, r, k) ? 1 : 0;
  } else if (policy === "plus-minus") {
    if (k.type === "multiple" && r.type === "multiple") earned = plusMinus(r.optionIds, k.optionIds).earned;
    else if (k.type === "highlight" && r.type === "highlight") earned = plusMinus(r.itemIds, k.itemIds).earned;
    else if (k.type === "matrix-multiple" && r.type === "matrix-multiple") {
      const toCells = (s: Record<string, string[]>) =>
        Object.entries(s).flatMap(([row, cols]) => cols.map((c) => `${row}::${c}`));
      earned = plusMinus(toCells(r.selections), toCells(k.selections)).earned;
    } else {
      // policy not applicable to this type (schema prevents this); fall back to exact match
      earned = exactMatch(question, r, k) ? max : 0;
    }
  } else {
    // zero-one
    if (k.type === "single" || k.type === "multiple" || k.type === "highlight") {
      earned = exactMatch(question, r, k) ? max : 0;
    } else {
      earned = unitResults(question, r, k).filter(Boolean).length;
    }
  }

  earned = Math.min(max, Math.max(0, earned));
  const outcome = earned === max ? "correct" : earned > 0 ? "partial" : "incorrect";
  return { questionId: question.id, earned, max, outcome };
}

export interface GroupSummary {
  key: string;
  label: string;
  questions: number;
  correct: number;
  earned: number;
  max: number;
}

export interface ExamScoreSummary {
  totalQuestions: number;
  correct: number;
  partial: number;
  incorrect: number;
  unanswered: number;
  earned: number;
  max: number;
  percentage: number;
  byCategory: GroupSummary[];
  byCase: GroupSummary[];
}

export function summarise(
  scores: QuestionScore[],
  meta: Record<string, { category: string; caseStudyId: string | null; caseTitle?: string }>,
): ExamScoreSummary {
  const s: ExamScoreSummary = {
    totalQuestions: scores.length,
    correct: 0,
    partial: 0,
    incorrect: 0,
    unanswered: 0,
    earned: 0,
    max: 0,
    percentage: 0,
    byCategory: [],
    byCase: [],
  };
  const cat = new Map<string, GroupSummary>();
  const cases = new Map<string, GroupSummary>();
  const add = (m: Map<string, GroupSummary>, key: string, label: string, q: QuestionScore) => {
    const g = m.get(key) ?? { key, label, questions: 0, correct: 0, earned: 0, max: 0 };
    g.questions++;
    if (q.outcome === "correct") g.correct++;
    g.earned += q.earned;
    g.max += q.max;
    m.set(key, g);
  };
  for (const q of scores) {
    s[q.outcome]++;
    s.earned += q.earned;
    s.max += q.max;
    const m = meta[q.questionId];
    if (m) {
      add(cat, m.category, m.category, q);
      if (m.caseStudyId) add(cases, m.caseStudyId, m.caseTitle ?? m.caseStudyId, q);
    }
  }
  s.percentage = s.max ? Math.round((s.earned / s.max) * 1000) / 10 : 0;
  s.byCategory = [...cat.values()].sort((a, b) => a.label.localeCompare(b.label));
  s.byCase = [...cases.values()];
  return s;
}
