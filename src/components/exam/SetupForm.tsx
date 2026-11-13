"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Panel, btnPrimary } from "@/components/ui/Shell";
import { startExam } from "@/lib/session/start";
import type { PoolStats } from "@/lib/question-bank/stats";
import { FULL_EXAM_MINUTES, FULL_EXAM_QUESTIONS, SITTING_QUESTIONS, type ExamConfig, type ExamMode } from "@/types/exam";

const MODES: { id: ExamMode; label: string; blurb: string }[] = [
  { id: "full", label: "Full Mock Examination", blurb: `${FULL_EXAM_QUESTIONS} questions · 5-hour countdown · examination mode` },
  { id: "quick", label: "Quick Practice", blurb: "A short timed set from the validated pool" },
  { id: "case", label: "Case Study Practice", blurb: "One complete multi-part clinical case study" },
  { id: "custom", label: "Custom Practice", blurb: "Choose length, time limit, categories and feedback" },
];

export function SetupForm({ initialMode, stats }: { initialMode: ExamMode; stats: PoolStats }) {
  const router = useRouter();
  const [mode, setMode] = useState<ExamMode>(initialMode);
  const [count, setCount] = useState(SITTING_QUESTIONS);
  const [customCount, setCustomCount] = useState(Math.min(SITTING_QUESTIONS, stats.eligibleQuestions || 1));
  const [minutes, setMinutes] = useState(30);
  const [categories, setCategories] = useState<string[]>([]);
  const [caseId, setCaseId] = useState<string>("");
  const [feedback, setFeedback] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pool = categories.length
    ? stats.categories.filter((c) => categories.includes(c.name)).reduce((n, c) => n + c.questions, 0)
    : stats.eligibleQuestions;

  const config = (): ExamConfig => {
    switch (mode) {
      case "full":
        return { mode };
      case "quick":
        return { mode, count, timeLimitMinutes: Math.max(10, count * 2), immediateFeedback: feedback };
      case "case":
        return { mode, caseStudyId: caseId || undefined, timeLimitMinutes: minutes, immediateFeedback: feedback };
      case "custom":
        return { mode, count: customCount, timeLimitMinutes: minutes, categories, immediateFeedback: feedback };
    }
  };

  const start = async () => {
    setBusy(true);
    setError(null);
    try {
      const id = await startExam(config());
      router.push(`/exam/${id}`);
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  };

  const fullBlocked = mode === "full" && !stats.fullExamAvailable;
  const caseBlocked = mode === "case" && stats.cases.length === 0;

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-semibold">Examination setup</h1>
      <Panel>
        <fieldset>
          <legend className="mb-3 text-sm font-semibold text-ink-soft">Session type</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {MODES.map((m) => (
              <label
                key={m.id}
                className={`flex cursor-pointer gap-3 rounded border p-3 ${mode === m.id ? "border-accent bg-accent-soft" : "border-line"}`}
              >
                <input type="radio" name="mode" checked={mode === m.id} onChange={() => setMode(m.id)} className="mt-1 h-4 w-4 accent-accent" />
                <span>
                  <span className="block text-sm font-semibold">{m.label}</span>
                  <span className="block text-xs text-ink-soft">{m.blurb}</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>
      </Panel>

      <Panel>
        <p className="mb-3 text-sm">
          <strong data-testid="available-count">{stats.eligibleQuestions}</strong> validated questions available
          {stats.pendingVerification ? <span className="text-ink-faint"> · {stats.pendingVerification} held back pending verification</span> : null}
        </p>

        {mode === "full" ? (
          <div className="space-y-2 text-sm">
            <p>
              {FULL_EXAM_QUESTIONS} questions, {FULL_EXAM_MINUTES / 60}-hour countdown shown as HH:MM. No answers are revealed until you
              submit. When time expires your answers are locked and submitted automatically.
            </p>
            {fullBlocked ? (
              <p className="rounded border border-warn bg-warn-soft p-3 text-warn" role="status">
                Not yet available: the full mock examination requires {FULL_EXAM_QUESTIONS} validated questions and only{" "}
                {stats.eligibleQuestions} exist. Questions are never repeated to make up the number. Use Quick, Case Study or Custom
                Practice meanwhile.
              </p>
            ) : null}
          </div>
        ) : null}

        {mode === "quick" ? (
          <div className="space-y-3 text-sm">
            <div>
              <label htmlFor="quick-count" className="mb-1 block font-medium">Number of questions</label>
              <select id="quick-count" value={count} onChange={(e) => setCount(Number(e.target.value))} className="min-h-11 rounded border border-line-strong px-2">
                {[10, 20, 30, SITTING_QUESTIONS].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </div>
            <p className="text-ink-soft">
              Time limit: {Math.max(10, count * 2)} minutes. Case studies are kept whole, so the set may be slightly shorter than requested.
            </p>
          </div>
        ) : null}

        {mode === "case" ? (
          <div className="space-y-3 text-sm">
            <div>
              <label htmlFor="case-select" className="mb-1 block font-medium">Case study</label>
              <select id="case-select" value={caseId} onChange={(e) => setCaseId(e.target.value)} className="min-h-11 w-full rounded border border-line-strong px-2">
                <option value="">Random case study</option>
                {stats.cases.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.title} ({c.parts} parts)
                  </option>
                ))}
              </select>
            </div>
            <MinutesField minutes={minutes} setMinutes={setMinutes} allowUntimed />
          </div>
        ) : null}

        {mode === "custom" ? (
          <div className="space-y-4 text-sm">
            <div>
              <label htmlFor="custom-count" className="mb-1 block font-medium">Number of questions (max {pool})</label>
              <input
                id="custom-count"
                type="number"
                min={1}
                max={Math.max(1, pool)}
                value={customCount}
                onChange={(e) => setCustomCount(Math.max(1, Math.min(pool || 1, Number(e.target.value) || 1)))}
                className="min-h-11 w-28 rounded border border-line-strong px-2"
              />
            </div>
            <MinutesField minutes={minutes} setMinutes={setMinutes} allowUntimed />
            <fieldset>
              <legend className="mb-1 font-medium">Categories (none selected = all)</legend>
              <div className="grid gap-1 sm:grid-cols-2">
                {stats.categories.map((c) => (
                  <label key={c.name} className="flex min-h-9 items-center gap-2">
                    <input
                      type="checkbox"
                      className="h-4 w-4 accent-accent"
                      checked={categories.includes(c.name)}
                      onChange={() => setCategories((xs) => (xs.includes(c.name) ? xs.filter((x) => x !== c.name) : [...xs, c.name]))}
                    />
                    {c.name} <span className="text-ink-faint">({c.questions})</span>
                  </label>
                ))}
              </div>
            </fieldset>
          </div>
        ) : null}

        {mode !== "full" ? (
          <label className="mt-4 flex items-start gap-2 text-sm">
            <input type="checkbox" checked={feedback} onChange={(e) => setFeedback(e.target.checked)} className="mt-0.5 h-4 w-4 accent-accent" />
            <span>
              <span className="font-medium">Immediate feedback (practice mode)</span>
              <span className="block text-ink-soft">
                Adds a “Submit answer” button that locks the question and shows the correct answer and rationale. Leave off for
                examination-style practice.
              </span>
            </span>
          </label>
        ) : null}
      </Panel>

      {error ? (
        <p className="rounded border border-bad bg-bad-soft p-3 text-sm text-bad" role="alert">
          {error}
        </p>
      ) : null}
      <button className={btnPrimary} onClick={start} disabled={busy || fullBlocked || caseBlocked || stats.eligibleQuestions === 0}>
        {busy ? "Preparing…" : "Begin"}
      </button>
    </div>
  );
}

function MinutesField({ minutes, setMinutes, allowUntimed }: { minutes: number; setMinutes: (n: number) => void; allowUntimed?: boolean }) {
  return (
    <div>
      <label htmlFor="time-limit" className="mb-1 block font-medium">Time limit</label>
      <select id="time-limit" value={minutes} onChange={(e) => setMinutes(Number(e.target.value))} className="min-h-11 rounded border border-line-strong px-2">
        {allowUntimed ? <option value={0}>Untimed</option> : null}
        {[10, 15, 20, 30, 45, 60, 90, 120, 180, 300].map((n) => (
          <option key={n} value={n}>
            {n >= 60 ? `${n / 60} hour${n > 60 ? "s" : ""}` : `${n} minutes`}
          </option>
        ))}
      </select>
    </div>
  );
}
