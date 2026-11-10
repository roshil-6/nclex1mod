import type { ScoredItem } from "@/types/exam";

const STATUS_TEXT: Record<string, string> = {
  verified: "Answer key verified by a clinical reviewer.",
  "author-reviewed":
    "Original practice item. Answer key written and checked against standard nursing references by the content author; not yet signed off by a licensed nurse educator.",
  unverified: "Answer key not verified.",
  disputed: "Answer key disputed — under review.",
};

export function OutcomeBadge({ outcome }: { outcome: ScoredItem["score"]["outcome"] }) {
  const map = {
    correct: "bg-good-soft text-good border-good",
    partial: "bg-warn-soft text-warn border-warn",
    incorrect: "bg-bad-soft text-bad border-bad",
    unanswered: "bg-page text-ink-soft border-line-strong",
  } as const;
  const label = { correct: "Correct", partial: "Partially correct", incorrect: "Incorrect", unanswered: "Unanswered" }[outcome];
  return <span className={`rounded border px-2 py-0.5 text-xs font-semibold ${map[outcome]}`}>{label}</span>;
}

export function Feedback({ item, className = "" }: { item: ScoredItem; className?: string }) {
  return (
    <section className={`rounded border border-line bg-page/50 p-4 ${className}`} aria-label="Answer feedback">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <OutcomeBadge outcome={item.score.outcome} />
        <span className="text-sm text-ink-soft">
          Score {item.score.earned} / {item.score.max}
        </span>
      </div>
      {item.rationale ? (
        <div className="exam-text space-y-2 text-[15px]">
          <h3 className="font-sans text-sm font-semibold uppercase tracking-wide text-ink-soft">Rationale</h3>
          {item.rationale.split(/\n\n+/).map((p, i) => (
            <p key={i}>{p}</p>
          ))}
        </div>
      ) : (
        <p className="text-sm text-ink-soft">No rationale recorded for this item.</p>
      )}
      {item.references.length ? (
        <div className="mt-3 text-xs text-ink-soft">
          <p className="font-semibold">Reference basis</p>
          <ul className="list-disc pl-5">
            {item.references.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
        </div>
      ) : null}
      <p className="mt-3 text-xs text-ink-faint">{STATUS_TEXT[item.answerVerificationStatus]}</p>
    </section>
  );
}
