/**
 * Validates every question and case-study record against the Zod schemas and reports
 * eligibility for scored exams. Exits non-zero if any record is invalid (blocks `npm run build`).
 *   npm run validate
 */
import { eligibleUnits, loadBank, questionEligibility } from "../../src/lib/question-bank/bank";

const bank = loadBank();
const units = eligibleUnits(bank);
const eligible = units.reduce((n, u) => n + u.questionIds.length, 0);
const byType: Record<string, number> = {};
for (const q of bank.questions) byType[q.questionType] = (byType[q.questionType] ?? 0) + 1;

console.log(`Question bank version ${bank.version}`);
console.log(`  questions: ${bank.questions.length}  case studies: ${bank.cases.length}`);
console.log(`  by type: ${JSON.stringify(byType)}`);
console.log(`  scored-eligible questions: ${eligible} (${units.filter((u) => u.kind === "case").length} complete case studies)`);
const held = bank.questions.filter((q) => !questionEligibility(q, bank).eligible);
for (const q of held) console.log(`  held back ${q.id}: ${questionEligibility(q, bank).reasons.join(", ")}`);

for (const c of bank.cases) {
  const parts = bank.questions.filter((q) => q.caseStudyId === c.id).map((q) => q.caseStudyPart!).sort((a, b) => a - b);
  const expected = Array.from({ length: c.totalParts }, (_, i) => i + 1);
  if (JSON.stringify(parts) !== JSON.stringify(expected))
    bank.invalid.push({ file: "cases", id: c.id, errors: [`parts present ${JSON.stringify(parts)}, expected ${JSON.stringify(expected)}`] });
}

if (bank.invalid.length) {
  console.error(`\n${bank.invalid.length} invalid record(s):`);
  for (const i of bank.invalid) console.error(`  ${i.file} ${i.id}\n    - ${i.errors.join("\n    - ")}`);
  process.exit(1);
}
console.log("All records valid.");
