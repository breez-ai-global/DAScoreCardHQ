import { NextResponse } from "next/server";
import { SITE_PASSWORD } from "../../../lib/password";

async function expectedToken() {
  const secret = SITE_PASSWORD;
  const data = new TextEncoder().encode("breez-scorecard::" + secret);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function POST(request) {
  const body = await request.json().catch(() => ({}));
  const password = body.password || "";

  if (!SITE_PASSWORD || password !== SITE_PASSWORD) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set("bgl_auth", await expectedToken(), {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 30,
    path: "/",
  });
  return res;
}
