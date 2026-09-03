/**
 * Parity check: the stdio MCP bridge (apto-mcp/index.js) must expose exactly
 * the tool list defined once in lib/assistant-tools.ts — no more, no less.
 *
 * apto-mcp/index.js is a proxy: at runtime it fetches tools/list from the
 * app's own /api/mcp endpoint and forwards it verbatim (see its
 * fetchToolList()). So this test doesn't compare two hand-written lists —
 * it stands up a tiny fake /api/mcp backed directly by ASSISTANT_TOOLS (the
 * real source of truth), spawns the actual bridge process against it, and
 * asserts the names the bridge reports over stdio match ASSISTANT_TOOL_NAMES
 * exactly. If the bridge ever regresses to hardcoding a stale tool list (the
 * bug this ticket fixed), or if its proxy logic mis-parses the response, this
 * fails.
 *
 * Run directly: npx ts-node --project tsconfig.test.json tests/mcp-parity.ts
 */
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import http, { type Server } from "node:http";
import path from "node:path";
import { ASSISTANT_TOOL_NAMES, ASSISTANT_TOOLS } from "../lib/assistant-tools";

const REPO_ROOT = path.resolve(__dirname, "..");
const BRIDGE_PATH = path.join(REPO_ROOT, "apto-mcp", "index.js");

function startFakeMcpServer(): Promise<{ server: Server; port: number }> {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      let raw = "";
      req.on("data", (chunk) => (raw += chunk));
      req.on("end", () => {
        let msg: { id?: unknown; method?: string };
        try {
          msg = JSON.parse(raw);
        } catch {
          res.writeHead(400).end();
          return;
        }
        if (msg.method === "tools/list") {
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ jsonrpc: "2.0", id: msg.id, result: { tools: ASSISTANT_TOOLS } }));
          return;
        }
        // Anything else (initialize, tools/call, ...) — not needed for this check.
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ jsonrpc: "2.0", id: msg.id, result: {} }));
      });
    });
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        reject(new Error("fake MCP server did not bind to a port"));
        return;
      }
      resolve({ server, port: address.port });
    });
  });
}

// Reads newline-delimited JSON-RPC messages from the bridge's stdout — the
// same framing @modelcontextprotocol/sdk's stdio transport writes.
function readOneMessage(stream: NodeJS.ReadableStream, timeoutMs: number): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    let buffer = "";
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error(`Timed out after ${timeoutMs}ms waiting for a message from the bridge. Buffer so far: ${buffer}`));
    }, timeoutMs);
    function onData(chunk: Buffer) {
      buffer += chunk.toString("utf8");
      const newlineIndex = buffer.indexOf("\n");
      if (newlineIndex === -1) return;
      const line = buffer.slice(0, newlineIndex);
      cleanup();
      try {
        resolve(JSON.parse(line));
      } catch (err) {
        reject(err);
      }
    }
    function cleanup() {
      clearTimeout(timer);
      stream.removeListener("data", onData);
    }
    stream.on("data", onData);
  });
}

export async function checkMcpParity() {
  const { server, port } = await startFakeMcpServer();
  const child = spawn("node", [BRIDGE_PATH], {
    cwd: path.join(REPO_ROOT, "apto-mcp"),
    env: {
      ...process.env,
      APTO_BASE_URL: `http://127.0.0.1:${port}`,
      APTO_API_KEY: "test-key-not-a-real-secret",
    },
    stdio: ["pipe", "pipe", "pipe"],
  });

  let stderr = "";
  child.stderr.on("data", (chunk) => (stderr += chunk.toString("utf8")));

  try {
    child.stdin.write(
      JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: { protocolVersion: "2024-11-05", capabilities: {}, clientInfo: { name: "parity-test", version: "0" } },
      }) + "\n"
    );
    await readOneMessage(child.stdout, 10_000); // initialize response

    child.stdin.write(JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized", params: {} }) + "\n");

    child.stdin.write(JSON.stringify({ jsonrpc: "2.0", id: 2, method: "tools/list", params: {} }) + "\n");
    const listResponse = await readOneMessage(child.stdout, 10_000);

    const result = listResponse.result as { tools?: Array<{ name: string }> } | undefined;
    assert.ok(result && Array.isArray(result.tools), `bridge tools/list did not return a tools array: ${JSON.stringify(listResponse)}`);

    const bridgeNames = result!.tools!.map((t) => t.name).sort();
    const sourceNames = [...ASSISTANT_TOOL_NAMES].sort();

    assert.deepEqual(
      bridgeNames,
      sourceNames,
      `stdio bridge tool list diverged from lib/assistant-tools.ts.\nBridge: ${JSON.stringify(bridgeNames)}\nSource: ${JSON.stringify(sourceNames)}`
    );
  } finally {
    child.kill();
    server.close();
  }

  if (stderr) {
    // Diagnostic only — the fake server doesn't implement everything the real
    // /api/mcp does, so a stray log line here isn't itself a failure.
    process.stderr.write(`[bridge stderr]\n${stderr}`);
  }
}

// Support running this check directly: npx ts-node --project tsconfig.test.json tests/mcp-parity.ts
async function main() {
  await checkMcpParity();
}

main().catch((err) => {
  console.error("not ok - stdio/HTTP MCP tool parity");
  console.error(err);
  process.exit(1);
});
