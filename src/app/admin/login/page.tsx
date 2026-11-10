"use client";
import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Panel, Shell, btnPrimary } from "@/components/ui/Shell";

function LoginForm() {
  const router = useRouter();
  const next = useSearchParams().get("next") ?? "/admin";
  const [pw, setPw] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <Panel className="mx-auto max-w-sm">
      <h1 className="mb-3 text-lg font-semibold">Administrator sign-in</h1>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setErr(null);
          const res = await fetch("/api/admin/login", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ password: pw }),
          });
          setBusy(false);
          if (res.ok) router.replace(next.startsWith("/admin") ? next : "/admin");
          else setErr((await res.json().catch(() => ({}))).error ?? "Sign-in failed");
        }}
      >
        <label className="mb-3 block text-sm">
          <span className="mb-1 block font-medium">Password</span>
          <input
            type="password"
            autoComplete="current-password"
            value={pw}
            onChange={(e) => setPw(e.target.value)}
            className="min-h-11 w-full rounded border border-line-strong px-2"
          />
        </label>
        {err ? (
          <p className="mb-3 text-sm text-bad" role="alert">
            {err}
          </p>
        ) : null}
        <button className={btnPrimary} disabled={busy || !pw}>
          Sign in
        </button>
      </form>
    </Panel>
  );
}

export default function AdminLogin() {
  return (
    <Shell>
      <Suspense>
        <LoginForm />
      </Suspense>
    </Shell>
  );
}
