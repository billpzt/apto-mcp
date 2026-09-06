// Pure decision helper for CORS origin checks, kept separate from
// app/api/mcp/route.ts so it can be unit tested without importing a Next.js
// route handler.
//
// A missing Origin header is deliberately treated as allowed, not rejected.
// Hosted MCP connectors call this endpoint server to server and never send an
// Origin header at all. Only browser requests do. Only a *listed* browser
// Origin has to match explicitly; the absence of an Origin header is not
// evidence of anything and must keep passing, or the deployed hosted
// connector breaks. Do not "tighten" this to reject the no-Origin case.
export function isOriginAllowed(origin: string | null, allowed: string[]): boolean {
  if (origin === null) return true;
  return allowed.includes(origin);
}
