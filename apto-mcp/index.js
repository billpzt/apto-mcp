#!/usr/bin/env node
/**
 * Apto MCP Server
 * Exposes Apto career dashboard as MCP tools for Claude Cowork.
 * Reads APTO_API_KEY from env or from the parent project's .env.local.
 *
 * This is a thin proxy, not a second tool registry. The tool list and every
 * call are forwarded over the wire to the app's own MCP endpoint (app/api/mcp/route.ts),
 * which is backed by lib/assistant-tools.ts — the single source of truth. Nothing
 * here hardcodes a tool name or schema, so the stdio and HTTP transports cannot
 * drift apart the way they used to (this bridge used to hardcode 4 REST-backed
 * tools — apto_list_jobs/add_job/update_job/delete_jobs — that had no equivalent
 * on the HTTP side; those are retired, see tests/mcp-parity.ts for the check
 * that keeps this file honest).
 */
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function readEnvLocal() {
  try {
    const envPath = path.join(__dirname, "../.env.local");
    const content = fs.readFileSync(envPath, "utf8");
    const match = content.match(/APTO_API_KEY="?([^"\n]+)"?/);
    return match ? match[1].trim() : null;
  } catch {
    return null;
  }
}

const API_KEY = process.env.APTO_API_KEY || readEnvLocal();

// No default instance. Point this at your own deployment, or at localhost.
// Defaulting to someone else's host would send every unconfigured client's
// requests to a stranger's database.
const BASE_URL = process.env.APTO_BASE_URL;

if (!API_KEY) {
  process.stderr.write("ERROR: APTO_API_KEY not found in env or .env.local\n");
  process.exit(1);
}

if (!BASE_URL) {
  process.stderr.write(
    "ERROR: APTO_BASE_URL is not set. Set it to your Apto instance, " +
      "e.g. http://localhost:3000\n",
  );
  process.exit(1);
}

// ---------------------------------------------------------------------------
// HTTP helper
// ---------------------------------------------------------------------------

// Neon scales the compute to zero after a few minutes idle. The first request
// after that has to wake it, and Prisma on the Vercel side can time out before
// the wake finishes, which surfaces here as a network error or a 5xx and reads
// like "Can't reach database server". A single retry after a short pause hits
// warm compute and succeeds. Only retried for GET-shaped safety: see isRetryable.
const RETRY_DELAY_MS = 2500;

// Retry only on transport failures and server-side errors. Never on 4xx, which
// are real answers (bad key, bad payload, not found) and would just repeat.
function isRetryable(status) {
  return status === 0 || status === 408 || status === 429 || status >= 500;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// `forceIdempotent` lets a caller mark a POST as safe to retry even though the
// HTTP method itself isn't GET/HEAD — used only for the tools/list discovery
// call below, which is read-only despite riding JSON-RPC-over-POST. It must
// never be set for tools/call: that's where real writes (apto_record_application
// etc.) travel, and the whole point of this flag is to leave those alone.
async function aptoFetchOnce(method, endpoint, body) {
  const url = `${BASE_URL}${endpoint}`;
  const opts = {
    method,
    headers: {
      "x-api-key": API_KEY,
      "Content-Type": "application/json",
    },
  };
  if (body !== undefined) opts.body = JSON.stringify(body);

  let res;
  try {
    res = await fetch(url, opts);
  } catch (err) {
    // Transport failure: DNS, socket, TLS, abort. Signalled as status 0.
    return { status: 0, ok: false, data: { error: String(err && err.message || err) } };
  }

  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = { raw: text };
  }
  return { status: res.status, ok: res.ok, data };
}

async function aptoFetch(method, endpoint, body, opts = {}) {
  const first = await aptoFetchOnce(method, endpoint, body);
  if (first.ok || !isRetryable(first.status)) return first;

  // Writes are not idempotent. A POST that timed out may still have landed, so
  // retrying it could double-write. Only retry when nothing was mutated.
  const idempotent = method === "GET" || method === "HEAD" || opts.forceIdempotent === true;
  if (!idempotent) {
    return {
      ...first,
      data: {
        ...first.data,
        _hint:
          "Not retried: this is a write and may have partially applied. " +
          "If this was a Neon cold start, wait a few seconds and check whether it landed before resending.",
      },
    };
  }

  process.stderr.write(
    `apto-mcp: ${method} ${endpoint} returned ${first.status}, retrying once in ${RETRY_DELAY_MS}ms (likely Neon cold start)\n`
  );
  await sleep(RETRY_DELAY_MS);

  const second = await aptoFetchOnce(method, endpoint, body);
  if (!second.ok) {
    return {
      ...second,
      data: {
        ...second.data,
        _hint: `Failed twice (${first.status} then ${second.status}). This is probably not a cold start. Check Vercel's DATABASE_URL is the -pooler endpoint with connect_timeout, and check Neon compute-hour usage.`,
      },
    };
  }
  return second;
}

// ---------------------------------------------------------------------------
// Tool list — fetched from the app, never hardcoded
// ---------------------------------------------------------------------------
//
// Decision (parity ticket, Sep 2026): this bridge used to hardcode 4 REST-backed
// tools (apto_list_jobs, apto_add_job, apto_update_job, apto_delete_jobs) that
// had no equivalent on the HTTP MCP endpoint (app/api/mcp/route.ts), which only
// ever served the 8 tools in lib/assistant-tools.ts. That made the two transports
// genuinely different products depending on which one a client happened to use.
// The README already documents "eight tools ... served two ways", so the fix is
// to make the stdio bridge a pure proxy of the HTTP endpoint rather than to keep
// a second, hand-maintained list in sync by hand. The old 4 are dropped, not
// ported: apto_list_jobs and apto_add_job are superseded by apto_get_daily_context
// (which returns the job list as part of the daily picture) and
// apto_import_job_candidates (which does the same job with dedup, and is the
// tool the rest of the app already expects agents to use). apto_delete_jobs has
// no successor — deletion was never given a typed, audited path in
// assistant-tools.ts, and this bridge shouldn't reintroduce one on its own.

let cachedTools = [];

// A JSON-RPC call to the app's own MCP endpoint. `retryable: true` marks calls
// that are read-only in effect (currently only tools/list) so aptoFetch's
// Neon-cold-start retry applies to them despite being sent as POST. Leave it
// false (the default) for anything that reaches tools/call, since some of
// those calls are writes and must keep the no-retry guarantee.
async function mcpRpc(method, params, { retryable = false } = {}) {
  const body = { jsonrpc: "2.0", id: `${method}-${Date.now()}`, method, params: params || {} };
  return aptoFetch("POST", "/api/mcp", body, { forceIdempotent: retryable });
}

async function fetchToolList() {
  const result = await mcpRpc("tools/list", {}, { retryable: true });
  if (!result.ok) {
    process.stderr.write(
      `apto-mcp: could not reach ${BASE_URL}/api/mcp for tools/list (status ${result.status}). ` +
        `Serving an empty tool list until the app is reachable; it will retry on the next tools/list request. ` +
        `${JSON.stringify(result.data)}\n`
    );
    return [];
  }
  const rpc = result.data;
  const tools = rpc && rpc.result && Array.isArray(rpc.result.tools) ? rpc.result.tools : null;
  if (!tools) {
    process.stderr.write(
      `apto-mcp: unexpected tools/list response shape from ${BASE_URL}/api/mcp: ${JSON.stringify(rpc)}\n`
    );
    return [];
  }
  return tools;
}

// Serves the cached list, refetching if it's currently empty. This is what
// makes a start-before-the-app-is-up sequence recover on its own: the bridge
// itself never crashes on an unreachable app (see fetchToolList above), it just
// keeps reporting zero tools until a client asks again after the app comes up.
async function ensureTools() {
  if (cachedTools.length === 0) {
    cachedTools = await fetchToolList();
  }
  return cachedTools;
}

// ---------------------------------------------------------------------------
// Server
// ---------------------------------------------------------------------------

const server = new Server(
  { name: "apto-mcp", version: "1.0.0" },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: await ensureTools() }));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    // Forwarded as-is, not retried (see mcpRpc/aptoFetch above): some of these
    // are writes (e.g. apto_record_application), and a write that timed out may
    // still have landed, so a blind retry here would risk the same double-write
    // class of bug the REST-tool retry rule already exists to prevent.
    const result = await mcpRpc("tools/call", { name, arguments: args || {} });
    if (!result.ok) {
      return { content: [{ type: "text", text: `Error ${result.status}: ${JSON.stringify(result.data)}` }] };
    }
    const rpc = result.data;
    if (rpc && rpc.error) {
      return { content: [{ type: "text", text: `Error: ${rpc.error.message || JSON.stringify(rpc.error)}` }] };
    }
    if (rpc && rpc.result) {
      // Already shaped as a CallToolResult ({ content: [...] }) by app/api/mcp/route.ts.
      return rpc.result;
    }
    return { content: [{ type: "text", text: `Unexpected response: ${JSON.stringify(rpc)}` }] };
  } catch (err) {
    return { content: [{ type: "text", text: `Exception: ${err.message}` }] };
  }
});

// Warm the tool list before the client can ask for it. If the app happens to
// be unreachable right now, ensureTools() has already logged why and returned
// an empty list rather than throwing — the server still starts and connects.
await ensureTools();

const transport = new StdioServerTransport();
await server.connect(transport);
