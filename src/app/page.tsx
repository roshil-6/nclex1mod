import Link from "next/link";
import { Panel, Shell, btnPrimary, btnSecondary } from "@/components/ui/Shell";
import { SessionHistory } from "@/components/results/SessionHistory";
import { eligibleUnits, loadBank, poolStats } from "@/lib/question-bank/stats";

export const dynamic = "force-dynamic";

export default function Home() {
  const bank = loadBank();
  const stats = poolStats(bank, eligibleUnits(bank));
  return (
    <Shell>
      <div className="space-y-5">
        <Panel>
          <h1 className="mb-2 text-2xl font-semibold tracking-tight">Clinical Mock Exam</h1>
          <p className="mb-1 text-ink-soft">
            Timed nursing mock examinations and clinical-judgement practice: multiple choice, select-all-that-apply, matrix,
            drop-down, highlight and bowtie items, plus multi-part case studies with clinical record tabs.
          </p>
          <p className="mb-4 text-sm text-ink-faint">
            {stats.eligibleQuestions} validated questions available · {stats.cases.length} complete case studies. Progress is saved on
            this device automatically.
          </p>
          <div className="flex flex-wrap gap-2">
            <Link href="/setup?mode=full" className={btnPrimary} aria-describedby={stats.fullExamAvailable ? undefined : "full-note"}>
              Start Mock Exam
            </Link>
            <Link href="/setup?mode=quick" className={btnSecondary}>
              Quick Practice
            </Link>
            <Link href="/setup?mode=case" className={btnSecondary}>
              Case Study Practice
            </Link>
            <Link href="/setup?mode=custom" className={btnSecondary}>
              Custom Practice
            </Link>
          </div>
          {!stats.fullExamAvailable ? (
            <p id="full-note" className="mt-3 text-xs text-ink-faint">
              The full 150-question, 5-hour mock examination unlocks when {stats.fullExamRequired} validated questions exist (currently{" "}
              {stats.eligibleQuestions}). Questions are never duplicated to fill an exam.
            </p>
          ) : null}
        </Panel>
        <SessionHistory />
        <p className="text-center text-xs text-ink-faint">
          Practice tool only. Scores use this application&apos;s documented scoring policies and do not predict an official NCLEX
          pass/fail outcome.
        </p>
      </div>
    </Shell>
  );
}
