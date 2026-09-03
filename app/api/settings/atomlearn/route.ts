/**
 * GET  /api/settings/atomlearn  — load current config from AppConfig
 * POST /api/settings/atomlearn  — save config (apiUrl, userId, syncKey)
 *                                 pass action:"generate" to create a new key
 */
import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";

const KEYS = ["atomlearn_api_url", "atomlearn_user_id", "atomlearn_sync_key"] as const;

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
      where: { key: "atomlearn_sync_key" },
      create: { key: "atomlearn_sync_key", value: key },
      update: { value: key },
    });
    return NextResponse.json({ atomlearn_sync_key: key });
  }

  // Save individual fields
  const updates: { key: string; value: string }[] = [];
  if (typeof body.atomlearn_api_url === "string") updates.push({ key: "atomlearn_api_url", value: body.atomlearn_api_url });
  if (typeof body.atomlearn_user_id === "string") updates.push({ key: "atomlearn_user_id", value: body.atomlearn_user_id });
  if (typeof body.atomlearn_sync_key === "string") updates.push({ key: "atomlearn_sync_key", value: body.atomlearn_sync_key });

  for (const { key, value } of updates) {
    await db.appConfig.upsert({
      where: { key },
      create: { key, value },
      update: { value },
    });
  }

  return NextResponse.json({ ok: true });
}
