"use client";
import { useCallback, useEffect, useState } from "react";
import type { CaseStudy, Question } from "@/lib/validation/schema";

export interface AdminQuestion extends Question {
  file: string;
  eligibility: { eligible: boolean; reasons: string[] };
}

export interface AdminBank {
  version: string;
  cases: CaseStudy[];
  invalid: { file: string; id: string; errors: string[] }[];
  questions: AdminQuestion[];
}

export function useAdminBank() {
  const [bank, setBank] = useState<AdminBank | null>(null);
  const [error, setError] = useState<string | null>(null);
  const reload = useCallback(async () => {
    const res = await fetch("/api/admin/questions", { cache: "no-store" });
    if (res.status === 401) {
      window.location.href = "/admin/login";
      return;
    }
    if (!res.ok) setError(`Failed to load (${res.status})`);
    else setBank(await res.json());
  }, []);
  useEffect(() => {
    void reload();
  }, [reload]);
  return { bank, error, reload };
}

export async function putQuestion(q: Question): Promise<string | null> {
  const res = await fetch(`/api/admin/questions/${encodeURIComponent(q.id)}`, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(q),
  });
  if (res.ok) return null;
  return (await res.json().catch(() => ({}))).error ?? `Save failed (${res.status})`;
}
