/**
 * Apto Remote MCP Server
 *
 * Implements the MCP Streamable HTTP transport (JSON-RPC over HTTP POST).
 * Registered in Claude Cowork as a custom connector at /api/mcp.
 *
 * Auth: validates the Authorization: Bearer <APTO_MCP_TOKEN> header (or x-api-key).
 * APTO_MCP_TOKEN is required in every environment and the route fails closed
 * (401) when it is absent, development included. Set APTO_MCP_TOKEN in your
 * host's env vars and paste it in the Cowork connector "OAuth Client Secret" field.
 */

import { NextRequest, NextResponse } from "next/server";
import { ASSISTANT_TOOLS, callAssistantTool } from "@/lib/assistant-tools";
import { baseUrl } from "@/lib/oauth";
import { isOriginAllowed } from "@/lib/origin";

// ---------------------------------------------------------------------------
// CORS — required for Cowork making cross-origin requests
// ---------------------------------------------------------------------------

// Hosted connectors call this server to server and send no Origin at all, so
// echoing "*" bought nothing and let any web page on any site talk to the
// endpoint. Browser origins now have to be named explicitly.
const ALLOWED_ORIGINS = (process.env.APTO_ALLOWED_ORIGINS ?? "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

function corsHeaders(req: NextRequest): Record<string, string> {
  const headers: Record<string, string> = {
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, x-api-key, mcp-session-id",
    Vary: "Origin",
  };
  const origin = req.headers.get("origin");
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    headers["Access-Control-Allow-Origin"] = origin;
  }
  return headers;
}

// An unlisted browser Origin is rejected outright, not merely left off the
// CORS response. A stale Access-Control-Allow-Origin isn't a real barrier
// since only the browser enforces CORS. A missing Origin (server-to-server,
// e.g. a hosted MCP connector) is intentionally NOT rejected here: see
// isOriginAllowed in lib/origin.ts for why, so nobody "fixes" this later and
// breaks the deployed connector.
function rejectedOrigin(req: NextRequest): NextResponse | null {
  const origin = req.headers.get("origin");
  if (isOriginAllowed(origin, ALLOWED_ORIGINS)) return null;
  return new NextResponse(null, { status: 403, headers: { Vary: "Origin" } });
}

export async function OPTIONS(req: NextRequest) {
  const rejected = rejectedOrigin(req);
  if (rejected) return rejected;
  return new NextResponse(null, { status: 200, headers: corsHeaders(req) });
}

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

function isAuthorized(req: NextRequest): boolean {
  const token = process.env.APTO_MCP_TOKEN;
  // No token, no access, development included. This endpoint reads and writes
  // the whole pipeline, and "it is only bound to localhost" is not a control:
  // any page in the browser can reach localhost, and the dev server is often
  // reachable from the local network.
  if (!token) return false;
  const auth = req.headers.get("authorization");
  const bearer = auth?.startsWith("Bearer ") ? auth.slice(7) : null;
  return bearer === token || req.headers.get("x-api-key") === token;
}

// Points OAuth-aware clients (e.g. Claude's custom connector flow) at the
// Protected Resource Metadata document per RFC 9728, so they can discover
// /api/oauth/authorize and /api/oauth/token instead of failing silently.
function unauthorizedResponse(req: NextRequest) {
  const wwwAuthenticate = `Bearer resource_metadata="${baseUrl()}/.well-known/oauth-protected-resource"`;
  return NextResponse.json(
    { error: "Unauthorized" },
    { status: 401, headers: { ...corsHeaders(req), "WWW-Authenticate": wwwAuthenticate } }
  );
}

// ---------------------------------------------------------------------------
// MCP protocol constants
// ---------------------------------------------------------------------------

const PROTOCOL_VERSION = "2024-11-05";
const SERVER_INFO = { name: "apto-mcp", version: "1.0.0" };

// ---------------------------------------------------------------------------
// JSON-RPC message handler
// ---------------------------------------------------------------------------

interface JsonRpcRequest {
  jsonrpc: string;
  id?: string | number | null;
  method?: string;
  params?: Record<string, unknown>;
}

async function handleMessage(msg: JsonRpcRequest) {
  const { jsonrpc, id, method, params } = msg;

  if (jsonrpc !== "2.0") {
    return { jsonrpc: "2.0", id, error: { code: -32600, message: "Invalid Request" } };
  }

  // Notifications never get a response
  if (method?.startsWith("notifications/")) return null;

  if (method === "initialize") {
    return {
      jsonrpc: "2.0",
      id,
      result: {
        protocolVersion: PROTOCOL_VERSION,
        capabilities: { tools: {} },
        serverInfo: SERVER_INFO,
      },
    };
  }

  if (method === "ping") {
    return { jsonrpc: "2.0", id, result: {} };
  }

  if (method === "tools/list") {
    return { jsonrpc: "2.0", id, result: { tools: ASSISTANT_TOOLS } };
  }

  if (method === "tools/call") {
    const { name, arguments: toolArgs } = (params ?? {}) as {
      name: string;
      arguments: Record<string, unknown>;
    };
    try {
      const result = await callAssistantTool(name, toolArgs ?? {});
      return {
        jsonrpc: "2.0",
        id,
        result: { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] },
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        jsonrpc: "2.0",
        id,
        error: { code: -32000, message: `Tool error: ${message}` },
      };
    }
  }

  return {
    jsonrpc: "2.0",
    id,
    error: { code: -32601, message: `Method not found: ${method}` },
  };
}

// ---------------------------------------------------------------------------
// Route handlers
// ---------------------------------------------------------------------------

export async function GET(req: NextRequest) {
  const rejected = rejectedOrigin(req);
  if (rejected) return rejected;
  if (!isAuthorized(req)) {
    return unauthorizedResponse(req);
  }
  // Minimal server discovery response
  return NextResponse.json(
    { name: "apto-mcp", version: "1.0.0", protocolVersion: PROTOCOL_VERSION },
    { headers: corsHeaders(req) }
  );
}

export async function POST(req: NextRequest) {
  const rejected = rejectedOrigin(req);
  if (rejected) return rejected;
  if (!isAuthorized(req)) {
    return unauthorizedResponse(req);
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error" } },
      { status: 400, headers: corsHeaders(req) }
    );
  }

  // Handle batched requests (array) or single request
  if (Array.isArray(body)) {
    const results = await Promise.all(body.map((msg) => handleMessage(msg as JsonRpcRequest)));
    const filtered = results.filter(Boolean);
    if (filtered.length === 0) return new NextResponse(null, { status: 202, headers: corsHeaders(req) });
    return NextResponse.json(filtered, { headers: corsHeaders(req) });
  }

  const result = await handleMessage(body as JsonRpcRequest);
  if (result === null) {
    return new NextResponse(null, { status: 202, headers: corsHeaders(req) });
  }
  return NextResponse.json(result, { headers: corsHeaders(req) });
}
