"use client";
import Link from "next/link";
import { use, useEffect, useMemo, useState } from "react";
import { Panel, Shell, btnPrimary, btnSecondary } from "@/components/ui/Shell";
import { putQuestion, useAdminBank } from "@/components/admin/useAdminBank";
import { QuestionView } from "@/components/exam/QuestionView";
import { QuestionSchema, type Question } from "@/lib/validation/schema";

const TYPES = ["single", "multiple", "matrix-single", "matrix-multiple", "dropdown", "highlight", "bowtie"] as const;

export default function EditQuestion({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { bank, reload } = useAdminBank();
  const [text, setText] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [showKey, setShowKey] = useState(true);

  const original = bank?.questions.find((q) => q.id === id);
  useEffect(() => {
    if (!original) return;
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { file, eligibility, ...plain } = original;
    setText(JSON.stringify(plain, null, 2));
  }, [original]);

  const parsed = useMemo(() => {
    try {
      const obj = JSON.parse(text);
      const r = QuestionSchema.safeParse(obj);
      return r.success
        ? { ok: true as const, q: r.data, obj }
        : { ok: false as const, obj, errors: r.error.issues.map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`) };
    } catch (e) {
      return { ok: false as const, obj: null, errors: [`JSON: ${(e as Error).message}`] };
    }
  }, [text]);

  if (!bank) return <Shell wide><p className="text-ink-soft">Loading…</p></Shell>;
  if (!original) return <Shell wide><p>Question {id} not found.</p></Shell>;

  const obj = (parsed.obj ?? {}) as Record<string, unknown>;
  const setField = (k: string, v: unknown) => setText(JSON.stringify({ ...obj, [k]: v }, null, 2));
  const caseStudy = parsed.ok && parsed.q.caseStudyId ? bank.cases.find((c) => c.id === parsed.q.caseStudyId) : undefined;

  const save = async () => {
    if (!parsed.ok) return;
    const err = await putQuestion(parsed.q as Question);
    setMsg(err ?? "Saved. Changes apply to new sessions; submitted attempts keep their snapshot.");
    if (!err) await reload();
  };

  const field = "min-h-10 w-full rounded border border-line-strong px-2 text-sm";
  return (
    <Shell wide>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Link href="/admin" className="text-sm text-accent underline">
          ← All questions
        </Link>
        <h1 className="flex-1 text-lg font-semibold">
          Edit <code>{id}</code>
        </h1>
        <span className={`text-sm ${original.eligibility.eligible ? "text-good" : "text-warn"}`}>
          {original.eligibility.eligible ? "Scored-eligible" : `Held back: ${original.eligibility.reasons.join(", ")}`}
        </span>
      </div>
      {msg ? <p className="mb-3 rounded border border-line bg-accent-soft p-2 text-sm">{msg}</p> : null}

      <div className="grid gap-5 xl:grid-cols-2">
        <div className="space-y-4">
          <Panel>
            <h2 className="mb-3 font-semibold">Key fields</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-sm">
                Question type
                <select className={field} value={String(obj.questionType ?? "")} onChange={(e) => setField("questionType", e.target.value)}>
                  {TYPES.map((t) => (
                    <option key={t}>{t}</option>
                  ))}
                </select>
              </label>
              <label className="text-sm">
                Clinical category
                <input className={field} value={String(obj.clinicalCategory ?? "")} onChange={(e) => setField("clinicalCategory", e.target.value)} />
              </label>
              <label className="text-sm">
                Case study
                <select
                  className={field}
                  value={String(obj.caseStudyId ?? "")}
                  onChange={(e) => {
                    const v = e.target.value || null;
                    setText(JSON.stringify({ ...obj, caseStudyId: v, caseStudyPart: v ? (obj.caseStudyPart ?? 1) : null }, null, 2));
                  }}
                >
                  <option value="">(standalone)</option>
                  {bank.cases.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.title}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-sm">
                Case part
                <input
                  type="number"
                  min={1}
                  className={field}
                  disabled={!obj.caseStudyId}
                  value={obj.caseStudyPart == null ? "" : Number(obj.caseStudyPart)}
                  onChange={(e) => setField("caseStudyPart", Number(e.target.value) || 1)}
                />
              </label>
              <label className="text-sm">
                Origin
                <select className={field} value={String(obj.origin ?? "")} onChange={(e) => setField("origin", e.target.value)}>
                  <option value="original">original (written for this app)</option>
                  <option value="extracted">extracted (transcribed from licensed source)</option>
                  <option value="pending">pending (awaiting verification)</option>
                </select>
              </label>
              <label className="text-sm">
                Scoring policy
                <select className={field} value={String(obj.scoringPolicy ?? "")} onChange={(e) => setField("scoringPolicy", e.target.value)}>
                  <option>dichotomous</option>
                  <option>plus-minus</option>
                  <option>zero-one</option>
                </select>
              </label>
              <label className="text-sm">
                Content verification
                <select
                  className={field}
                  value={String(obj.contentVerificationStatus ?? "")}
                  onChange={(e) => setField("contentVerificationStatus", e.target.value)}
                >
                  <option>verified</option>
                  <option>partial</option>
                  <option>unverified</option>
                </select>
              </label>
              <label className="text-sm">
                Answer verification
                <select
                  className={field}
                  value={String(obj.answerVerificationStatus ?? "")}
                  onChange={(e) => setField("answerVerificationStatus", e.target.value)}
                >
                  <option>verified</option>
                  <option>author-reviewed</option>
                  <option>unverified</option>
                  <option>disputed</option>
                </select>
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={obj.enabled !== false} onChange={(e) => setField("enabled", e.target.checked)} /> Enabled
              </label>
            </div>
            <label className="mt-3 block text-sm">
              Question text
              <textarea className={`${field} py-1`} rows={3} value={String(obj.questionText ?? "")} onChange={(e) => setField("questionText", e.target.value)} />
            </label>
            <label className="mt-3 block text-sm">
              Rationale
              <textarea className={`${field} py-1`} rows={5} value={String(obj.rationale ?? "")} onChange={(e) => setField("rationale", e.target.value)} />
            </label>
            <label className="mt-3 block text-sm">
              Review notes (admin only)
              <textarea className={`${field} py-1`} rows={2} value={String(obj.reviewNotes ?? "")} onChange={(e) => setField("reviewNotes", e.target.value)} />
            </label>
          </Panel>
          <Panel>
            <h2 className="mb-2 font-semibold">Full record (options, matrix, dropdowns, clinical records, answer key)</h2>
            <textarea
              aria-label="Question JSON"
              value={text}
              onChange={(e) => setText(e.target.value)}
              spellCheck={false}
              rows={28}
              className="w-full rounded border border-line-strong p-2 font-mono text-xs"
            />
            {parsed.ok ? (
              <p className="mt-2 text-sm text-good">Schema validation passed.</p>
            ) : (
              <ul className="mt-2 list-disc pl-5 text-sm text-bad">
                {parsed.errors.map((e) => (
                  <li key={e}>{e}</li>
                ))}
              </ul>
            )}
            <div className="mt-3 flex gap-2">
              <button className={btnPrimary} disabled={!parsed.ok} onClick={save}>
                Save
              </button>
              <button
                className={btnSecondary}
                onClick={() => {
                  // eslint-disable-next-line @typescript-eslint/no-unused-vars
                  const { file, eligibility, ...plain } = original;
                  setText(JSON.stringify(plain, null, 2));
                }}
              >
                Revert
              </button>
            </div>
          </Panel>
        </div>
        <div className="space-y-4">
          {original.sourceImages.length ? (
            <Panel>
              <h2 className="mb-2 font-semibold">Source screenshots</h2>
              <div className="flex gap-2 overflow-x-auto">
                {original.sourceImages.map((s) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img key={s} src={`/api/admin/screens/${s}`} alt={`Source ${s}`} className="h-96 rounded border border-line" />
                ))}
              </div>
            </Panel>
          ) : null}
          <Panel>
            <div className="mb-3 flex items-center gap-3">
              <h2 className="flex-1 font-semibold">Live preview</h2>
              <label className="flex items-center gap-1 text-sm">
                <input type="checkbox" checked={showKey} onChange={(e) => setShowKey(e.target.checked)} /> Show answer key
              </label>
            </div>
            {parsed.ok ? (
              <QuestionView
                question={parsed.q}
                caseStudy={caseStudy}
                response={showKey ? parsed.q.answerKey : undefined}
                onChange={() => undefined}
                disabled={showKey}
              />
            ) : (
              <p className="text-sm text-ink-soft">Fix validation errors to preview.</p>
            )}
          </Panel>
        </div>
      </div>
    </Shell>
  );
}
