"use client";
import { markClass, MarkLabel, type Mark, type QuestionProps } from "./types";

/** TYPE A — single answer (radio). */
export function SingleChoice({ question, response, onChange, disabled, answerKey }: QuestionProps<"single">) {
  const selected = response?.optionId ?? null;
  const name = `q-${question.id}`;
  return (
    <fieldset className="space-y-2" disabled={disabled}>
      <legend className="sr-only">Select one answer</legend>
      {question.options.map((o) => {
        const isSel = selected === o.id;
        let mark: Mark = null;
        if (answerKey) {
          if (answerKey.optionId === o.id) mark = isSel ? "correct" : "missed";
          else if (isSel) mark = "incorrect";
        }
        return (
          <label
            key={o.id}
            className={`flex min-h-12 cursor-pointer items-start gap-3 rounded border px-3 py-3 transition-colors ${
              isSel ? "border-accent bg-accent-soft" : "border-line bg-surface hover:border-line-strong"
            } ${markClass(mark)} ${disabled ? "cursor-default" : ""}`}
          >
            <input
              type="radio"
              name={name}
              value={o.id}
              checked={isSel}
              onChange={() => onChange({ type: "single", optionId: o.id })}
              className="mt-1 h-5 w-5 shrink-0 accent-accent"
            />
            <span className="exam-text">{o.text}</span>
            <MarkLabel mark={mark} />
          </label>
        );
      })}
    </fieldset>
  );
}

/** TYPE B — multiple response (checkboxes). */
export function MultipleChoice({ question, response, onChange, disabled, answerKey }: QuestionProps<"multiple">) {
  const selected = new Set(response?.optionIds ?? []);
  const keyed = new Set(answerKey?.optionIds ?? []);
  const toggle = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    // keep option order stable
    onChange({ type: "multiple", optionIds: question.options.map((o) => o.id).filter((x) => next.has(x)) });
  };
  return (
    <fieldset className="space-y-2" disabled={disabled}>
      <legend className="mb-2 text-sm text-ink-soft">
        {question.requiredCount ? `Select ${question.requiredCount}.` : "Select all that apply."}
        {question.requiredCount ? (
          <span className="ml-2 text-ink-faint">
            ({selected.size} of {question.requiredCount} selected)
          </span>
        ) : null}
      </legend>
      {question.options.map((o) => {
        const isSel = selected.has(o.id);
        let mark: Mark = null;
        if (answerKey) {
          if (keyed.has(o.id)) mark = isSel ? "correct" : "missed";
          else if (isSel) mark = "incorrect";
        }
        const atLimit = !!question.requiredCount && selected.size >= question.requiredCount && !isSel;
        return (
          <label
            key={o.id}
            className={`flex min-h-12 cursor-pointer items-start gap-3 rounded border px-3 py-3 transition-colors ${
              isSel ? "border-accent bg-accent-soft" : "border-line bg-surface hover:border-line-strong"
            } ${markClass(mark)} ${atLimit ? "opacity-60" : ""}`}
          >
            <input
              type="checkbox"
              checked={isSel}
              disabled={disabled || atLimit}
              onChange={() => toggle(o.id)}
              className="mt-1 h-5 w-5 shrink-0 accent-accent"
            />
            <span className="exam-text">{o.text}</span>
            <MarkLabel mark={mark} />
          </label>
        );
      })}
    </fieldset>
  );
}
