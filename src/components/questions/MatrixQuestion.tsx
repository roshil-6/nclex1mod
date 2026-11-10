"use client";
import type { Mark, QuestionProps } from "./types";

function cellMark(isSel: boolean, isKey: boolean, review: boolean): Mark {
  if (!review) return null;
  if (isKey) return isSel ? "correct" : "missed";
  return isSel ? "incorrect" : null;
}

function cellClass(m: Mark) {
  return m === "correct"
    ? "bg-good-soft"
    : m === "incorrect"
      ? "bg-bad-soft"
      : m === "missed"
        ? "bg-good-soft/60 outline outline-1 outline-dashed outline-good -outline-offset-4"
        : "";
}

interface MatrixShellProps {
  question: QuestionProps<"matrix-single">["question"];
  renderCell: (rowId: string, colId: string, rowLabel: string, colLabel: string) => React.ReactNode;
  cellMarkFor: (rowId: string, colId: string) => Mark;
}

function MatrixShell({ question, renderCell, cellMarkFor }: MatrixShellProps) {
  return (
    <div className="scroll-x rounded border border-line">
      <table className="w-full min-w-[520px] border-collapse text-sm">
        <thead>
          <tr className="bg-accent-soft">
            <th scope="col" className="border-b border-line px-3 py-2 text-left font-semibold uppercase tracking-wide text-ink-soft">
              {question.matrixRowHeading ?? ""}
            </th>
            {question.matrixColumns.map((c) => (
              <th key={c.id} scope="col" className="w-28 border-b border-l border-line px-2 py-2 text-center font-semibold text-ink-soft">
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {question.matrixRows.map((r, i) => (
            <tr key={r.id} className={i % 2 ? "bg-page/40" : "bg-surface"}>
              <th scope="row" className="exam-text border-b border-line px-3 py-2 text-left font-normal">
                {r.text}
              </th>
              {question.matrixColumns.map((c) => (
                <td key={c.id} className={`border-b border-l border-line p-0 text-center ${cellClass(cellMarkFor(r.id, c.id))}`}>
                  {renderCell(r.id, c.id, r.text, c.label)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** TYPE D / F / G — one answer per row (radio per row). */
export function MatrixSingle({ question, response, onChange, disabled, answerKey }: QuestionProps<"matrix-single">) {
  const sel = response?.selections ?? {};
  return (
    <MatrixShell
      question={question}
      cellMarkFor={(r, c) => cellMark(sel[r] === c, answerKey?.selections[r] === c, !!answerKey)}
      renderCell={(r, c, rl, cl) => (
        <label className="flex h-full min-h-12 w-full cursor-pointer items-center justify-center">
          <input
            type="radio"
            name={`q-${question.id}-${r}`}
            checked={sel[r] === c}
            disabled={disabled}
            aria-label={`${rl}: ${cl}`}
            onChange={() => onChange({ type: "matrix-single", selections: { ...sel, [r]: c } })}
            className="h-5 w-5 accent-accent"
          />
        </label>
      )}
    />
  );
}

/** TYPE C — matrix multiple response (checkbox per cell). */
export function MatrixMultiple({ question, response, onChange, disabled, answerKey }: QuestionProps<"matrix-multiple">) {
  const sel = response?.selections ?? {};
  const toggle = (r: string, c: string) => {
    const cur = new Set(sel[r] ?? []);
    if (cur.has(c)) cur.delete(c);
    else cur.add(c);
    const ordered = question.matrixColumns.map((x) => x.id).filter((x) => cur.has(x));
    onChange({ type: "matrix-multiple", selections: { ...sel, [r]: ordered } });
  };
  return (
    <MatrixShell
      question={question}
      cellMarkFor={(r, c) =>
        cellMark((sel[r] ?? []).includes(c), (answerKey?.selections[r] ?? []).includes(c), !!answerKey)
      }
      renderCell={(r, c, rl, cl) => (
        <label className="flex h-full min-h-12 w-full cursor-pointer items-center justify-center">
          <input
            type="checkbox"
            checked={(sel[r] ?? []).includes(c)}
            disabled={disabled}
            aria-label={`${rl}: ${cl}`}
            onChange={() => toggle(r, c)}
            className="h-5 w-5 accent-accent"
          />
        </label>
      )}
    />
  );
}
