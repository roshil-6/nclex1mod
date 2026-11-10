"use client";
import { loadSession, updateSession } from "@/lib/session/store";
import type { ExamResult, ExamSession } from "@/types/exam";

const inFlight = new Map<string, Promise<ExamSession | undefined>>();

/**
 * Submit a session exactly once. Concurrent callers (manual click + timer expiry + another
 * tab render) share one request; already-submitted sessions are returned unchanged so their
 * results stay consistent.
 */
export function submitSession(
  id: string,
  opts: { auto?: boolean; fetchImpl?: typeof fetch } = {},
): Promise<ExamSession | undefined> {
  const existing = inFlight.get(id);
  if (existing) return existing;

  const run = (async () => {
    const claimed = await updateSession(id, (s) => {
      if (s.status === "submitted") return null;
      return { ...s, status: "submitting", autoSubmitted: s.autoSubmitted || !!opts.auto };
    });
    if (!claimed) return undefined;
    if (claimed.status === "submitted") return claimed;

    const f = opts.fetchImpl ?? fetch;
    const res = await f("/api/score", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token: claimed.token, responses: claimed.responses }),
    });
    if (!res.ok) {
      // Leave as "submitting" so answers stay locked; the exam page offers a retry.
      throw new Error(`Scoring failed (${res.status})`);
    }
    const result = (await res.json()) as ExamResult;
    return updateSession(id, (s) =>
      s.status === "submitted" ? null : { ...s, status: "submitted", submittedAt: Date.now(), result },
    );
  })();

  inFlight.set(id, run);
  run.finally(() => inFlight.delete(id)).catch(() => undefined);
  return run;
}

export async function getSession(id: string) {
  return loadSession(id);
}
