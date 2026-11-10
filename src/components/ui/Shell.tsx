import Link from "next/link";

export function Shell({ children, wide = false }: { children: React.ReactNode; wide?: boolean }) {
  return (
    <div className="min-h-screen">
      <header className="border-b border-line bg-surface">
        <div className={`mx-auto flex items-center justify-between px-4 py-3 ${wide ? "max-w-6xl" : "max-w-4xl"}`}>
          <Link href="/" className="font-semibold tracking-tight text-ink">
            Clinical Mock Exam
          </Link>
          <nav className="flex gap-4 text-sm text-ink-soft">
            <Link href="/setup" className="hover:text-accent">
              New session
            </Link>
          </nav>
        </div>
      </header>
      <main className={`mx-auto px-4 py-6 ${wide ? "max-w-6xl" : "max-w-4xl"}`}>{children}</main>
    </div>
  );
}

export function Panel({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <section className={`rounded border border-line bg-surface p-4 sm:p-5 ${className}`}>{children}</section>;
}

export const btnPrimary =
  "inline-flex min-h-11 items-center justify-center rounded bg-accent px-4 text-sm font-semibold text-white hover:bg-accent-strong disabled:cursor-not-allowed disabled:opacity-40";
export const btnSecondary =
  "inline-flex min-h-11 items-center justify-center rounded border border-line-strong bg-surface px-4 text-sm font-medium text-ink hover:border-accent hover:text-accent disabled:cursor-not-allowed disabled:opacity-40";
