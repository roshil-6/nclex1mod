import { NextResponse } from "next/server";
import { ADMIN_COOKIE, ADMIN_TTL_MS, makeAdminToken, safeEqual } from "@/lib/auth/token";

export const dynamic = "force-dynamic";

const attempts = new Map<string, { n: number; until: number }>();

export async function POST(req: Request) {
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected) return NextResponse.json({ error: "Admin access is not configured on this server (ADMIN_PASSWORD unset)." }, { status: 503 });

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  const a = attempts.get(ip);
  if (a && a.until > Date.now()) return NextResponse.json({ error: "Too many attempts. Try again later." }, { status: 429 });

  const body = (await req.json().catch(() => ({}))) as { password?: string };
  if (!body.password || !safeEqual(body.password, expected)) {
    const n = (a?.n ?? 0) + 1;
    attempts.set(ip, { n, until: n >= 5 ? Date.now() + 5 * 60 * 1000 : 0 });
    return NextResponse.json({ error: "Incorrect password" }, { status: 401 });
  }
  attempts.delete(ip);
  const res = NextResponse.json({ ok: true });
  res.cookies.set(ADMIN_COOKIE, await makeAdminToken(), {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: ADMIN_TTL_MS / 1000,
  });
  return res;
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(ADMIN_COOKIE, "", { path: "/", maxAge: 0 });
  return res;
}
