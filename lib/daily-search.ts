import type { SerializedJob } from "./types";

export const DAILY_APPLICATION_FLOOR = 3;
export const DEFAULT_TIME_ZONE = "America/Sao_Paulo";

const READY_GRADES = new Set(["A", "B"]);
const CLOSED_STATUSES = new Set(["PROFILE_LIVE", "CLOSED", "REJECTED", "WITHDRAWN"]);
const WARM_SOURCES = new Set(["referral", "recruiter_inbound"]);

export type RankedApplicationJob = {
  job: SerializedJob;
  rank: number;
  reasons: string[];
};

export type DailyApplicationQueue = {
  dailyFloor: number;
  submittedToday: number;
  submittedThisWeek: number;
  remainingToFloor: number;
  minimumComplete: boolean;
  todayThree: RankedApplicationJob[];
  moreStrongMatches: RankedApplicationJob[];
  needsDecision: RankedApplicationJob[];
};

export function dayKeyInTimeZone(date: Date, timeZone = DEFAULT_TIME_ZONE): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${value.year}-${value.month}-${value.day}`;
}

function weekStartKey(now: Date, timeZone: string): string {
  const key = dayKeyInTimeZone(now, timeZone);
  const [year, month, day] = key.split("-").map(Number);
  const localDate = new Date(Date.UTC(year, month - 1, day));
  const weekday = localDate.getUTCDay();
  const offset = weekday === 0 ? 6 : weekday - 1;
  localDate.setUTCDate(localDate.getUTCDate() - offset);
  return localDate.toISOString().slice(0, 10);
}

function rankJob(job: SerializedJob, now: Date): RankedApplicationJob {
  let rank = 0;
  const reasons: string[] = [];
  if (job.priority === "high") { rank += 40; reasons.push("high priority"); }
  if (job.score === "A") { rank += 30; reasons.push("A fit"); }
  else if (job.score === "B") { rank += 20; reasons.push("B fit"); }
  else if (job.score === "C") { rank += 10; reasons.push("stretch fit"); }
  if (job.eligibleFromBrazil === "eligible") { rank += 20; reasons.push("Brazil eligible"); }
  if (job.canonicalUrl || job.url) { rank += 10; reasons.push("application URL available"); }
  if (WARM_SOURCES.has(job.sourceType ?? "")) { rank += 15; reasons.push("warm source"); }
  const freshness = job.lastVerifiedAt ?? job.postedAt ?? job.createdAt;
  const ageDays = Math.floor((now.getTime() - new Date(freshness).getTime()) / 86_400_000);
  if (ageDays <= 7) { rank += 10; reasons.push("recently verified"); }
  return { job, rank, reasons };
}

export function buildDailyApplicationQueue(
  jobs: SerializedJob[],
  now = new Date(),
  timeZone = DEFAULT_TIME_ZONE
): DailyApplicationQueue {
  const todayKey = dayKeyInTimeZone(now, timeZone);
  const mondayKey = weekStartKey(now, timeZone);
  const appliedKeys = jobs
    .filter((job) => job.appliedAt)
    .map((job) => dayKeyInTimeZone(new Date(job.appliedAt as string), timeZone));
  const submittedToday = appliedKeys.filter((key) => key === todayKey).length;
  const submittedThisWeek = appliedKeys.filter((key) => key >= mondayKey && key <= todayKey).length;

  const candidates = jobs
    .filter((job) => job.status === "BACKLOG")
    .filter((job) => !CLOSED_STATUSES.has(job.status))
    .filter((job) => job.eligibleFromBrazil !== "ineligible")
    .map((job) => rankJob(job, now))
    .sort((a, b) => b.rank - a.rank || a.job.company.localeCompare(b.job.company));

  const ready = candidates.filter(({ job }) =>
    job.eligibleFromBrazil === "eligible" &&
    READY_GRADES.has(job.score ?? "") &&
    Boolean(job.canonicalUrl || job.url)
  );
  const readyIds = new Set(ready.map(({ job }) => job.id));
  const needsDecision = candidates.filter(({ job }) => !readyIds.has(job.id));

  return {
    dailyFloor: DAILY_APPLICATION_FLOOR,
    submittedToday,
    submittedThisWeek,
    remainingToFloor: Math.max(0, DAILY_APPLICATION_FLOOR - submittedToday),
    minimumComplete: submittedToday >= DAILY_APPLICATION_FLOOR,
    todayThree: ready.slice(0, DAILY_APPLICATION_FLOOR),
    moreStrongMatches: ready.slice(DAILY_APPLICATION_FLOOR),
    needsDecision,
  };
}
