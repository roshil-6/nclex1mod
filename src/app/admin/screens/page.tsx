"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Panel, Shell } from "@/components/ui/Shell";

interface Shot {
  id: string;
  originalFilename: string;
  phase: string;
  questionNumber: number | null;
  exactDuplicateOf: string | null;
  groupingConfidence: string;
}

export default function Screens() {
  const [inv, setInv] = useState<Shot[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [q, setQ] = useState<number | "all">("all");
  useEffect(() => {
    fetch("/api/admin/screens/inventory").then(async (r) => (r.ok ? setInv(await r.json()) : setErr((await r.json()).error)));
  }, []);
  const shown = (inv ?? []).filter((s) => q === "all" || s.questionNumber === q);
  return (
    <Shell wide>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Link href="/admin" className="text-sm text-accent underline">
          ← Admin
        </Link>
        <h1 className="flex-1 text-lg font-semibold">Source screenshot inventory</h1>
        <select className="min-h-10 rounded border border-line-strong px-2 text-sm" value={String(q)} onChange={(e) => setQ(e.target.value === "all" ? "all" : Number(e.target.value))}>
          <option value="all">All screenshots</option>
          {Array.from({ length: 50 }, (_, i) => (
            <option key={i} value={i + 1}>
              Source question {i + 1}
            </option>
          ))}
        </select>
      </div>
      <Panel className="mb-4 text-sm text-ink-soft">
        These are the supplied screenshots, kept only on the machine that holds the <code>source/</code> folder (never deployed). They come from
        a licensed commercial question bank and carry a subscriber watermark, so they are used here only as a reference for transcribing
        content you are licensed to use. See <code>docs/extraction-report.md</code>.
      </Panel>
      {err ? <p className="text-warn">{err}</p> : null}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
        {shown.map((s) => (
          <figure key={s.id} className="rounded border border-line bg-surface p-1 text-xs">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`/api/admin/screens/${s.id}`} alt={s.id} loading="lazy" className="w-full" />
            <figcaption className="mt-1">
              <strong>{s.id}</strong> · Q{s.questionNumber ?? "?"} · {s.phase === "answer-review" ? "review" : "exam"}
              {s.exactDuplicateOf ? ` · dup of ${s.exactDuplicateOf}` : ""}
            </figcaption>
          </figure>
        ))}
      </div>
    </Shell>
  );
}
