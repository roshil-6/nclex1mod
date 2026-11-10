"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Panel, btnPrimary } from "@/components/ui/Shell";
import { deleteSession, listSessions } from "@/lib/session/store";
import { submitSession } from "@/lib/session/submit";
import { isAnswered } from "@/lib/scoring/score";
import { formatHHMM, isExpired, remainingMs } from "@/lib/timer/timer";
import type { ExamSession } from "@/types/exam";

/** Resume Examination + Previous Results, read from this device's IndexedDB. */
export function SessionHistory() {
  const [sessions, setSessions] = useState<ExamSession[] | null>(null);
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const all = await listSessions();
        // Time ran out while the exam was closed (or a submission was interrupted):
        // submit now so it appears under results, never as "Resume".
        const stale = all.filter((s) => s.status === "submitting" || (s.status === "active" && isExpired(s.deadline)));
        if (stale.length) {
          await Promise.allSettled(stale.map((s) => submitSession(s.id, { auto: true })));
          if (alive) setSessions(await listSessions());
        } else if (alive) setSessions(all);
      } catch {
        if (alive) setSessions([]);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);
  if (sessions === null) return null;
  const pendingSubmit = sessions.filter((s) => s.status === "submitting" || (s.status === "active" && isExpired(s.deadline)));
  const active = sessions.filter((s) => s.status === "active" && !isExpired(s.deadline));
  const done = sessions.filter((s) => s.status === "submitted" && s.result);

  return (
    <>
      {pendingSubmit.length > 0 ? (
        <Panel>
          <h2 className="mb-2 font-semibold">Submission pending</h2>
          <p className="mb-2 text-sm text-ink-soft">Time expired on these sessions, but they could not be submitted (check your connection).</p>
          <ul className="space-y-1 text-sm">
            {pendingSubmit.map((s) => (
              <li key={s.id}>
                <Link href={`/exam/${s.id}`} className="text-accent underline">
                  {s.title}: retry submission
                </Link>
              </li>
            ))}
          </ul>
        </Panel>
      ) : null}
      {active.length > 0 ? (
        <Panel>
          <h2 className="mb-3 font-semibold">Resume examination</h2>
          <ul className="divide-y divide-line">
            {active.map((s) => {
              const rem = remainingMs(s.deadline);
              const answered = s.questionIds.filter((id) => isAnswered(s.responses[id])).length;
              return (
                <li key={s.id} className="flex flex-wrap items-center gap-3 py-2">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{s.title}</p>
                    <p className="text-xs text-ink-soft">
                      {answered}/{s.questionIds.length} answered · {rem === null ? "untimed" : `${formatHHMM(rem)} remaining`} · started{" "}
                      {new Date(s.createdAt).toLocaleString()}
                    </p>
                  </div>
                  <Link href={`/exam/${s.id}`} className={btnPrimary}>
                    Resume Examination
                  </Link>
                </li>
              );
            })}
          </ul>
        </Panel>
      ) : null}
      <Panel>
        <h2 className="mb-3 font-semibold">Previous results</h2>
        {done.length === 0 ? (
          <p className="text-sm text-ink-soft">No completed sessions on this device yet.</p>
        ) : (
          <ul className="divide-y divide-line">
            {done.map((s) => (
              <li key={s.id} className="flex flex-wrap items-center gap-3 py-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{s.title}</p>
                  <p className="text-xs text-ink-soft">
                    {s.result!.summary.correct}/{s.result!.summary.totalQuestions} fully correct · {s.result!.summary.percentage}% of points ·{" "}
                    {new Date(s.submittedAt ?? s.createdAt).toLocaleString()}
                  </p>
                </div>
                <Link href={`/results/${s.id}`} className="text-sm text-accent underline">
                  View results
                </Link>
                <button
                  className="text-xs text-ink-faint hover:text-bad"
                  onClick={async () => {
                    if (!confirm("Delete this result from this device? This cannot be undone.")) return;
                    await deleteSession(s.id);
                    setSessions((xs) => xs?.filter((x) => x.id !== s.id) ?? null);
                  }}
                >
                  Delete
                </button>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </>
  );
}
