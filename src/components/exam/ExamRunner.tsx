"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { QuestionView } from "@/components/exam/QuestionView";
import { QuestionNavigator } from "@/components/navigation/QuestionNavigator";
import { Feedback } from "@/components/results/Feedback";
import { isAnswered } from "@/lib/scoring/score";
import { loadSession, updateSession } from "@/lib/session/store";
import { submitSession } from "@/lib/session/submit";
import { formatHHMM, isExpired, remainingMs } from "@/lib/timer/timer";
import type { Response } from "@/lib/validation/schema";
import type { ExamSession, ScoredItem } from "@/types/exam";

export function ExamRunner({ sessionId }: { sessionId: string }) {
  const router = useRouter();
  const [session, setSession] = useState<ExamSession | null | undefined>(undefined);
  const [now, setNow] = useState(() => Date.now());
  const [navOpen, setNavOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const [saved, setSaved] = useState<"idle" | "saving" | "saved">("idle");
  const submittingRef = useRef(false);

  // Load persisted session
  useEffect(() => {
    let alive = true;
    loadSession(sessionId).then((s) => {
      if (!alive) return;
      if (s?.status === "submitted") router.replace(`/results/${sessionId}`);
      setSession(s ?? null);
    });
    return () => {
      alive = false;
    };
  }, [sessionId, router]);

  // Clock tick: only drives re-render; remaining time is derived from the persisted deadline.
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    const vis = () => setNow(Date.now());
    document.addEventListener("visibilitychange", vis);
    return () => {
      clearInterval(t);
      document.removeEventListener("visibilitychange", vis);
    };
  }, []);

  const doSubmit = useCallback(
    async (auto: boolean) => {
      if (submittingRef.current) return;
      submittingRef.current = true;
      setSubmitError(null);
      setSession((s) => (s ? { ...s, status: "submitting" } : s));
      try {
        const done = await submitSession(sessionId, { auto });
        if (done?.status === "submitted") router.replace(`/results/${sessionId}`);
      } catch (e) {
        setSubmitError((e as Error).message);
        submittingRef.current = false;
      }
    },
    [sessionId, router],
  );

  const expired = session ? isExpired(session.deadline, now) : false;
  const locked = !session || session.status !== "active" || expired;

  // Auto-submit on expiry, or resume an interrupted submission.
  useEffect(() => {
    if (!session) return;
    if (session.status === "submitting" || (session.status === "active" && expired)) void doSubmit(expired);
  }, [session, expired, doSubmit]);

  const caseById = useMemo(() => new Map((session?.cases ?? []).map((c) => [c.id, c])), [session?.cases]);
  const qById = useMemo(() => new Map((session?.questions ?? []).map((q) => [q.id, q])), [session?.questions]);

  const persist = useCallback(
    (mutate: (s: ExamSession) => ExamSession | null) => {
      setSaved("saving");
      setSession((s) => (s ? (mutate(s) ?? s) : s));
      updateSession(sessionId, mutate).then(() => setSaved("saved"));
    },
    [sessionId],
  );

  if (session === undefined) return <p className="p-6 text-ink-soft">Loading examination…</p>;
  if (session === null)
    return (
      <div className="mx-auto max-w-xl p-6">
        <p className="mb-4">This examination session was not found on this device.</p>
        <Link className="text-accent underline" href="/">
          Return to home
        </Link>
      </div>
    );

  const total = session.questionIds.length;
  const idx = Math.min(session.currentIndex, total - 1);
  const qid = session.questionIds[idx];
  const question = qById.get(qid)!;
  const checked: ScoredItem | undefined = session.checked[qid];
  const answeredCount = session.questionIds.filter((id) => isAnswered(session.responses[id])).length;
  const flagged = session.flagged.includes(qid);
  const remaining = remainingMs(session.deadline, now);
  const lowTime = remaining !== null && remaining < 5 * 60 * 1000;

  const onChange = (r: Response) => {
    if (locked || checked) return;
    if (session.deadline !== null && Date.now() >= session.deadline) return;
    persist((s) => (s.status !== "active" || s.checked[qid] ? null : { ...s, responses: { ...s.responses, [qid]: r } }));
  };
  const goTo = (i: number) => {
    const n = Math.max(0, Math.min(total - 1, i));
    persist((s) => ({ ...s, currentIndex: n }));
    setNavOpen(false);
    window.scrollTo({ top: 0 });
  };
  const toggleFlag = () =>
    persist((s) => ({
      ...s,
      flagged: s.flagged.includes(qid) ? s.flagged.filter((x) => x !== qid) : [...s.flagged, qid],
    }));

  const checkAnswer = async () => {
    const resp = session.responses[qid];
    if (!resp || !isAnswered(resp)) return;
    setChecking(true);
    try {
      const res = await fetch("/api/check", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token: session.token, questionId: qid, response: resp }),
      });
      if (res.ok) {
        const item = (await res.json()) as ScoredItem;
        persist((s) => ({ ...s, checked: { ...s.checked, [qid]: item } }));
      }
    } finally {
      setChecking(false);
    }
  };

  const groupLabel = (i: number) => {
    const q = qById.get(session.questionIds[i]);
    if (!q?.caseStudyId) return null;
    return `Case study part ${q.caseStudyPart} of ${caseById.get(q.caseStudyId)?.totalParts ?? "?"}`;
  };

  const unanswered = total - answeredCount;

  return (
    <div className="flex min-h-screen flex-col">
      {/* Top bar */}
      <header className="sticky top-0 z-20 border-b border-line bg-surface">
        <div className="mx-auto flex max-w-6xl items-center gap-2 px-3 py-2 sm:gap-4 sm:px-4">
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-semibold uppercase tracking-wide text-accent">{session.title}</p>
            <p className="text-sm">
              Question <strong data-testid="q-number">{idx + 1}</strong> of <span data-testid="q-total">{total}</span>
              <span className="ml-2 hidden text-xs text-ink-faint sm:inline">
                {session.immediateFeedback ? "Practice mode · feedback on" : session.mode === "full" ? "Examination mode" : "Practice mode · no feedback"}
              </span>
            </p>
          </div>
          {remaining !== null ? (
            <div
              className={`rounded border px-2.5 py-1 font-mono text-base font-semibold tabular-nums ${
                lowTime ? "border-bad bg-bad-soft text-bad" : "border-line bg-page"
              }`}
              aria-label="Time remaining (hours:minutes)"
              title="Time remaining (hours:minutes)"
              data-testid="timer"
              role="timer"
            >
              {formatHHMM(remaining)}
            </div>
          ) : (
            <div className="rounded border border-line bg-page px-2.5 py-1 text-xs text-ink-soft">Untimed</div>
          )}
          <button
            type="button"
            onClick={toggleFlag}
            disabled={locked}
            aria-pressed={flagged}
            aria-label={flagged ? "Flagged for review" : "Mark for review"}
            className={`min-h-10 rounded border px-2.5 py-1.5 text-sm sm:px-3 ${flagged ? "border-warn bg-warn-soft text-warn" : "border-line hover:border-line-strong"}`}
          >
            ⚑ {flagged ? "Flagged" : <><span className="sm:hidden">Flag</span><span className="hidden sm:inline">Mark for review</span></>}
          </button>
          <button
            type="button"
            onClick={() => setConfirming(true)}
            disabled={locked}
            aria-label="Finish examination"
            className="min-h-10 rounded border border-accent px-2.5 py-1.5 text-sm font-semibold text-accent hover:bg-accent-soft sm:px-3"
          >
            <span className="sm:hidden">Finish</span>
            <span className="hidden sm:inline">Finish examination</span>
          </button>
        </div>
        <div className="h-1 bg-page" aria-hidden>
          <div className="h-1 bg-accent transition-[width]" style={{ width: `${(answeredCount / total) * 100}%` }} />
        </div>
        <p className="sr-only" aria-live="polite">
          {answeredCount} of {total} answered
        </p>
      </header>

      {session.status !== "active" || expired ? (
        <div className="border-b border-warn bg-warn-soft px-4 py-2 text-center text-sm text-warn" role="status">
          {expired ? "Time has expired. Answers are locked and your examination is being submitted." : "Submitting your examination…"}
          {submitError ? (
            <>
              {" "}
              {submitError}.{" "}
              <button className="font-semibold underline" onClick={() => doSubmit(expired)}>
                Retry
              </button>
            </>
          ) : null}
        </div>
      ) : null}

      <div className="mx-auto flex w-full max-w-6xl flex-1 gap-6 px-3 py-4 sm:px-4">
        <main className="min-w-0 flex-1 rounded border border-line bg-surface p-4 sm:p-6">
          <QuestionView
            key={qid}
            question={question}
            caseStudy={question.caseStudyId ? caseById.get(question.caseStudyId) : undefined}
            response={session.responses[qid]}
            onChange={onChange}
            disabled={locked || !!checked}
            answerKey={checked?.answerKey}
          />
          {checked ? <Feedback item={checked} className="mt-6" /> : null}
        </main>
        <aside className="hidden w-64 shrink-0 lg:block">
          <div className="sticky top-24 rounded border border-line bg-surface p-4">
            <QuestionNavigator
              questionIds={session.questionIds}
              currentIndex={idx}
              responses={session.responses}
              flagged={session.flagged}
              onSelect={goTo}
              groupLabel={groupLabel}
            />
          </div>
        </aside>
      </div>

      {/* Bottom navigation */}
      <footer className="sticky bottom-0 z-20 border-t border-line bg-surface/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-2 px-3 py-2 sm:px-4">
          <button
            type="button"
            onClick={() => goTo(idx - 1)}
            disabled={idx === 0}
            className="min-h-11 rounded border border-line px-4 text-sm disabled:opacity-40"
          >
            ← Previous
          </button>
          <button
            type="button"
            onClick={() => setNavOpen((v) => !v)}
            className="min-h-11 rounded border border-line px-3 text-sm lg:hidden"
            aria-expanded={navOpen}
          >
            Questions
          </button>
          <span className="ml-1 hidden text-xs text-ink-faint sm:inline" aria-live="polite">
            {saved === "saving" ? "Saving…" : saved === "saved" ? "All answers saved" : ""}
          </span>
          <div className="ml-auto flex gap-2">
            {session.immediateFeedback && !checked ? (
              <button
                type="button"
                onClick={checkAnswer}
                disabled={locked || checking || !isAnswered(session.responses[qid])}
                className="min-h-11 rounded border border-accent px-4 text-sm font-semibold text-accent disabled:opacity-40"
              >
                {checking ? "Checking…" : "Submit answer"}
              </button>
            ) : null}
            {idx < total - 1 ? (
              <button
                type="button"
                onClick={() => goTo(idx + 1)}
                className="min-h-11 rounded bg-accent px-5 text-sm font-semibold text-white hover:bg-accent-strong"
              >
                Next →
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setConfirming(true)}
                disabled={locked}
                className="min-h-11 rounded bg-accent px-5 text-sm font-semibold text-white hover:bg-accent-strong disabled:opacity-40"
              >
                Finish
              </button>
            )}
          </div>
        </div>
      </footer>

      {/* Mobile navigator drawer */}
      {navOpen ? (
        <div className="fixed inset-0 z-30 bg-ink/30 lg:hidden" onClick={() => setNavOpen(false)}>
          <div
            className="absolute inset-x-0 bottom-0 max-h-[75vh] overflow-y-auto rounded-t-lg border-t border-line bg-surface p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-semibold">Questions</h2>
              <button className="min-h-11 px-3 text-sm text-accent" onClick={() => setNavOpen(false)}>
                Close
              </button>
            </div>
            <QuestionNavigator
              questionIds={session.questionIds}
              currentIndex={idx}
              responses={session.responses}
              flagged={session.flagged}
              onSelect={goTo}
              groupLabel={groupLabel}
            />
          </div>
        </div>
      ) : null}

      {/* Finish confirmation */}
      {confirming ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-ink/40 p-4" role="dialog" aria-modal="true" aria-labelledby="finish-title">
          <div className="w-full max-w-md rounded border border-line bg-surface p-5">
            <h2 id="finish-title" className="mb-2 text-lg font-semibold">
              Finish examination?
            </h2>
            <p className="mb-1 text-sm">
              You have answered {answeredCount} of {total} questions.
            </p>
            {unanswered > 0 ? <p className="mb-1 text-sm text-bad">{unanswered} unanswered question(s) will score zero.</p> : null}
            {session.flagged.length > 0 ? <p className="mb-1 text-sm text-warn">{session.flagged.length} question(s) are flagged for review.</p> : null}
            <p className="mb-4 text-sm text-ink-soft">After submission your answers cannot be changed.</p>
            <div className="flex justify-end gap-2">
              <button className="min-h-11 rounded border border-line px-4 text-sm" onClick={() => setConfirming(false)}>
                Return to examination
              </button>
              <button
                className="min-h-11 rounded bg-accent px-4 text-sm font-semibold text-white"
                onClick={() => {
                  setConfirming(false);
                  void doSubmit(false);
                }}
              >
                Submit examination
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
