/**
 * GET  /api/settings/workspace-sync  — load sync key + last sync timestamp
 * POST /api/settings/workspace-sync  — pass action:"generate" to create a new key
 */
import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";

const KEYS = ["workspace_sync_key", "last_workspace_sync"] as const;

export async function GET() {
  const rows = await db.appConfig.findMany({ where: { key: { in: [...KEYS] } } });
  const config: Record<string, string> = {};
  for (const row of rows) config[row.key] = row.value;
  return NextResponse.json(config);
}

export async function POST(req: Request) {
  const body = await req.json();

  if (body.action === "generate") {
    const key = randomBytes(32).toString("hex");
    await db.appConfig.upsert({
      where: { key: "workspace_sync_key" },
      create: { key: "workspace_sync_key", value: key },
      update: { value: key },
    });
    return NextResponse.json({ workspace_sync_key: key });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
