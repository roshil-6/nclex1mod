import { loadBank, type Bank } from "@/lib/question-bank/bank";
import { scoreQuestion, summarise } from "@/lib/scoring/score";
import type { Question, Response } from "@/lib/validation/schema";
import type { ExamResult, ExamTokenClaims, ScoredItem } from "@/types/exam";

export function gradeItem(q: Question, response: Response | undefined): ScoredItem {
  return {
    questionId: q.id,
    score: scoreQuestion(q, response),
    answerKey: q.answerKey,
    rationale: q.rationale,
    references: q.references,
    answerVerificationStatus: q.answerVerificationStatus,
  };
}

/** Server-side grading of a whole session against the structured answer keys. */
export function gradeSession(
  claims: ExamTokenClaims,
  responses: Record<string, Response>,
  bank: Bank = loadBank(),
): ExamResult {
  const byId = new Map(bank.questions.map((q) => [q.id, q]));
  const caseTitle = new Map(bank.cases.map((c) => [c.id, c.title]));
  const items: ScoredItem[] = [];
  const meta: Record<string, { category: string; caseStudyId: string | null; caseTitle?: string }> = {};
  for (const id of claims.qids) {
    const q = byId.get(id);
    if (!q) continue; // removed from bank after the session began; excluded from scoring
    items.push(gradeItem(q, responses[id]));
    meta[id] = {
      category: q.clinicalCategory,
      caseStudyId: q.caseStudyId,
      caseTitle: q.caseStudyId ? caseTitle.get(q.caseStudyId) : undefined,
    };
  }
  return {
    sessionId: claims.sid,
    bankVersion: claims.v,
    bankVersionAtScoring: bank.version,
    scoredAt: Date.now(),
    summary: summarise(
      items.map((i) => i.score),
      meta,
    ),
    items,
  };
}
