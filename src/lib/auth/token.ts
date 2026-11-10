/**
 * HMAC-signed tokens using Web Crypto (works in Node route handlers and Edge middleware).
 * Format: base64url(JSON payload) + "." + base64url(HMAC-SHA256)
 */
const enc = new TextEncoder();

function b64url(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function fromB64url(s: string): Uint8Array {
  const pad = s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4);
  const bin = atob(pad);
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

async function hmacKey(secret: string) {
  return crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
}

export async function signToken(payload: object, secret: string): Promise<string> {
  const body = b64url(enc.encode(JSON.stringify(payload)));
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", await hmacKey(secret), enc.encode(body)));
  return `${body}.${b64url(sig)}`;
}

export async function verifyToken<T>(token: string | undefined | null, secret: string): Promise<T | null> {
  if (!token) return null;
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  try {
    const ok = await crypto.subtle.verify("HMAC", await hmacKey(secret), fromB64url(sig) as BufferSource, enc.encode(body));
    if (!ok) return null;
    return JSON.parse(new TextDecoder().decode(fromB64url(body))) as T;
  } catch {
    return null;
  }
}

const DEV_SECRET = "dev-only-insecure-secret-change-me";

/** Secret for exam-session tokens. Set SESSION_SECRET in production. */
export function sessionSecret(): string {
  const s = process.env.SESSION_SECRET;
  if (s && s.length >= 16) return s;
  if (process.env.ADMIN_PASSWORD) return `derived:${process.env.ADMIN_PASSWORD}`;
  return DEV_SECRET;
}

export const ADMIN_COOKIE = "cme_admin";
export const ADMIN_TTL_MS = 8 * 60 * 60 * 1000;

export interface AdminClaims {
  role: "admin";
  exp: number;
}

function adminSecret() {
  return `admin:${sessionSecret()}:${process.env.ADMIN_PASSWORD}`;
}

/** Admin access is disabled entirely unless ADMIN_PASSWORD is configured on the server. */
export async function isAdminToken(token: string | undefined | null): Promise<boolean> {
  if (!process.env.ADMIN_PASSWORD) return false;
  const c = await verifyToken<AdminClaims>(token, adminSecret());
  return !!c && c.role === "admin" && c.exp > Date.now();
}

export async function makeAdminToken(): Promise<string> {
  return signToken({ role: "admin", exp: Date.now() + ADMIN_TTL_MS } satisfies AdminClaims, adminSecret());
}

/** Length-independent string comparison. */
export function safeEqual(a: string, b: string): boolean {
  const A = enc.encode(a);
  const B = enc.encode(b);
  let diff = A.length ^ B.length;
  for (let i = 0; i < Math.max(A.length, B.length); i++) diff |= (A[i] ?? 0) ^ (B[i] ?? 0);
  return diff === 0;
}
