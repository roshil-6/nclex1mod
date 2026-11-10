import { describe, expect, it, vi } from "vitest";
import { formatHHMM, isExpired, remainingMs } from "@/lib/timer/timer";
import { listSessions, loadSession, saveSession, sessionFromPlan, updateSession } from "@/lib/session/store";
import { submitSession } from "@/lib/session/submit";
import type { ExamPlan, ExamResult } from "@/types/exam";

describe("timer", () => {
  it("formats HH:MM, rounding up partial minutes", () => {
    expect(formatHHMM(5 * 3600 * 1000)).toBe("05:00");
    expect(formatHHMM(59_001)).toBe("00:01");
    expect(formatHHMM(61_000)).toBe("00:02");
    expect(formatHHMM(0)).toBe("00:00");
    expect(formatHHMM(4 * 3600 * 1000 + 59 * 60 * 1000 + 1)).toBe("05:00");
  });
  it("derives remaining time from an absolute deadline", () => {
    const deadline = 1_000_000;
    expect(remainingMs(deadline, 400_000)).toBe(600_000);
    expect(remainingMs(deadline, 2_000_000)).toBe(0);
    expect(remainingMs(null)).toBeNull();
    expect(isExpired(deadline, deadline)).toBe(true);
    expect(isExpired(deadline, deadline - 1)).toBe(false);
    expect(isExpired(null)).toBe(false);
  });
});

function plan(id: string, durationSec: number | null = 600): ExamPlan {
  return {
    sessionId: id,
    mode: "quick",
    title: "T",
    bankVersion: "v1",
    questionIds: ["q1", "q2"],
    durationSec,
    immediateFeedback: false,
    token: "tok",
    questions: [],
    cases: [],
  };
}

describe("session persistence (IndexedDB)", () => {
  it("restores responses, flags, position and deadline after reload", async () => {
    const s = sessionFromPlan(plan("p1"), { mode: "quick" }, 1000);
    expect(s.deadline).toBe(1000 + 600_000);
    await saveSession(s);
    await updateSession("p1", (x) => ({ ...x, responses: { q1: { type: "single", optionId: "a" } } }));
    await updateSession("p1", (x) => ({ ...x, flagged: ["q2"], currentIndex: 1 }));
    const back = await loadSession("p1");
    expect(back?.responses.q1).toEqual({ type: "single", optionId: "a" });
    expect(back?.flagged).toEqual(["q2"]);
    expect(back?.currentIndex).toBe(1);
    expect(back?.deadline).toBe(601_000);
  });

  it("serialises concurrent updates without losing answers", async () => {
    await saveSession(sessionFromPlan(plan("p2"), { mode: "quick" }));
    await Promise.all(
      ["a", "b", "c", "d"].map((opt, i) =>
        updateSession("p2", (x) => ({ ...x, responses: { ...x.responses, [`q${i}`]: { type: "single", optionId: opt } } })),
      ),
    );
    const back = await loadSession("p2");
    expect(Object.keys(back!.responses).sort()).toEqual(["q0", "q1", "q2", "q3"]);
  });

  it("untimed sessions have no deadline", () => {
    expect(sessionFromPlan(plan("p3", null), { mode: "custom" }).deadline).toBeNull();
  });

  it("retakes are independent sessions", async () => {
    await saveSession(sessionFromPlan(plan("r1"), { mode: "quick" }));
    await saveSession(sessionFromPlan(plan("r2"), { mode: "quick" }));
    await updateSession("r1", (x) => ({ ...x, responses: { q1: { type: "single", optionId: "z" } } }));
    expect((await loadSession("r2"))?.responses).toEqual({});
    expect((await listSessions()).length).toBeGreaterThanOrEqual(2);
  });
});

describe("submission", () => {
  const result = { sessionId: "x", summary: { totalQuestions: 2 } } as unknown as ExamResult;

  it("submits exactly once under concurrent triggers and freezes the result", async () => {
    await saveSession(sessionFromPlan(plan("sub1"), { mode: "quick" }));
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify(result), { status: 200 })) as unknown as typeof fetch;
    const [a, b, c] = await Promise.all([
      submitSession("sub1", { fetchImpl }),
      submitSession("sub1", { fetchImpl, auto: true }),
      submitSession("sub1", { fetchImpl }),
    ]);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(a?.status).toBe("submitted");
    expect(b?.result).toEqual(result);
    expect(c?.id).toBe("sub1");
    // a later submit returns the stored result without re-scoring
    const again = await submitSession("sub1", { fetchImpl });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(again?.result).toEqual(result);
  });

  it("keeps the session locked and retryable when scoring fails", async () => {
    await saveSession(sessionFromPlan(plan("sub2"), { mode: "quick" }));
    const failing = vi.fn(async () => new Response("{}", { status: 500 })) as unknown as typeof fetch;
    await expect(submitSession("sub2", { fetchImpl: failing })).rejects.toThrow(/500/);
    expect((await loadSession("sub2"))?.status).toBe("submitting");
    const ok = vi.fn(async () => new Response(JSON.stringify(result), { status: 200 })) as unknown as typeof fetch;
    expect((await submitSession("sub2", { fetchImpl: ok }))?.status).toBe("submitted");
  });
});
