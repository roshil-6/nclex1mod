import { eligibleUnits, loadBank, toPublic, type Bank, type ExamUnit } from "@/lib/question-bank/bank";
import { signToken, sessionSecret } from "@/lib/auth/token";
import {
  FULL_EXAM_MINUTES,
  FULL_EXAM_QUESTIONS,
  type ExamConfig,
  type ExamPlan,
  type ExamTokenClaims,
} from "@/types/exam";

export class PlanError extends Error {}

function shuffle<T>(xs: T[], rand: () => number = Math.random): T[] {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Pick whole units (case studies are never split) up to `target` questions.
 * Never repeats a question: if the pool is smaller than requested, the exam is shorter.
 */
export function pickUnits(units: ExamUnit[], target: number, rand: () => number = Math.random): ExamUnit[] {
  const chosen: ExamUnit[] = [];
  let n = 0;
  for (const u of shuffle(units, rand)) {
    if (n + u.questionIds.length <= target) {
      chosen.push(u);
      n += u.questionIds.length;
    }
    if (n === target) break;
  }
  return chosen;
}

export function poolSize(units: ExamUnit[]) {
  return units.reduce((n, u) => n + u.questionIds.length, 0);
}

export async function createPlan(config: ExamConfig, bank: Bank = loadBank()): Promise<ExamPlan> {
  let units = eligibleUnits(bank);
  let title: string;
  let target: number;
  let minutes: number;
  let feedback = false;

  switch (config.mode) {
    case "full": {
      const size = poolSize(units);
      if (size < FULL_EXAM_QUESTIONS)
        throw new PlanError(
          `Full mock examination needs ${FULL_EXAM_QUESTIONS} validated questions; only ${size} are available.`,
        );
      title = "Full Mock Examination";
      target = FULL_EXAM_QUESTIONS;
      minutes = FULL_EXAM_MINUTES;
      break;
    }
    case "quick": {
      title = "Quick Practice";
      target = Math.min(Math.max(config.count ?? 10, 1), 30);
      minutes = config.timeLimitMinutes ?? Math.max(10, target * 2);
      feedback = !!config.immediateFeedback;
      break;
    }
    case "case": {
      units = units.filter((u) => u.kind === "case");
      if (config.caseStudyId) units = units.filter((u) => u.id === config.caseStudyId);
      if (units.length === 0) throw new PlanError("No validated case study is available.");
      units = [shuffle(units)[0]];
      const c = bank.cases.find((x) => x.id === units[0].id)!;
      title = `Case Study Practice — ${c.title}`;
      target = units[0].questionIds.length;
      minutes = config.timeLimitMinutes ?? 30;
      feedback = !!config.immediateFeedback;
      break;
    }
    case "custom": {
      if (config.categories?.length) units = units.filter((u) => config.categories!.includes(u.category));
      title = "Custom Practice";
      target = Math.min(Math.max(config.count ?? 20, 1), FULL_EXAM_QUESTIONS);
      minutes = Math.min(Math.max(config.timeLimitMinutes ?? 0, 0), FULL_EXAM_MINUTES);
      feedback = !!config.immediateFeedback;
      break;
    }
    default:
      throw new PlanError("Unknown mode");
  }

  const chosen = config.mode === "case" ? units : pickUnits(units, target);
  const questionIds = chosen.flatMap((u) => u.questionIds);
  if (questionIds.length === 0) throw new PlanError("No validated questions match this configuration.");

  const sessionId = crypto.randomUUID();
  const claims: ExamTokenClaims = {
    sid: sessionId,
    mode: config.mode,
    qids: questionIds,
    fb: feedback,
    v: bank.version,
    iat: Date.now(),
  };
  const token = await signToken(claims, sessionSecret());
  const byId = new Map(bank.questions.map((q) => [q.id, q]));
  const caseIds = new Set(chosen.filter((u) => u.kind === "case").map((u) => u.id));

  return {
    sessionId,
    mode: config.mode,
    title,
    bankVersion: bank.version,
    questionIds,
    durationSec: minutes > 0 ? minutes * 60 : null,
    immediateFeedback: feedback,
    token,
    questions: questionIds.map((id) => toPublic(byId.get(id)!)),
    cases: bank.cases.filter((c) => caseIds.has(c.id)),
  };
}
