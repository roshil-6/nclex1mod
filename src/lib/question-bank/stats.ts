import { eligibleUnits, loadBank, questionEligibility, type Bank, type ExamUnit } from "@/lib/question-bank/bank";
import { FULL_EXAM_QUESTIONS } from "@/types/exam";

export { eligibleUnits, loadBank };

export interface PoolStats {
  bankVersion: string;
  totalQuestions: number;
  eligibleQuestions: number;
  pendingVerification: number;
  invalidRecords: number;
  fullExamRequired: number;
  fullExamAvailable: boolean;
  categories: { name: string; questions: number }[];
  cases: { id: string; title: string; parts: number; category: string }[];
  byOrigin: Record<string, number>;
  answerStatusCounts: Record<string, number>;
}

export function poolStats(bank: Bank, units: ExamUnit[]): PoolStats {
  const eligible = units.reduce((n, u) => n + u.questionIds.length, 0);
  const cat = new Map<string, number>();
  for (const u of units) cat.set(u.category, (cat.get(u.category) ?? 0) + u.questionIds.length);
  const byOrigin: Record<string, number> = {};
  const answerStatusCounts: Record<string, number> = {};
  for (const q of bank.questions) {
    byOrigin[q.origin] = (byOrigin[q.origin] ?? 0) + 1;
    answerStatusCounts[q.answerVerificationStatus] = (answerStatusCounts[q.answerVerificationStatus] ?? 0) + 1;
  }
  return {
    bankVersion: bank.version,
    totalQuestions: bank.questions.length,
    eligibleQuestions: eligible,
    pendingVerification: bank.questions.filter((q) => !questionEligibility(q, bank).eligible).length,
    invalidRecords: bank.invalid.length,
    fullExamRequired: FULL_EXAM_QUESTIONS,
    fullExamAvailable: eligible >= FULL_EXAM_QUESTIONS,
    categories: [...cat.entries()].map(([name, questions]) => ({ name, questions })).sort((a, b) => a.name.localeCompare(b.name)),
    cases: units
      .filter((u) => u.kind === "case")
      .map((u) => {
        const c = bank.cases.find((x) => x.id === u.id)!;
        return { id: c.id, title: c.title, parts: c.totalParts, category: c.clinicalCategory };
      }),
    byOrigin,
    answerStatusCounts,
  };
}
