/**
 * POST /api/jobs/adzuna-sync
 *
 * Server-side Adzuna sync. Reads credentials from AppConfig, runs a fixed set
 * of role/company searches, then upserts results into the Job table.
 *
 * No request body — credentials come from AppConfig.
 */
import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

type AdzunaJob = {
  id: string;
  title?: string;
  description?: string;
  redirect_url?: string;
  salary_min?: number;
  salary_max?: number;
  salary_is_predicted?: string | number;
  company?: { display_name?: string };
  location?: { display_name?: string };
};

type Search = {
  country: "br" | "us" | "gb";
  what: string;
  where: string;
  label: string;
  // For company-targeted searches: only keep results whose company matches.
  companyFilter?: string;
};

// NOTE: Adzuna's `where` param expects a real city/region string — "remote" is not
// a valid location and returns 0 results. For remote searches we omit `where`
// entirely (broadest scope) and rely on keyword matching in `what`.
// US role searches excluded — most require local work authorization.
// US company-targeted searches (below) still run for remote-first companies that hire globally.
const ROLE_SEARCHES: Search[] = [
  { country: "br", what: "automation engineer remote", where: "", label: "BR - Automation Engineer" },
  { country: "br", what: "rpa engineer remote", where: "", label: "BR - RPA Engineer" },
  { country: "br", what: "python automation remote", where: "", label: "BR - Python Automation" },
  { country: "br", what: "process automation remote", where: "", label: "BR - Process Automation" },
  { country: "gb", what: "automation engineer remote", where: "", label: "GB - Automation Engineer" },
  { country: "gb", what: "rpa engineer remote", where: "", label: "GB - RPA Engineer" },
];

const TARGET_COMPANIES = [
  "Zapier", "Automattic", "Elastic", "Twilio", "EPAM",
  "Crossover", "CircleCI", "Klaviyo", "Iterative", "Formstack",
];

const COMPANY_SEARCHES: Search[] = TARGET_COMPANIES.map((c) => ({
  country: "us" as const,
  what: `${c} engineer developer`,
  where: "",
  label: `Company - ${c}`,
  companyFilter: c,
}));

const ALL_SEARCHES = [...ROLE_SEARCHES, ...COMPANY_SEARCHES];

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function formatSalary(job: AdzunaJob, country: Search["country"]): string | null {
  const min = job.salary_min;
  const max = job.salary_max;
  if (!min && !max) return null;

  const k = (n: number) => `${Math.round(n / 1000)}k`;
  const prefix = country === "br" ? "R$" : country === "gb" ? "£" : "$";

  let out: string;
  if (min && max) out = `${prefix}${k(min)}–${prefix}${k(max)}`;
  else out = `${prefix}${k((min || max) as number)}`;

  const predicted = job.salary_is_predicted === "1" || job.salary_is_predicted === 1;
  if (predicted) out += " (est.)";
  return out;
}

async function runSearch(search: Search, appId: string, appKey: string): Promise<AdzunaJob[]> {
  const params = new URLSearchParams({
    app_id: appId,
    app_key: appKey,
    results_per_page: "20",
    what: search.what,
  });
  // Only include `where` when it's a real location string (not empty / "remote").
  if (search.where) params.set("where", search.where);
  const url = `https://api.adzuna.com/v1/api/jobs/${search.country}/search/1?${params.toString()}`;

  let res: Response;
  try {
    res = await fetch(url);
  } catch {
    console.warn(`Adzuna network error for "${search.label}" — skipping`);
    return [];
  }

  if (!res.ok) {
    // Log and skip — don't abort the whole sync over one bad search.
    console.warn(`Adzuna returned ${res.status} for "${search.label}" — skipping`);
    return [];
  }

  const data = (await res.json()) as { results?: AdzunaJob[] };
  let results = data.results ?? [];

  if (search.companyFilter) {
    const needle = search.companyFilter.toLowerCase();
    results = results.filter((j) =>
      (j.company?.display_name ?? "").toLowerCase().includes(needle)
    );
  }
  return results;
}

export async function POST() {
  // 1. Load credentials
  const rows = await db.appConfig.findMany({
    where: { key: { in: ["adzuna_app_id", "adzuna_app_key"] } },
  });
  const cfg: Record<string, string> = {};
  for (const r of rows) cfg[r.key] = r.value;
  const appId = cfg.adzuna_app_id;
  const appKey = cfg.adzuna_app_key;

  if (!appId || !appKey) {
    return NextResponse.json(
      { error: "Adzuna credentials not configured. Add them in Settings." },
      { status: 400 }
    );
  }

  // 2. Run all searches, with a 300ms gap to avoid rate limiting.
  // Each search handles its own errors — a single 5xx never aborts the whole sync.
  const collected = new Map<string, { job: AdzunaJob; country: Search["country"] }>();
  for (let i = 0; i < ALL_SEARCHES.length; i++) {
    const search = ALL_SEARCHES[i];
    const results = await runSearch(search, appId, appKey);
    for (const job of results) {
      if (job?.id && !collected.has(job.id)) {
        collected.set(job.id, { job, country: search.country });
      }
    }
    if (i < ALL_SEARCHES.length - 1) await sleep(300);
  }

  // 4. Upsert each unique job.
  let created = 0;
  let updated = 0;
  let skipped = 0;

  for (const { job, country } of collected.values()) {
    const existing = await db.job.findUnique({ where: { adzunaId: job.id } });
    const salary = formatSalary(job, country);
    const company = job.company?.display_name ?? "Unknown";
    const location = job.location?.display_name ?? null;

    if (existing) {
      if (existing.status === "BACKLOG") {
        await db.job.update({
          where: { id: existing.id },
          data: {
            title: job.title ?? existing.title,
            company,
            location,
            url: job.redirect_url ?? existing.url,
            salary,
          },
        });
        updated++;
      } else {
        skipped++;
      }
    } else {
      await db.job.create({
        data: {
          title: job.title ?? "Untitled",
          company,
          location,
          url: job.redirect_url ?? null,
          salary,
          status: "BACKLOG",
          sourceType: "adzuna",
          adzunaId: job.id,
          notes: job.description ?? null,
        },
      });
      created++;
    }
  }

  // 5. Stale handling — BACKLOG adzuna jobs not in this fetch become STALLED.
  let stalled = 0;
  const fetchedIds = new Set(collected.keys());
  const backlogAdzuna = await db.job.findMany({
    where: { adzunaId: { not: null }, status: "BACKLOG" },
  });
  const today = new Date().toISOString().slice(0, 10);
  for (const job of backlogAdzuna) {
    if (job.adzunaId && !fetchedIds.has(job.adzunaId)) {
      await db.job.update({
        where: { id: job.id },
        data: {
          status: "STALLED",
          notes:
            (job.notes ?? "") +
            `\n[Adzuna: listing no longer found - ${today}]`,
        },
      });
      stalled++;
    }
  }

  // 6. Record sync timestamp.
  const syncedAt = new Date().toISOString();
  await db.appConfig.upsert({
    where: { key: "last_adzuna_sync" },
    create: { key: "last_adzuna_sync", value: syncedAt },
    update: { value: syncedAt },
  });

  return NextResponse.json({
    ok: true,
    synced_at: syncedAt,
    jobs: { created, updated, stalled, skipped },
  });
}
