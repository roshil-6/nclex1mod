"use client";
import { isAnswered } from "@/lib/scoring/score";
import type { Response } from "@/lib/validation/schema";

export interface NavigatorProps {
  questionIds: string[];
  currentIndex: number;
  responses: Record<string, Response>;
  flagged: string[];
  onSelect: (index: number) => void;
  /** Optional per-question labels, e.g. case grouping */
  groupLabel?: (index: number) => string | null;
}

/** Grid of question numbers distinguishing current / answered / unanswered / flagged. */
export function QuestionNavigator({ questionIds, currentIndex, responses, flagged, onSelect, groupLabel }: NavigatorProps) {
  const flags = new Set(flagged);
  const answered = questionIds.filter((id) => isAnswered(responses[id])).length;
  return (
    <nav aria-label="Question navigator" className="text-sm">
      <div className="mb-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-soft">
        <span className="inline-flex items-center gap-1">
          <i className="inline-block h-3 w-3 rounded-sm border-2 border-accent bg-surface" /> Current
        </span>
        <span className="inline-flex items-center gap-1">
          <i className="inline-block h-3 w-3 rounded-sm bg-accent" /> Answered
        </span>
        <span className="inline-flex items-center gap-1">
          <i className="inline-block h-3 w-3 rounded-sm border border-line-strong bg-surface" /> Unanswered
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="text-warn">⚑</span> Flagged
        </span>
      </div>
      <p className="mb-2 text-xs text-ink-faint">
        {answered} of {questionIds.length} answered · {flags.size} flagged
      </p>
      <ol className="grid grid-cols-6 gap-1.5 sm:grid-cols-8 lg:grid-cols-5">
        {questionIds.map((id, i) => {
          const a = isAnswered(responses[id]);
          const cur = i === currentIndex;
          const f = flags.has(id);
          const g = groupLabel?.(i);
          const state = [cur ? "current" : null, a ? "answered" : "unanswered", f ? "flagged" : null].filter(Boolean).join(", ");
          return (
            <li key={id}>
              <button
                type="button"
                onClick={() => onSelect(i)}
                aria-current={cur ? "step" : undefined}
                aria-label={`Question ${i + 1}: ${state}${g ? `, ${g}` : ""}`}
                data-state={a ? "answered" : "unanswered"}
                data-flagged={f || undefined}
                title={g ?? undefined}
                className={`relative h-10 w-full rounded text-sm font-semibold ${
                  a ? "bg-accent text-white" : "border border-line-strong bg-surface text-ink"
                } ${cur ? "ring-2 ring-accent ring-offset-2" : ""}`}
              >
                {i + 1}
                {f ? <span className="absolute -right-1 -top-1.5 text-xs text-warn">⚑</span> : null}
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
