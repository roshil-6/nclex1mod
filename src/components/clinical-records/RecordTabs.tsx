"use client";
import { useMemo, useState } from "react";
import type { RecordBlock, RecordTab } from "@/lib/validation/schema";

const visible = (fromPart: number | undefined, part: number | null) => !fromPart || (part !== null && fromPart <= part);

/** Filter tabs/blocks/rows/entries to what is visible at `part` (null = standalone: show everything). */
export function visibleTabs(tabs: RecordTab[], part: number | null): RecordTab[] {
  const p = part ?? Number.MAX_SAFE_INTEGER;
  return tabs
    .filter((t) => visible(t.fromPart, p))
    .map((t) => ({
      ...t,
      blocks: t.blocks
        .filter((b) => visible(b.fromPart, p))
        .map((b): RecordBlock => {
          if (b.kind === "entries") return { ...b, entries: b.entries.filter((e) => visible(e.fromPart, p)) };
          if (b.kind === "table") return { ...b, rows: b.rows.filter((r) => visible(r.fromPart, p)) };
          return b;
        })
        .filter((b) => (b.kind === "entries" ? b.entries.length > 0 : b.kind === "table" ? b.rows.length > 0 : true)),
    }))
    .filter((t) => t.blocks.length > 0);
}

function Block({ block, part }: { block: RecordBlock; part: number | null }) {
  const isNew = (fp?: number) => part !== null && fp !== undefined && fp === part && part > 1;
  const New = () => <span className="ml-2 rounded bg-warn-soft px-1.5 py-0.5 font-sans text-[11px] font-semibold text-warn">New</span>;
  return (
    <section className="mb-4 last:mb-0">
      {block.heading ? (
        <h4 className="mb-1.5 font-sans text-sm font-semibold text-ink">
          {block.heading}
          {isNew(block.fromPart) ? <New /> : null}
        </h4>
      ) : null}
      {block.kind === "text" &&
        block.paragraphs.map((p, i) => (
          <p key={i} className="mb-1.5">
            {p}
          </p>
        ))}
      {block.kind === "entries" && (
        <dl className="space-y-2">
          {block.entries.map((e, i) => (
            <div key={i}>
              <dt className="font-sans text-sm font-semibold">
                {e.time}
                {isNew(e.fromPart) ? <New /> : null}
              </dt>
              <dd>{e.text}</dd>
            </div>
          ))}
        </dl>
      )}
      {block.kind === "table" && (
        <div className="scroll-x rounded border border-line">
          <table className="w-full min-w-[420px] border-collapse font-sans text-sm">
            <thead>
              <tr className="bg-accent-soft text-left text-ink-soft">
                {block.columns.map((c, i) => (
                  <th key={i} scope="col" className="border-b border-line px-3 py-1.5 font-semibold">
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {block.rows.map((r, i) => (
                <tr key={i} className={isNew(r.fromPart) ? "bg-warn-soft/60" : "odd:bg-surface even:bg-page/40"}>
                  {r.cells.map((c, j) => (
                    <td key={j} className="border-b border-line px-3 py-1.5 align-top">
                      {c}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

/**
 * Clinical record tabs. Tab selection is local UI state only — it never touches the answer.
 */
export function RecordTabs({ tabs, part, idPrefix }: { tabs: RecordTab[]; part: number | null; idPrefix: string }) {
  const shown = useMemo(() => visibleTabs(tabs, part), [tabs, part]);
  const [active, setActive] = useState<string | null>(null);
  if (shown.length === 0) return null;
  const cur = shown.find((t) => t.id === active) ?? shown[0];
  return (
    <div className="rounded border border-line bg-surface">
      <div role="tablist" aria-label="Clinical records" className="scroll-x scrollbar-thin flex border-b border-line bg-page/60 sm:flex-wrap">
        {shown.map((t) => {
          const on = t.id === cur.id;
          return (
            <button
              key={t.id}
              role="tab"
              id={`${idPrefix}-tab-${t.id}`}
              aria-selected={on}
              aria-controls={`${idPrefix}-panel`}
              onClick={() => setActive(t.id)}
              className={`shrink-0 whitespace-nowrap border-r border-line px-4 py-2.5 text-sm ${
                on ? "-mb-px border-b-2 border-b-accent bg-surface font-semibold text-accent" : "text-ink-soft hover:bg-surface"
              }`}
            >
              {t.label}
            </button>
          );
        })}
      </div>
      <div
        role="tabpanel"
        id={`${idPrefix}-panel`}
        aria-labelledby={`${idPrefix}-tab-${cur.id}`}
        className="exam-text max-h-[55vh] overflow-y-auto p-4 text-[15px]"
      >
        {cur.blocks.map((b, i) => (
          <Block key={`${cur.id}-${i}`} block={b} part={part} />
        ))}
      </div>
    </div>
  );
}
