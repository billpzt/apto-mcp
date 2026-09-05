import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const PASSWORD = process.env.APP_PASSWORD;
const API_KEY = process.env.APTO_API_KEY;
const COOKIE = "apto_session";

export function proxy(req: NextRequest) {
  // Skip auth if no password is set (local dev without APP_PASSWORD)
  if (!PASSWORD) return NextResponse.next();

  const { pathname } = req.nextUrl;

  // Always allow the login page and its POST handler
  if (pathname === "/login") return NextResponse.next();

  // Allow all auth API routes (login, logout, change-password)
  if (pathname.startsWith("/api/auth/")) return NextResponse.next();

  // Allow remote MCP endpoint — checked by the route itself (supports Bearer token)
  if (pathname === "/api/mcp") return NextResponse.next();

  // Allow the OAuth endpoints used by the Cowork MCP connector's
  // authorization_code + PKCE flow. These gate access themselves via
  // client_id/client_secret and PKCE, and must be reachable before any
  // app session/cookie exists — the whole point is to obtain one.
  if (
    pathname === "/authorize" ||
    pathname === "/token" ||
    pathname.startsWith("/api/oauth/") ||
    pathname === "/.well-known/oauth-authorization-server" ||
    pathname === "/.well-known/oauth-protected-resource"
  ) {
    return NextResponse.next();
  }

  // Allow API routes with a valid x-api-key or Bearer token (programmatic access)
  if (pathname.startsWith("/api/") && API_KEY) {
    const requestApiKey = req.headers.get("x-api-key");
    const authHeader = req.headers.get("authorization");
    const bearerToken = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
    if (requestApiKey === API_KEY || bearerToken === API_KEY) return NextResponse.next();
  }

  // Check session cookie
  const session = req.cookies.get(COOKIE)?.value;
  if (session === PASSWORD) return NextResponse.next();

  // Redirect to login, preserving intended destination
  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.searchParams.set("from", pathname);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|public).*)"],
};
