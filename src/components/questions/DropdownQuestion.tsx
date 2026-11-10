"use client";
import type { Mark, QuestionProps } from "./types";

/** TYPE E — dropdown completion, inline in a sentence or as a two-column table. */
export function DropdownQuestion({ question, response, onChange, disabled, answerKey }: QuestionProps<"dropdown">) {
  const values = response?.values ?? {};
  const fieldMark = (id: string): Mark => {
    if (!answerKey) return null;
    return values[id] === answerKey.values[id] ? "correct" : "incorrect";
  };
  const setValue = (id: string, v: string) => {
    const next = { ...values };
    if (v) next[id] = v;
    else delete next[id];
    onChange({ type: "dropdown", values: next });
  };

  const renderSelect = (id: string, label: string, key?: number) => {
    const f = question.dropdownFields.find((x) => x.id === id);
    if (!f) return <span key={key ?? id} className="text-bad">[missing field {id}]</span>;
    const m = fieldMark(id);
    const keyText = answerKey && m === "incorrect" ? f.options.find((o) => o.id === answerKey.values[id])?.text : null;
    return (
      <span key={key ?? id} className="inline-flex max-w-full flex-col align-middle">
        <select
          aria-label={label}
          value={values[id] ?? ""}
          disabled={disabled}
          onChange={(e) => setValue(id, e.target.value)}
          className={`my-1 min-h-11 max-w-full rounded border px-2 py-1.5 font-sans text-[15px] ${
            m === "correct" ? "border-good bg-good-soft" : m === "incorrect" ? "border-bad bg-bad-soft" : values[id] ? "border-accent" : "border-line-strong"
          }`}
        >
          <option value="">Select…</option>
          {f.options.map((o) => (
            <option key={o.id} value={o.id}>
              {o.text}
            </option>
          ))}
        </select>
        {keyText ? <span className="text-xs font-semibold text-good">Correct: {keyText}</span> : null}
      </span>
    );
  };

  if (question.dropdownLayout === "table") {
    const [h1, h2] = question.dropdownTableHeadings ?? ["Item", "Selection"];
    return (
      <div className="scroll-x rounded border border-line">
        <table className="w-full min-w-[420px] border-collapse text-sm">
          <thead>
            <tr className="bg-accent-soft text-left text-ink-soft">
              <th className="border-b border-line px-3 py-2 font-semibold uppercase tracking-wide">{h1}</th>
              <th className="border-b border-l border-line px-3 py-2 font-semibold uppercase tracking-wide">{h2}</th>
            </tr>
          </thead>
          <tbody>
            {question.dropdownFields.map((f) => (
              <tr key={f.id} className="bg-surface">
                <th scope="row" className="exam-text border-b border-line px-3 py-2 text-left font-normal">
                  {f.label}
                </th>
                <td className="border-b border-l border-line px-3 py-1">
                  {renderSelect(f.id, f.label ?? f.id)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  // Sentence layout: split template on {{id}} placeholders.
  const parts = (question.dropdownTemplate ?? "").split(/(\{\{[A-Za-z0-9_-]+\}\})/g);
  let n = 0;
  return (
    <div className="exam-text rounded border border-line bg-surface p-4 text-[16px] leading-[2.4]">
      {parts.map((p, i) => {
        const m = p.match(/^\{\{([A-Za-z0-9_-]+)\}\}$/);
        if (m) {
          n++;
          return renderSelect(m[1], `Blank ${n}`, i);
        }
        return <span key={i}>{p}</span>;
      })}
    </div>
  );
}
