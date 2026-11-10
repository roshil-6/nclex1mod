"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Panel, Shell, btnPrimary, btnSecondary } from "@/components/ui/Shell";
import { loadSession } from "@/lib/session/store";
import { startExam } from "@/lib/session/start";
import { formatDuration } from "@/lib/timer/timer";
import type { GroupSummary } from "@/lib/scoring/score";
import type { ExamSession } from "@/types/exam";

function GroupTable({ title, rows }: { title: string; rows: GroupSummary[] }) {
  if (!rows.length) return null;
  return (
    <Panel>
      <h2 className="mb-3 font-semibold">{title}</h2>
      <div className="scroll-x">
        <table className="w-full min-w-[420px] text-sm">
          <thead>
            <tr className="border-b border-line text-left text-ink-soft">
              <th className="py-1.5 pr-2 font-semibold">{title.includes("Case") ? "Case study" : "Category"}</th>
              <th className="px-2 py-1.5 text-right font-semibold">Fully correct</th>
              <th className="px-2 py-1.5 text-right font-semibold">Points</th>
              <th className="py-1.5 pl-2 text-right font-semibold">%</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((g) => (
              <tr key={g.key} className="border-b border-line/60">
                <td className="py-1.5 pr-2">{g.label}</td>
                <td className="px-2 py-1.5 text-right tabular-nums">
                  {g.correct}/{g.questions}
                </td>
                <td className="px-2 py-1.5 text-right tabular-nums">
                  {g.earned}/{g.max}
                </td>
                <td className="py-1.5 pl-2 text-right tabular-nums">{g.max ? Math.round((g.earned / g.max) * 100) : 0}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}

export function ResultsView({ sessionId }: { sessionId: string }) {
  const router = useRouter();
  const [s, setS] = useState<ExamSession | null | undefined>(undefined);
  const [retaking, setRetaking] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    loadSession(sessionId).then((x) => setS(x ?? null));
  }, [sessionId]);

  if (s === undefined) return <Shell><p className="text-ink-soft">Loading results…</p></Shell>;
  if (!s || s.status !== "submitted" || !s.result)
    return (
      <Shell>
        <p className="mb-3">No submitted result was found for this session on this device.</p>
        {s ? (
          <Link className="text-accent underline" href={`/exam/${s.id}`}>
            Return to the examination
          </Link>
        ) : (
          <Link className="text-accent underline" href="/">
            Home
          </Link>
        )}
      </Shell>
    );

  const r = s.result.summary;
  const taken = (s.submittedAt ?? Date.now()) - s.createdAt;
  const authorReviewed = s.result.items.filter((i) => i.answerVerificationStatus === "author-reviewed").length;

  const retake = async () => {
    setRetaking(true);
    try {
      const id = await startExam(s.config);
      router.push(`/exam/${id}`);
    } catch (e) {
      setErr((e as Error).message);
      setRetaking(false);
    }
  };

  const stat = (label: string, value: React.ReactNode, testid?: string) => (
    <div className="rounded border border-line bg-surface p-3">
      <p className="text-xs uppercase tracking-wide text-ink-soft">{label}</p>
      <p className="text-xl font-semibold tabular-nums" data-testid={testid}>
        {value}
      </p>
    </div>
  );

  return (
    <Shell>
      <div className="space-y-5">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-accent">{s.title}</p>
          <h1 className="text-xl font-semibold">Results</h1>
          {s.autoSubmitted ? <p className="mt-1 text-sm text-warn">Submitted automatically when time expired.</p> : null}
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {stat("Total questions", r.totalQuestions, "res-total")}
          {stat("Fully correct", r.correct, "res-correct")}
          {stat("Partially correct", r.partial, "res-partial")}
          {stat("Incorrect", r.incorrect, "res-incorrect")}
          {stat("Unanswered", r.unanswered, "res-unanswered")}
          {stat("Score (points)", `${r.earned} / ${r.max}`, "res-points")}
          {stat("Percentage", `${r.percentage}%`, "res-pct")}
          {stat("Time taken", formatDuration(taken))}
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href={`/review/${s.id}`} className={btnPrimary}>
            Review Answers
          </Link>
          <button onClick={retake} disabled={retaking} className={btnSecondary}>
            {retaking ? "Preparing…" : "Retake Examination"}
          </button>
          <Link href="/" className={btnSecondary}>
            Home
          </Link>
        </div>
        {err ? <p className="text-sm text-bad">{err}</p> : null}
        <GroupTable title="Category performance" rows={r.byCategory} />
        <GroupTable title="Case-study performance" rows={r.byCase} />
        <Panel className="text-xs text-ink-soft">
          <p className="mb-1">
            <strong>How this was scored.</strong> Each item uses its configured policy: single-answer items 0/1; select-all and highlight
            items +/− (one point per correct selection, minus one per incorrect selection, never below zero); matrix, drop-down and bowtie
            items 0/1 per row, blank or slot. “Fully correct” means full points on the item. This is a practice scoring scheme, not an
            official NCLEX algorithm, and no pass/fail prediction is made.
          </p>
          {authorReviewed ? (
            <p>
              {authorReviewed} item(s) are original practice questions whose answer keys were checked by the content author but not yet
              signed off by a licensed nurse educator.
            </p>
          ) : null}
          {s.result.bankVersion !== s.result.bankVersionAtScoring ? (
            <p className="mt-1 text-warn">The question bank was updated during this attempt; scoring used the version current at submission.</p>
          ) : null}
        </Panel>
      </div>
    </Shell>
  );
}
