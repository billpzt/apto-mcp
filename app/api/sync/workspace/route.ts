/**
 * POST /api/sync/workspace — Cowork pushes workspace markdown data here.
 * Auth: Authorization: Bearer <workspace_sync_key> (AppConfig).
 * Upserts jobs (company+title), skills (name), contacts (name) — never deletes.
 */
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { JOB_STATUSES } from "@/lib/constants";

type SyncJob = {
  title: string;
  company: string;
  url?: string;
  status: string;
  location?: string;
  salary?: string;
  jobType?: string;
  notes?: string;
  score?: string;
  followUpDate?: string | null;
  lastContactDate?: string | null;
  appliedAt?: string | null;
};

type SyncSkill = { name: string; level?: number; notes?: string };
type SyncContact = { name: string; company?: string; role?: string; notes?: string };

type SyncBody = { jobs?: SyncJob[]; skills?: SyncSkill[]; contacts?: SyncContact[] };

function toDate(value: string | null | undefined): Date | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

async function syncJobs(jobs: SyncJob[]) {
  let created = 0, updated = 0, skipped = 0;
  for (const j of jobs) {
    if (!j.title || !j.company || !JOB_STATUSES.includes(j.status as never)) {
      skipped++;
      continue;
    }
    const existing = await db.job.findFirst({
      where: {
        company: { equals: j.company, mode: "insensitive" },
        title: { equals: j.title, mode: "insensitive" },
      },
    });
    const data = {
      title: j.title,
      company: j.company,
      url: j.url ?? undefined,
      status: j.status,
      location: j.location ?? undefined,
      salary: j.salary ?? undefined,
      jobType: j.jobType ?? undefined,
      notes: j.notes ?? undefined,
      score: j.score ?? undefined,
      followUpDate: toDate(j.followUpDate),
      lastContactDate: toDate(j.lastContactDate),
      appliedAt: toDate(j.appliedAt),
    };
    if (existing) {
      await db.job.update({ where: { id: existing.id }, data });
      updated++;
    } else {
      await db.job.create({ data });
      created++;
    }
  }
  return { created, updated, skipped };
}

async function syncSkills(skills: SyncSkill[]) {
  let created = 0, updated = 0, skipped = 0;
  for (const s of skills) {
    if (!s.name) {
      skipped++;
      continue;
    }
    const existing = await db.skill.findFirst({
      where: { name: { equals: s.name, mode: "insensitive" } },
    });
    const data = {
      name: s.name,
      level: s.level ?? undefined,
      notes: s.notes ?? undefined,
    };
    if (existing) {
      await db.skill.update({ where: { id: existing.id }, data });
      updated++;
    } else {
      await db.skill.create({ data: { ...data, level: s.level ?? 3 } });
      created++;
    }
  }
  return { created, updated, skipped };
}

async function syncContacts(contacts: SyncContact[]) {
  let created = 0, updated = 0, skipped = 0;
  for (const c of contacts) {
    if (!c.name) {
      skipped++;
      continue;
    }
    const existing = await db.contact.findFirst({
      where: { name: { equals: c.name, mode: "insensitive" } },
    });
    const data = {
      name: c.name,
      company: c.company ?? undefined,
      title: c.role ?? undefined,
      notes: c.notes ?? undefined,
    };
    if (existing) {
      await db.contact.update({ where: { id: existing.id }, data });
      updated++;
    } else {
      await db.contact.create({ data });
      created++;
    }
  }
  return { created, updated, skipped };
}

export async function POST(req: Request) {
  const config = await db.appConfig.findUnique({ where: { key: "workspace_sync_key" } });
  const expectedKey = config?.value;
  const auth = req.headers.get("authorization");
  const providedKey = auth?.startsWith("Bearer ") ? auth.slice(7) : null;

  if (!expectedKey || !providedKey || providedKey !== expectedKey) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body: SyncBody = await req.json();

  const jobs = await syncJobs(body.jobs ?? []);
  const skills = await syncSkills(body.skills ?? []);
  const contacts = await syncContacts(body.contacts ?? []);

  const synced_at = new Date().toISOString();
  await db.appConfig.upsert({
    where: { key: "last_workspace_sync" },
    create: { key: "last_workspace_sync", value: synced_at },
    update: { value: synced_at },
  });

  return NextResponse.json({ ok: true, synced_at, jobs, skills, contacts });
}
