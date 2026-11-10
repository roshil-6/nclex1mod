/**
 * Countdown helpers. Remaining time is always derived from a persisted absolute deadline
 * (epoch ms), never from an accumulating interval, so reloads and throttled tabs cannot drift.
 */
export function remainingMs(deadline: number | null, now: number = Date.now()): number | null {
  if (deadline === null) return null;
  return Math.max(0, deadline - now);
}

export function isExpired(deadline: number | null, now: number = Date.now()): boolean {
  return deadline !== null && now >= deadline;
}

/** HH:MM, rounding remaining minutes up so "00:00" is only shown once time has actually expired. */
export function formatHHMM(ms: number): string {
  const totalMin = Math.ceil(ms / 60000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function formatDuration(ms: number): string {
  const s = Math.round(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return h > 0 ? `${h}h ${m}m ${sec}s` : m > 0 ? `${m}m ${sec}s` : `${sec}s`;
}
