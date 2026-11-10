import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import {
  CaseStudySchema,
  QuestionSchema,
  type AnswerStatus,
  type CaseStudy,
  type PublicQuestion,
  type Question,
} from "@/lib/validation/schema";

/**
 * Server-only question bank access. Never import this module from a client component:
 * it contains answer keys.
 */

export const DATA_DIR = path.join(process.cwd(), "data");
export const QUESTION_DIRS = {
  original: path.join(DATA_DIR, "questions", "original"),
  extracted: path.join(DATA_DIR, "questions", "extracted"),
  pending: path.join(DATA_DIR, "questions", "pending"),
} as const;
export const CASE_DIR = path.join(DATA_DIR, "cases");

export interface InvalidRecord {
  file: string;
  id: string;
  errors: string[];
}

export interface Bank {
  version: string;
  questions: Question[];
  cases: CaseStudy[];
  invalid: InvalidRecord[];
  /** question id -> source file relative to data/ (for admin edits) */
  fileOf: Record<string, string>;
}

function jsonFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .sort()
    .map((f) => path.join(dir, f));
}

function readArray(file: string): unknown[] {
  const raw = JSON.parse(fs.readFileSync(file, "utf8"));
  return Array.isArray(raw) ? raw : [raw];
}

let cache: { stamp: string; bank: Bank } | null = null;

function stamp(): string {
  const files = [...Object.values(QUESTION_DIRS).flatMap(jsonFiles), ...jsonFiles(CASE_DIR)];
  return files
    .map((f) => {
      const s = fs.statSync(f);
      return `${f}:${s.mtimeMs}:${s.size}`;
    })
    .join("|");
}

const issues = (e: { issues: { path: (string | number)[]; message: string }[] }) =>
  e.issues.map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`);

export function loadBank(): Bank {
  const st = stamp();
  if (cache && cache.stamp === st) return cache.bank;

  const invalid: InvalidRecord[] = [];
  const questions: Question[] = [];
  const cases: CaseStudy[] = [];
  const fileOf: Record<string, string> = {};
  const hash = crypto.createHash("sha256");

  for (const file of jsonFiles(CASE_DIR)) {
    const rel = path.relative(DATA_DIR, file).replace(/\\/g, "/");
    for (const item of readArray(file)) {
      hash.update(JSON.stringify(item));
      const r = CaseStudySchema.safeParse(item);
      if (r.success) cases.push(r.data);
      else invalid.push({ file: rel, id: (item as { id?: string })?.id ?? "?", errors: issues(r.error) });
    }
  }

  for (const [origin, dir] of Object.entries(QUESTION_DIRS)) {
    for (const file of jsonFiles(dir)) {
      const rel = path.relative(DATA_DIR, file).replace(/\\/g, "/");
      for (const item of readArray(file)) {
        hash.update(JSON.stringify(item));
        const id = (item as { id?: string })?.id ?? "?";
        const r = QuestionSchema.safeParse(item);
        if (!r.success) {
          invalid.push({ file: rel, id, errors: issues(r.error) });
          continue;
        }
        if (r.data.origin !== origin) {
          invalid.push({ file: rel, id, errors: [`origin "${r.data.origin}" stored in ${origin}/ folder`] });
          continue;
        }
        if (fileOf[id]) {
          invalid.push({ file: rel, id, errors: [`duplicate id (also in ${fileOf[id]})`] });
          continue;
        }
        fileOf[id] = rel;
        questions.push(r.data);
      }
    }
  }

  const caseById = new Map(cases.map((c) => [c.id, c]));
  for (const q of questions) {
    if (!q.caseStudyId) continue;
    const c = caseById.get(q.caseStudyId);
    if (!c) invalid.push({ file: fileOf[q.id], id: q.id, errors: [`unknown caseStudyId ${q.caseStudyId}`] });
    else if ((q.caseStudyPart ?? 0) > c.totalParts)
      invalid.push({ file: fileOf[q.id], id: q.id, errors: [`caseStudyPart exceeds ${c.totalParts}`] });
  }

  const bank: Bank = { version: hash.digest("hex").slice(0, 12), questions, cases, invalid, fileOf };
  cache = { stamp: st, bank };
  return bank;
}

export function invalidateBankCache() {
  cache = null;
}

export function scoredAnswerStatuses(): AnswerStatus[] {
  const env = process.env.SCORED_ANSWER_STATUSES;
  if (env) return env.split(",").map((s) => s.trim()) as AnswerStatus[];
  return ["verified", "author-reviewed"];
}

export interface EligibilityReport {
  eligible: boolean;
  reasons: string[];
}

export function questionEligibility(q: Question, bank: Bank): EligibilityReport {
  const reasons: string[] = [];
  if (!q.enabled) reasons.push("disabled");
  if (q.origin === "pending") reasons.push("awaiting verification (pending folder)");
  if (q.contentVerificationStatus !== "verified") reasons.push(`content ${q.contentVerificationStatus}`);
  if (!scoredAnswerStatuses().includes(q.answerVerificationStatus)) reasons.push(`answer ${q.answerVerificationStatus}`);
  if (bank.invalid.some((i) => i.id === q.id)) reasons.push("failed validation");
  return { eligible: reasons.length === 0, reasons };
}

/** A unit is either a standalone question or a complete, fully-eligible case study. */
export interface ExamUnit {
  kind: "single" | "case";
  id: string;
  questionIds: string[];
  category: string;
}

export function eligibleUnits(bank: Bank): ExamUnit[] {
  const units: ExamUnit[] = [];
  const byCase = new Map<string, Question[]>();
  for (const q of bank.questions) {
    if (q.caseStudyId) {
      const arr = byCase.get(q.caseStudyId) ?? [];
      arr.push(q);
      byCase.set(q.caseStudyId, arr);
    } else if (questionEligibility(q, bank).eligible) {
      units.push({ kind: "single", id: q.id, questionIds: [q.id], category: q.clinicalCategory });
    }
  }
  for (const c of bank.cases) {
    const parts = (byCase.get(c.id) ?? []).sort((a, b) => (a.caseStudyPart ?? 0) - (b.caseStudyPart ?? 0));
    const complete =
      parts.length === c.totalParts &&
      parts.every((q, i) => q.caseStudyPart === i + 1 && questionEligibility(q, bank).eligible);
    if (complete) units.push({ kind: "case", id: c.id, questionIds: parts.map((q) => q.id), category: c.clinicalCategory });
  }
  return units;
}

export function toPublic(q: Question): PublicQuestion {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { answerKey, rationale, reviewNotes, references, ...rest } = q;
  return rest;
}
