import { NextResponse } from "next/server";
import { db } from "@/lib/db";

type AtomLearnSkill = {
  skillId: string;
  title: string;
  overallScore: number;
  status: string;
  atomCount: number;
  attemptCount: number;
  lastPracticed: string | null;
};

function scoreToLevel(score: number): number {
  if (score >= 85) return 5;
  if (score >= 70) return 4;
  if (score >= 50) return 3;
  if (score >= 30) return 2;
  return 1;
}

export async function GET() {
  // Load config from AppConfig table
  const rows = await db.appConfig.findMany({
    where: { key: { in: ["atomlearn_api_url", "atomlearn_sync_key", "atomlearn_user_id"] } },
  });
  const cfg: Record<string, string> = {};
  for (const r of rows) cfg[r.key] = r.value;

  const apiUrl = cfg.atomlearn_api_url || process.env.ATOMLEARN_API_URL;
  const syncKey = cfg.atomlearn_sync_key || process.env.ATOMLEARN_SYNC_KEY;
  const userId = cfg.atomlearn_user_id || process.env.ATOMLEARN_USER_ID;

  if (!apiUrl || !syncKey || !userId) {
    return NextResponse.json(
      { error: "AtomLearn not configured. Go to Settings → AtomLearn Integration." },
      { status: 400 }
    );
  }

  let alSkills: AtomLearnSkill[];
  let syncedAt: string;
  try {
    const res = await fetch(apiUrl + "/api/apto/mastery?userId=" + userId, {
      headers: { Authorization: "Bearer " + syncKey },
      cache: "no-store",
    });
    if (!res.ok) {
      const err = await res.text();
      return NextResponse.json({ error: "AtomLearn API error: " + err }, { status: 502 });
    }
    const data = await res.json();
    alSkills = data.skills ?? [];
    syncedAt = data.syncedAt;
  } catch (e) {
    return NextResponse.json(
      { error: "Could not reach AtomLearn: " + (e instanceof Error ? e.message : String(e)) },
      { status: 502 }
    );
  }

  const aptoSkills = await db.skill.findMany({ where: { atomlearnTopic: { not: null } } });
  const topicToSkill: Record<string, typeof aptoSkills[0]> = {};
  for (const s of aptoSkills) {
    if (s.atomlearnTopic) topicToSkill[s.atomlearnTopic] = s;
  }

  const updated: { name: string; atomlearnSkill: string; oldLevel: number; newLevel: number; score: number }[] = [];
  const skipped: { skillId: string; title: string; reason: string }[] = [];

  for (const al of alSkills) {
    const aptoSkill = topicToSkill[al.skillId];
    if (!aptoSkill) {
      skipped.push({ skillId: al.skillId, title: al.title, reason: "No Apto skill linked" });
      continue;
    }
    if (al.attemptCount === 0) {
      skipped.push({ skillId: al.skillId, title: al.title, reason: "No attempts yet" });
      continue;
    }
    const newLevel = scoreToLevel(al.overallScore);
    if (newLevel === aptoSkill.level) {
      skipped.push({ skillId: al.skillId, title: al.title, reason: "Level unchanged (" + newLevel + ")" });
      continue;
    }
    await db.skill.update({ where: { id: aptoSkill.id }, data: { level: newLevel } });
    updated.push({ name: aptoSkill.name, atomlearnSkill: al.skillId, oldLevel: aptoSkill.level, newLevel, score: al.overallScore });
  }

  return NextResponse.json({ syncedAt, updatedCount: updated.length, skippedCount: skipped.length, updated, skipped });
}
