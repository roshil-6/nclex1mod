"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { Panel, Shell, btnSecondary } from "@/components/ui/Shell";
import { putQuestion, useAdminBank } from "@/components/admin/useAdminBank";
import { QUESTION_TYPE_LABELS } from "@/components/questions/QuestionRenderer";

export default function AdminHome() {
  const { bank, error, reload } = useAdminBank();
  const [filter, setFilter] = useState<"all" | "needs" | "eligible" | "disabled">("all");
  const [search, setSearch] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [importText, setImportText] = useState("");
  const [overwrite, setOverwrite] = useState(false);

  const rows = useMemo(() => {
    if (!bank) return [];
    return bank.questions.filter((q) => {
      if (filter === "needs" && q.eligibility.eligible) return false;
      if (filter === "eligible" && !q.eligibility.eligible) return false;
      if (filter === "disabled" && q.enabled) return false;
      const s = search.toLowerCase();
      return !s || q.id.toLowerCase().includes(s) || q.questionText.toLowerCase().includes(s) || q.clinicalCategory.toLowerCase().includes(s);
    });
  }, [bank, filter, search]);

  if (error) return <Shell wide><p className="text-bad">{error}</p></Shell>;
  if (!bank) return <Shell wide><p className="text-ink-soft">Loading…</p></Shell>;

  const needs = bank.questions.filter((q) => !q.eligibility.eligible);

  const toggleEnabled = async (id: string) => {
    const q = bank.questions.find((x) => x.id === id)!;
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { file, eligibility, ...plain } = q;
    const err = await putQuestion({ ...plain, enabled: !q.enabled });
    setMsg(err ?? `${id} ${q.enabled ? "disabled" : "enabled"}.`);
    await reload();
  };

  const doImport = async (text: string) => {
    let items: unknown;
    try {
      const parsed = JSON.parse(text);
      items = Array.isArray(parsed) ? parsed : parsed.questions ?? parsed.items;
    } catch {
      setMsg("Import failed: not valid JSON.");
      return;
    }
    const res = await fetch("/api/admin/questions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ items, overwrite }),
    });
    const body = await res.json();
    if (!res.ok) setMsg(`Import failed: ${body.error}`);
    else
      setMsg(
        `Imported ${body.imported.length}; skipped ${body.skipped.length}${
          body.skipped.length ? ": " + body.skipped.map((s: { id: string; reason: string }) => `${s.id} (${s.reason})`).join("; ") : ""
        }`,
      );
    await reload();
  };

  return (
    <Shell wide>
      <div className="space-y-5">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="flex-1 text-xl font-semibold">Question bank administration</h1>
          <Link href="/admin/screens" className={btnSecondary}>
            Source screenshots
          </Link>
          <a href="/api/admin/export" className={btnSecondary}>
            Export JSON
          </a>
          <button
            className={btnSecondary}
            onClick={async () => {
              await fetch("/api/admin/login", { method: "DELETE" });
              window.location.href = "/";
            }}
          >
            Sign out
          </button>
        </div>
        {msg ? (
          <p className="whitespace-pre-wrap rounded border border-line bg-accent-soft p-3 text-sm" role="status">
            {msg}
          </p>
        ) : null}

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
          {[
            ["Bank version", bank.version],
            ["Questions", bank.questions.length],
            ["Scored-eligible", bank.questions.length - needs.length],
            ["Need verification / held back", needs.length],
            ["Invalid records", bank.invalid.length],
          ].map(([l, v]) => (
            <div key={l} className="rounded border border-line bg-surface p-3">
              <p className="text-xs text-ink-soft">{l}</p>
              <p className="font-semibold tabular-nums">{v}</p>
            </div>
          ))}
        </div>

        {bank.invalid.length ? (
          <Panel>
            <h2 className="mb-2 font-semibold text-bad">Records failing validation (excluded from exams)</h2>
            <ul className="space-y-1 text-sm">
              {bank.invalid.map((i, n) => (
                <li key={n}>
                  <code>{i.id}</code> in <code>{i.file}</code>: {i.errors.join("; ")}
                </li>
              ))}
            </ul>
          </Panel>
        ) : null}

        <Panel>
          <h2 className="mb-2 font-semibold">Answers requiring confirmation</h2>
          {needs.length === 0 ? (
            <p className="text-sm text-ink-soft">Every question currently meets the scored-exam criteria.</p>
          ) : (
            <ul className="space-y-1 text-sm">
              {needs.map((q) => (
                <li key={q.id}>
                  <Link className="text-accent underline" href={`/admin/questions/${q.id}`}>
                    {q.id}
                  </Link>{" "}
                  — {q.eligibility.reasons.join(", ")}
                </li>
              ))}
            </ul>
          )}
          <p className="mt-2 text-xs text-ink-faint">
            Answer statuses counted as scorable are set by <code>SCORED_ANSWER_STATUSES</code> (default: verified, author-reviewed). Set it to
            <code> verified</code> to admit only clinician-verified keys.
          </p>
        </Panel>

        <Panel>
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <h2 className="flex-1 font-semibold">Questions</h2>
            <input
              placeholder="Search id, text, category"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="min-h-10 rounded border border-line-strong px-2 text-sm"
            />
            <select value={filter} onChange={(e) => setFilter(e.target.value as typeof filter)} className="min-h-10 rounded border border-line-strong px-2 text-sm">
              <option value="all">All</option>
              <option value="needs">Needs verification</option>
              <option value="eligible">Scored-eligible</option>
              <option value="disabled">Disabled</option>
            </select>
          </div>
          <div className="scroll-x">
            <table className="w-full min-w-[820px] text-sm">
              <thead>
                <tr className="border-b border-line text-left text-ink-soft">
                  <th className="py-1.5 pr-2">ID</th>
                  <th className="px-2">Type</th>
                  <th className="px-2">Category / case</th>
                  <th className="px-2">Origin</th>
                  <th className="px-2">Content</th>
                  <th className="px-2">Answer</th>
                  <th className="px-2">Status</th>
                  <th className="px-2">Enabled</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((q) => (
                  <tr key={q.id} className="border-b border-line/60 align-top">
                    <td className="py-1.5 pr-2">
                      <Link href={`/admin/questions/${q.id}`} className="text-accent underline">
                        {q.id}
                      </Link>
                      <p className="max-w-xs truncate text-xs text-ink-faint">{q.questionText}</p>
                    </td>
                    <td className="px-2 text-xs">{QUESTION_TYPE_LABELS[q.questionType]}</td>
                    <td className="px-2 text-xs">
                      {q.clinicalCategory}
                      {q.caseStudyId ? (
                        <span className="block text-ink-faint">
                          {q.caseStudyId} · part {q.caseStudyPart}
                        </span>
                      ) : null}
                    </td>
                    <td className="px-2 text-xs">{q.origin}</td>
                    <td className="px-2 text-xs">{q.contentVerificationStatus}</td>
                    <td className="px-2 text-xs">{q.answerVerificationStatus}</td>
                    <td className="px-2 text-xs">{q.eligibility.eligible ? <span className="text-good">scored</span> : <span className="text-warn">held back</span>}</td>
                    <td className="px-2">
                      <button className="text-xs text-accent underline" onClick={() => toggleEnabled(q.id)}>
                        {q.enabled ? "Disable" : "Enable"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>

        <Panel>
          <h2 className="mb-2 font-semibold">Import question records</h2>
          <p className="mb-2 text-sm text-ink-soft">
            Paste a JSON array of question objects (or an export file). Every record is schema-validated; invalid records are reported and
            skipped. Imported questions keep their own verification status.
          </p>
          <input
            type="file"
            accept="application/json"
            className="mb-2 block text-sm"
            onChange={async (e) => {
              const f = e.target.files?.[0];
              if (f) setImportText(await f.text());
            }}
          />
          <textarea
            value={importText}
            onChange={(e) => setImportText(e.target.value)}
            rows={6}
            className="w-full rounded border border-line-strong p-2 font-mono text-xs"
            placeholder='[{"id": "...", "origin": "pending", ...}]'
          />
          <label className="my-2 flex items-center gap-2 text-sm">
            <input type="checkbox" checked={overwrite} onChange={(e) => setOverwrite(e.target.checked)} /> Overwrite existing ids
          </label>
          <button className={btnSecondary} disabled={!importText.trim()} onClick={() => doImport(importText)}>
            Import
          </button>
        </Panel>
      </div>
    </Shell>
  );
}
