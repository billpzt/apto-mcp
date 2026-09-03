/**
 * OAuth 2.0 Protected Resource Metadata (RFC 9728), served at
 * /.well-known/oauth-protected-resource via the rewrite in next.config.ts.
 * Tells Claude which authorization server to use for /api/mcp.
 */
import { NextResponse } from "next/server";
import { baseUrl } from "@/lib/oauth";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: CORS_HEADERS });
}

export async function GET() {
  const base = baseUrl();
  return NextResponse.json(
    {
      resource: `${base}/api/mcp`,
      authorization_servers: [base],
    },
    { headers: CORS_HEADERS }
  );
}
