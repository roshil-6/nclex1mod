"use client";
import type { Mark, QuestionProps } from "./types";

/** Highlight (tap-to-select) findings within text or a body-system table. */
export function HighlightQuestion({ question, response, onChange, disabled, answerKey }: QuestionProps<"highlight">) {
  const sel = new Set(response?.itemIds ?? []);
  const keyed = new Set(answerKey?.itemIds ?? []);
  const limit = question.requiredCount;
  const toggle = (id: string) => {
    if (disabled) return;
    const next = new Set(sel);
    if (next.has(id)) next.delete(id);
    else {
      if (limit && next.size >= limit) return;
      next.add(id);
    }
    onChange({ type: "highlight", itemIds: question.highlightItems.map((i) => i.id).filter((x) => next.has(x)) });
  };
  const mark = (id: string): Mark => {
    if (!answerKey) return null;
    if (keyed.has(id)) return sel.has(id) ? "correct" : "missed";
    return sel.has(id) ? "incorrect" : null;
  };

  const renderItem = (id: string, text: string) => {
    const on = sel.has(id);
    const m = mark(id);
    const ring =
      m === "correct"
        ? "ring-2 ring-good"
        : m === "incorrect"
          ? "ring-2 ring-bad"
          : m === "missed"
            ? "ring-2 ring-good ring-dashed outline-dashed outline-1 outline-good"
            : "";
    return (
      <button
        key={id}
        type="button"
        role="checkbox"
        aria-checked={on}
        disabled={disabled}
        onClick={() => toggle(id)}
        className={`exam-text rounded-sm px-1 py-0.5 text-left underline decoration-dotted decoration-ink-faint underline-offset-4 ${
          on ? "bg-mark" : "hover:bg-accent-soft"
        } ${ring}`}
      >
        {text}
        {m === "missed" ? <span className="ml-1 font-sans text-xs font-semibold text-good">(should be highlighted)</span> : null}
      </button>
    );
  };

  const counter = (
    <p className="mb-2 text-sm text-ink-soft">
      {limit ? `Tap to highlight ${limit} findings.` : "Tap to highlight all findings that apply."}{" "}
      <span className="text-ink-faint">({sel.size} highlighted)</span>
    </p>
  );

  if (question.highlightLayout === "table") {
    const groups: { group: string; items: typeof question.highlightItems }[] = [];
    for (const it of question.highlightItems) {
      const g = it.group ?? "";
      const last = groups[groups.length - 1];
      if (last && last.group === g) last.items.push(it);
      else groups.push({ group: g, items: [it] });
    }
    const [h1, h2] = question.highlightTableHeadings ?? ["Body system", "Findings"];
    return (
      <div>
        {counter}
        <div className="scroll-x rounded border border-line">
          <table className="w-full min-w-[440px] border-collapse text-sm">
            <thead>
              <tr className="bg-accent-soft text-left text-ink-soft">
                <th className="w-1/3 border-b border-line px-3 py-2 font-semibold uppercase tracking-wide">{h1}</th>
                <th className="border-b border-l border-line px-3 py-2 font-semibold uppercase tracking-wide">{h2}</th>
              </tr>
            </thead>
            <tbody>
              {groups.map((g) => (
                <tr key={g.group} className="bg-surface align-top">
                  <th scope="row" className="exam-text border-b border-line px-3 py-2 text-left font-semibold">
                    {g.group}
                  </th>
                  <td className="border-b border-l border-line px-3 py-2">
                    <ul className="space-y-1.5">
                      {g.items.map((i) => (
                        <li key={i.id}>
                          {renderItem(i.id, i.text)}
                        </li>
                      ))}
                    </ul>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  return (
    <div>
      {counter}
      <div className="rounded border border-line bg-surface p-4 leading-8">
        {question.highlightItems.map((i) => (
          <span key={i.id}>
            {renderItem(i.id, i.text)}{" "}
          </span>
        ))}
      </div>
    </div>
  );
}
