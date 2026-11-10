import fs from "node:fs";
import path from "node:path";
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/admin";

export const dynamic = "force-dynamic";

const SCREENS = path.join(process.cwd(), "source", "screens");

/**
 * Admin-only preview of a source screenshot. Screenshots live in source/ which is git-ignored
 * and excluded from deployment, so this works only on the machine that holds them.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const { id } = await params;
  if (id === "inventory") {
    const f = path.join(SCREENS, "inventory.json");
    if (!fs.existsSync(f)) return NextResponse.json({ error: "No screenshot inventory on this server" }, { status: 404 });
    return new NextResponse(fs.readFileSync(f), { headers: { "content-type": "application/json" } });
  }
  if (!/^S\d{3}$/.test(id)) return NextResponse.json({ error: "Bad id" }, { status: 400 });
  const f = path.join(SCREENS, `${id}.jpg`);
  if (!fs.existsSync(f)) return NextResponse.json({ error: "Screenshot not available on this server" }, { status: 404 });
  return new NextResponse(fs.readFileSync(f), { headers: { "content-type": "image/jpeg", "cache-control": "private, no-store" } });
}
