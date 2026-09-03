/**
 * Apto Remote MCP Server
 *
 * Implements the MCP Streamable HTTP transport (JSON-RPC over HTTP POST).
 * Registered in Claude Cowork as a custom connector at /api/mcp.
 *
 * Auth: validates the Authorization: Bearer <APTO_MCP_TOKEN> header (or x-api-key).
 * Production requires APTO_MCP_TOKEN and fails closed (401) when it is absent.
 * Local development may run without a token. Set APTO_MCP_TOKEN in Vercel env vars
 * and paste it in the Cowork connector "OAuth Client Secret" field.
 */

import { NextRequest, NextResponse } from "next/server";
import { ASSISTANT_TOOLS, callAssistantTool } from "@/lib/assistant-tools";
import { baseUrl } from "@/lib/oauth";

// ---------------------------------------------------------------------------
// CORS — required for Cowork making cross-origin requests
// ---------------------------------------------------------------------------

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, x-api-key, mcp-session-id",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: CORS_HEADERS });
}

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

function isAuthorized(req: NextRequest): boolean {
  const token = process.env.APTO_MCP_TOKEN;
  const production = process.env.NODE_ENV === "production";
  if (!token) return !production;
  const auth = req.headers.get("authorization");
  const bearer = auth?.startsWith("Bearer ") ? auth.slice(7) : null;
  return bearer === token || req.headers.get("x-api-key") === token;
}

// Points OAuth-aware clients (e.g. Claude's custom connector flow) at the
// Protected Resource Metadata document per RFC 9728, so they can discover
// /api/oauth/authorize and /api/oauth/token instead of failing silently.
function unauthorizedResponse() {
  const wwwAuthenticate = `Bearer resource_metadata="${baseUrl()}/.well-known/oauth-protected-resource"`;
  return NextResponse.json(
    { error: "Unauthorized" },
    { status: 401, headers: { ...CORS_HEADERS, "WWW-Authenticate": wwwAuthenticate } }
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
  if (!isAuthorized(req)) {
    return unauthorizedResponse();
  }
  // Minimal server discovery response
  return NextResponse.json(
    { name: "apto-mcp", version: "1.0.0", protocolVersion: PROTOCOL_VERSION },
    { headers: CORS_HEADERS }
  );
}

export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) {
    return unauthorizedResponse();
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error" } },
      { status: 400, headers: CORS_HEADERS }
    );
  }

  // Handle batched requests (array) or single request
  if (Array.isArray(body)) {
    const results = await Promise.all(body.map((msg) => handleMessage(msg as JsonRpcRequest)));
    const filtered = results.filter(Boolean);
    if (filtered.length === 0) return new NextResponse(null, { status: 202, headers: CORS_HEADERS });
    return NextResponse.json(filtered, { headers: CORS_HEADERS });
  }

  const result = await handleMessage(body as JsonRpcRequest);
  if (result === null) {
    return new NextResponse(null, { status: 202, headers: CORS_HEADERS });
  }
  return NextResponse.json(result, { headers: CORS_HEADERS });
}
