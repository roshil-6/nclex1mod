"use client";
import type { QuestionProps } from "./types";

type Side = "left" | "center" | "right";
const SIDES: Side[] = ["left", "center", "right"];

/**
 * Bowtie: actions (left) — condition (centre) — parameters to monitor (right).
 * Tap an option to place it into the next empty slot of its column; tap a filled slot to clear it.
 * (Tap-to-place replaces drag-and-drop so it works with touch, keyboard and screen readers.)
 */
export function BowtieQuestion({ question, response, onChange, disabled, answerKey }: QuestionProps<"bowtie">) {
  const b = question.bowtie;
  if (!b) return <p className="text-bad">Bowtie definition missing.</p>;
  const cur = response ?? { type: "bowtie" as const, left: [], center: [], right: [] };

  const place = (side: Side, id: string) => {
    if (disabled) return;
    const list = cur[side];
    if (list.includes(id)) return remove(side, id);
    if (list.length >= b[side].slots) return;
    onChange({ ...cur, type: "bowtie", [side]: [...list, id] });
  };
  const remove = (side: Side, id: string) => {
    if (disabled) return;
    onChange({ ...cur, type: "bowtie", [side]: cur[side].filter((x) => x !== id) });
  };
  const textOf = (side: Side, id: string) => b[side].options.find((o) => o.id === id)?.text ?? id;
  const slotClass = (side: Side, id: string | undefined) => {
    if (!answerKey || !id) return id ? "border-accent bg-accent-soft" : "border-dashed border-line-strong bg-page";
    return answerKey[side].includes(id) ? "border-good bg-good-soft" : "border-bad bg-bad-soft";
  };

  const renderSlots = (side: Side) => (
    <div className="flex flex-col gap-2">
      <p className="text-center text-xs font-semibold uppercase tracking-wide text-ink-soft">{b[side].label}</p>
      {Array.from({ length: b[side].slots }).map((_, i) => {
        const id = cur[side][i];
        return (
          <button
            key={i}
            type="button"
            disabled={disabled || !id}
            onClick={() => id && remove(side, id)}
            aria-label={id ? `${b[side].label} slot ${i + 1}: ${textOf(side, id)}. Activate to clear.` : `${b[side].label} slot ${i + 1}: empty`}
            className={`exam-text min-h-14 rounded border px-2 py-2 text-center text-sm ${slotClass(side, id)}`}
          >
            {id ? textOf(side, id) : <span className="font-sans text-xs text-ink-faint">Empty</span>}
          </button>
        );
      })}
    </div>
  );

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 items-center gap-4 rounded border border-line bg-surface p-4 sm:grid-cols-3">
        {renderSlots("left")}
        {renderSlots("center")}
        {renderSlots("right")}
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {SIDES.map((side) => (
          <div key={side} className="rounded border border-line bg-surface p-3">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-soft">
              {b[side].label} <span className="font-normal normal-case">(choose {b[side].slots})</span>
            </p>
            <ul className="space-y-1.5">
              {b[side].options.map((o) => {
                const placed = cur[side].includes(o.id);
                const keyed = answerKey?.[side].includes(o.id);
                return (
                  <li key={o.id}>
                    <button
                      type="button"
                      aria-pressed={placed}
                      disabled={disabled || (!placed && cur[side].length >= b[side].slots)}
                      onClick={() => place(side, o.id)}
                      className={`exam-text w-full rounded border px-2 py-2 text-left text-sm disabled:opacity-60 ${
                        placed ? "border-accent bg-accent-soft" : "border-line hover:border-line-strong"
                      }`}
                    >
                      {o.text}
                      {answerKey && keyed ? <span className="ml-2 font-sans text-xs font-semibold text-good">✓ keyed</span> : null}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}
