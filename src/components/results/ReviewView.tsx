"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { QuestionView } from "@/components/exam/QuestionView";
import { QuestionNavigator } from "@/components/navigation/QuestionNavigator";
import { Feedback, OutcomeBadge } from "@/components/results/Feedback";
import { Shell, btnSecondary } from "@/components/ui/Shell";
import { loadSession } from "@/lib/session/store";
import type { ExamSession } from "@/types/exam";

const noop = () => undefined;

export function ReviewView({ sessionId }: { sessionId: string }) {
  const [s, setS] = useState<ExamSession | null | undefined>(undefined);
  const [idx, setIdx] = useState(0);
  const [view, setView] = useState<"yours" | "key">("yours");
  useEffect(() => {
    loadSession(sessionId).then((x) => setS(x ?? null));
  }, [sessionId]);

  if (s === undefined) return <Shell><p className="text-ink-soft">Loading…</p></Shell>;
  if (!s || !s.result)
    return (
      <Shell>
        <p>Review is available after the examination has been submitted.</p>
      </Shell>
    );

  const items = new Map(s.result.items.map((i) => [i.questionId, i]));
  const qById = new Map(s.questions.map((q) => [q.id, q]));
  const caseById = new Map(s.cases.map((c) => [c.id, c]));
  const qid = s.questionIds[idx];
  const q = qById.get(qid)!;
  const item = items.get(qid);
  const go = (i: number) => {
    setIdx(Math.max(0, Math.min(s.questionIds.length - 1, i)));
    window.scrollTo({ top: 0 });
  };

  return (
    <Shell wide>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="flex-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-accent">{s.title} · Answer review</p>
          <h1 className="text-lg font-semibold">
            Question <span data-testid="review-number">{idx + 1}</span> of {s.questionIds.length}
          </h1>
        </div>
        {item ? <OutcomeBadge outcome={item.score.outcome} /> : <span className="text-xs text-ink-faint">Not scored (removed from bank)</span>}
        <Link href={`/results/${s.id}`} className={btnSecondary}>
          Back to results
        </Link>
      </div>
      <div className="flex gap-6">
        <main className="min-w-0 flex-1 space-y-4">
          <div role="tablist" aria-label="Answer view" className="inline-flex rounded border border-line bg-surface p-0.5 text-sm">
            <button
              role="tab"
              aria-selected={view === "yours"}
              onClick={() => setView("yours")}
              className={`min-h-10 rounded px-3 ${view === "yours" ? "bg-accent text-white" : ""}`}
            >
              Your response (marked)
            </button>
            <button
              role="tab"
              aria-selected={view === "key"}
              onClick={() => setView("key")}
              className={`min-h-10 rounded px-3 ${view === "key" ? "bg-accent text-white" : ""}`}
            >
              Correct answer
            </button>
          </div>
          <div className="rounded border border-line bg-surface p-4 sm:p-6">
            <QuestionView
              key={`${qid}-${view}`}
              question={q}
              caseStudy={q.caseStudyId ? caseById.get(q.caseStudyId) : undefined}
              response={view === "yours" ? s.responses[qid] : item?.answerKey}
              answerKey={view === "yours" ? item?.answerKey : undefined}
              onChange={noop}
              disabled
            />
            {view === "yours" && !s.responses[qid] ? <p className="mt-3 text-sm text-bad">You did not answer this question.</p> : null}
          </div>
          {item ? <Feedback item={item} /> : null}
          <div className="flex justify-between">
            <button className={btnSecondary} disabled={idx === 0} onClick={() => go(idx - 1)}>
              ← Previous
            </button>
            <button className={btnSecondary} disabled={idx === s.questionIds.length - 1} onClick={() => go(idx + 1)}>
              Next →
            </button>
          </div>
        </main>
        <aside className="hidden w-64 shrink-0 lg:block">
          <div className="sticky top-4 rounded border border-line bg-surface p-4">
            <QuestionNavigator questionIds={s.questionIds} currentIndex={idx} responses={s.responses} flagged={s.flagged} onSelect={go} />
            <ul className="mt-3 space-y-0.5 text-xs">
              {s.questionIds.map((id, i) => {
                const it = items.get(id);
                return (
                  <li key={id} className="flex justify-between">
                    <span>Q{i + 1}</span>
                    <span className="tabular-nums text-ink-soft">{it ? `${it.score.earned}/${it.score.max}` : "—"}</span>
                  </li>
                );
              })}
            </ul>
          </div>
        </aside>
      </div>
    </Shell>
  );
}
