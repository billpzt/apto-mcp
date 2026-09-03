/**
 * GET  /api/settings/adzuna  — load current config from AppConfig
 *                              (app_key is masked, never returned in full)
 * POST /api/settings/adzuna  — save adzuna_app_id and adzuna_app_key
 */
import { NextResponse } from "next/server";
import { db } from "@/lib/db";

const KEYS = ["adzuna_app_id", "adzuna_app_key", "last_adzuna_sync"] as const;

export async function GET() {
  const rows = await db.appConfig.findMany({ where: { key: { in: [...KEYS] } } });
  const map: Record<string, string> = {};
  for (const row of rows) map[row.key] = row.value;

  // Never expose the raw app_key to the client — just signal whether it's set.
  return NextResponse.json({
    adzuna_app_id: map.adzuna_app_id ?? "",
    adzuna_app_key_set: Boolean(map.adzuna_app_key),
    last_adzuna_sync: map.last_adzuna_sync ?? null,
  });
}

export async function POST(req: Request) {
  const body = await req.json();

  const updates: { key: string; value: string }[] = [];
  if (typeof body.adzuna_app_id === "string") {
    updates.push({ key: "adzuna_app_id", value: body.adzuna_app_id.trim() });
  }
  // Only overwrite the key when a non-empty value is sent, so saving the
  // form without re-typing the key doesn't wipe it.
  if (typeof body.adzuna_app_key === "string" && body.adzuna_app_key.trim()) {
    updates.push({ key: "adzuna_app_key", value: body.adzuna_app_key.trim() });
  }

  for (const { key, value } of updates) {
    await db.appConfig.upsert({
      where: { key },
      create: { key, value },
      update: { value },
    });
  }

  return NextResponse.json({ ok: true });
}
