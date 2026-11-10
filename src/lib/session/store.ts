"use client";
import { createStore, del, get, set, values, type UseStore } from "idb-keyval";
import type { ExamConfig, ExamPlan, ExamSession } from "@/types/exam";

/**
 * Guest persistence in IndexedDB. Every mutation goes through `update`, which serialises
 * writes per session so rapid answer changes cannot overwrite each other.
 */
let store: UseStore | null = null;
function db(): UseStore {
  if (!store) store = createStore("clinical-mock-exam", "sessions");
  return store;
}

const queues = new Map<string, Promise<unknown>>();

export function sessionFromPlan(plan: ExamPlan, config: ExamConfig, now = Date.now()): ExamSession {
  return {
    id: plan.sessionId,
    mode: plan.mode,
    config,
    title: plan.title,
    bankVersion: plan.bankVersion,
    token: plan.token,
    questionIds: plan.questionIds,
    questions: plan.questions,
    cases: plan.cases,
    immediateFeedback: plan.immediateFeedback,
    createdAt: now,
    durationSec: plan.durationSec,
    deadline: plan.durationSec ? now + plan.durationSec * 1000 : null,
    currentIndex: 0,
    responses: {},
    flagged: [],
    checked: {},
    status: "active",
    submittedAt: null,
    autoSubmitted: false,
    result: null,
  };
}

export async function saveSession(s: ExamSession): Promise<void> {
  await set(s.id, s, db());
}

export async function loadSession(id: string): Promise<ExamSession | undefined> {
  return get<ExamSession>(id, db());
}

export async function listSessions(): Promise<ExamSession[]> {
  const all = await values<ExamSession>(db());
  return all.sort((a, b) => b.createdAt - a.createdAt);
}

export async function deleteSession(id: string): Promise<void> {
  await del(id, db());
}

/**
 * Atomically read-modify-write a session. The mutator must return the next state or null to
 * leave it untouched. Submitted sessions are immutable except for status bookkeeping done by
 * the submit flow itself.
 */
export function updateSession(
  id: string,
  mutate: (s: ExamSession) => ExamSession | null,
): Promise<ExamSession | undefined> {
  const prev = queues.get(id) ?? Promise.resolve();
  const next = prev.then(async () => {
    const cur = await loadSession(id);
    if (!cur) return undefined;
    const out = mutate(cur);
    if (!out) return cur;
    await saveSession(out);
    return out;
  });
  queues.set(
    id,
    next.catch(() => undefined),
  );
  return next;
}
