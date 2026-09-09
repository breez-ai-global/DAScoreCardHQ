import { NextResponse } from "next/server";

// Simple shared-password gate. The auth cookie holds an HMAC-ish token derived
// from SITE_PASSWORD so changing the password invalidates existing sessions.
import { SITE_PASSWORD } from "./lib/password";
import { PLANNER_PASSWORD } from "./lib/plannerPassword";

async function tokenFor(prefix, secret) {
  const data = new TextEncoder().encode(prefix + secret);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function expectedToken() {
  return tokenFor("breez-scorecard::", SITE_PASSWORD);
}

function expectedPlannerToken() {
  return tokenFor("breez-planner::", PLANNER_PASSWORD);
}

export async function middleware(request) {
  const { pathname, searchParams } = request.nextUrl;

  // ── Standalone planner: its own gate, independent of the main password ──
  if (
    pathname.startsWith("/scorecard-planner") ||
    pathname.startsWith("/api/planner-auth")
  ) {
    // Login page and the auth endpoint are always reachable.
    if (
      pathname.startsWith("/scorecard-planner/login") ||
      pathname.startsWith("/api/planner-auth")
    ) {
      return NextResponse.next();
    }
    const pc = request.cookies.get("bgl_planner");
    if (pc && pc.value === (await expectedPlannerToken())) {
      return NextResponse.next();
    }
    const url = request.nextUrl.clone();
    url.pathname = "/scorecard-planner/login";
    url.search = "";
    return NextResponse.redirect(url);
  }

  // Public paths (main site)
  if (
    pathname.startsWith("/login") ||
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/_next") ||
    pathname === "/favicon.ico" ||
    pathname.startsWith("/logo") ||
    // Coaching reports are link-shareable with DAs (ids are unguessable)
    pathname.startsWith("/coaching/view") ||
    pathname.startsWith("/api/reports/sign") ||
    (pathname === "/api/reports" && searchParams.has("id"))
  ) {
    return NextResponse.next();
  }

  const cookie = request.cookies.get("bgl_auth");
  if (cookie && cookie.value === (await expectedToken())) {
    return NextResponse.next();
  }

  const loginUrl = request.nextUrl.clone();
  loginUrl.pathname = "/login";
  loginUrl.search = "";
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
