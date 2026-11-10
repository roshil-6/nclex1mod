import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { ADMIN_COOKIE, isAdminToken } from "@/lib/auth/token";

/** Defence in depth: every admin route handler re-checks the signed cookie. */
export async function requireAdmin(): Promise<NextResponse | null> {
  const jar = await cookies();
  if (await isAdminToken(jar.get(ADMIN_COOKIE)?.value)) return null;
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

export async function isAdmin(): Promise<boolean> {
  const jar = await cookies();
  return isAdminToken(jar.get(ADMIN_COOKIE)?.value);
}
