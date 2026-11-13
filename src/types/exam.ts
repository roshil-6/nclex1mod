import type { AnswerKey, AnswerStatus, CaseStudy, PublicQuestion, Response } from "@/lib/validation/schema";
import type { ExamScoreSummary, QuestionScore } from "@/lib/scoring/score";

export type ExamMode = "full" | "quick" | "case" | "custom";

export const FULL_EXAM_QUESTIONS = 150;
export const FULL_EXAM_MINUTES = 300;
/** Standard length of one practice sitting. */
export const SITTING_QUESTIONS = 50;

export interface ExamConfig {
  mode: ExamMode;
  /** Requested number of questions (case studies are never split, so actual may be lower). */
  count?: number;
  /** Minutes; 0 = untimed (practice only). */
  timeLimitMinutes?: number;
  categories?: string[];
  caseStudyId?: string;
  immediateFeedback?: boolean;
}

export interface ExamPlan {
  sessionId: string;
  mode: ExamMode;
  title: string;
  bankVersion: string;
  questionIds: string[];
  durationSec: number | null;
  immediateFeedback: boolean;
  token: string;
  questions: PublicQuestion[];
  cases: CaseStudy[];
}

export interface ExamTokenClaims {
  sid: string;
  mode: ExamMode;
  qids: string[];
  fb: boolean;
  v: string;
  iat: number;
}

export interface ScoredItem {
  questionId: string;
  score: QuestionScore;
  answerKey: AnswerKey;
  rationale: string;
  references: string[];
  answerVerificationStatus: AnswerStatus;
}

export interface ExamResult {
  sessionId: string;
  bankVersion: string;
  bankVersionAtScoring: string;
  scoredAt: number;
  summary: ExamScoreSummary;
  items: ScoredItem[];
}

export type SessionStatus = "active" | "submitting" | "submitted";

/** Persisted in IndexedDB on the student's device. */
export interface ExamSession {
  id: string;
  mode: ExamMode;
  /** Configuration used to create this session (used for "Retake"). */
  config: ExamConfig;
  title: string;
  bankVersion: string;
  token: string;
  questionIds: string[];
  /** Snapshot of delivered (key-less) content so later bank edits cannot alter this attempt. */
  questions: PublicQuestion[];
  cases: CaseStudy[];
  immediateFeedback: boolean;
  createdAt: number;
  durationSec: number | null;
  /** Absolute epoch ms deadline; null = untimed */
  deadline: number | null;
  currentIndex: number;
  responses: Record<string, Response>;
  flagged: string[];
  /** Practice-mode answers that were checked (locked) with their feedback */
  checked: Record<string, ScoredItem>;
  status: SessionStatus;
  submittedAt: number | null;
  autoSubmitted: boolean;
  result: ExamResult | null;
}
