import { NextResponse } from "next/server";
import { PLANNER_PASSWORD } from "../../../lib/plannerPassword";

// Separate cookie/token namespace from the main site so the two passwords are
// fully independent.
async function expectedToken() {
  const data = new TextEncoder().encode("breez-planner::" + PLANNER_PASSWORD);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function POST(request) {
  const body = await request.json().catch(() => ({}));
  const password = body.password || "";

  if (!PLANNER_PASSWORD || password !== PLANNER_PASSWORD) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set("bgl_planner", await expectedToken(), {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 30,
    path: "/",
  });
  return res;
}
