import { NextResponse } from "next/server";
import { SITE_PASSWORD } from "./lib/password";

async function expectedToken() {
  const secret = SITE_PASSWORD;
  const data = new TextEncoder().encode("breez-scorecard::" + secret);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function middleware(request) {
  const { pathname, searchParams } = request.nextUrl;

  // Public paths
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
