import fs from "node:fs";
import path from "node:path";
import { DATA_DIR, QUESTION_DIRS, invalidateBankCache, loadBank } from "@/lib/question-bank/bank";
import { QuestionSchema, type Question } from "@/lib/validation/schema";

export class WriteError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}

function writeJson(file: string, data: unknown) {
  try {
    fs.writeFileSync(file, JSON.stringify(data, null, 2) + "\n", "utf8");
  } catch (e) {
    throw new WriteError(
      `This deployment's file system is read-only (${(e as NodeJS.ErrnoException).code}). Edit locally or export the bank, commit the JSON and redeploy.`,
      503,
    );
  }
  invalidateBankCache();
}

/** Validate and persist one edited question. Moves it between origin folders if origin changed. */
export function saveQuestion(input: unknown): Question {
  const parsed = QuestionSchema.safeParse(input);
  if (!parsed.success) throw new WriteError(parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("\n"));
  const q = parsed.data;
  const bank = loadBank();
  const existing = bank.fileOf[q.id];
  const targetDir = QUESTION_DIRS[q.origin];

  if (existing) {
    const file = path.join(DATA_DIR, existing);
    const arr = JSON.parse(fs.readFileSync(file, "utf8")) as { id: string }[];
    const sameFolder = path.dirname(file) === targetDir;
    if (sameFolder) {
      writeJson(
        file,
        arr.map((x) => (x.id === q.id ? q : x)),
      );
      return q;
    }
    writeJson(
      file,
      arr.filter((x) => x.id !== q.id),
    );
  }
  const dest = path.join(targetDir, "admin-edits.json");
  const arr = fs.existsSync(dest) ? (JSON.parse(fs.readFileSync(dest, "utf8")) as { id: string }[]) : [];
  writeJson(dest, [...arr.filter((x) => x.id !== q.id), q]);
  return q;
}

export interface ImportReport {
  imported: string[];
  skipped: { id: string; reason: string }[];
}

/** Import an array of question records. Existing ids are skipped unless overwrite is set. */
export function importQuestions(items: unknown[], overwrite: boolean): ImportReport {
  const bank = loadBank();
  const report: ImportReport = { imported: [], skipped: [] };
  const byOrigin: Record<string, Question[]> = {};
  for (const item of items) {
    const id = (item as { id?: string })?.id ?? "?";
    const r = QuestionSchema.safeParse(item);
    if (!r.success) {
      report.skipped.push({ id, reason: r.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ") });
      continue;
    }
    if (bank.fileOf[id] && !overwrite) {
      report.skipped.push({ id, reason: "id already exists" });
      continue;
    }
    if (bank.fileOf[id] && overwrite) {
      saveQuestion(r.data);
      report.imported.push(id);
      continue;
    }
    (byOrigin[r.data.origin] ??= []).push(r.data);
    report.imported.push(id);
  }
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  for (const [origin, qs] of Object.entries(byOrigin)) {
    writeJson(path.join(QUESTION_DIRS[origin as keyof typeof QUESTION_DIRS], `import-${stamp}.json`), qs);
  }
  return report;
}
