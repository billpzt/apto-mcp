import { deriveFunnelCounts, responseRate } from './funnel';

const DAY = 86_400_000;

type ReportJob = {
  id: string;
  company: string;
  title: string;
  canonicalUrl: string | null;
  appliedAt: Date | null;
  status: string;
  sourceType: string | null;
  followUpDate: Date | null;
};

type ReportAction = {
  title: string;
  dueDate: Date | null;
  status: string;
};

function line(value: string) {
  return value.replace(/\s+/g, " ").replace(/[<>]/g, "").trim();
}

function counts(values: string[]) {
  const totals = new Map<string, number>();
  for (const value of values) totals.set(value, (totals.get(value) ?? 0) + 1);
  return [...totals].sort(([a, n], [b, m]) => m - n || a.localeCompare(b))
    .map(([label, total]) => `- ${line(label)}: ${total}`);
}

export function buildApplicationReport(jobs: ReportJob[], actions: ReportAction[], days: number, now: Date) {
  const end = now.getTime();
  const start = end - days * DAY;
  const unique = new Map<string, ReportJob>();
  const submitted = jobs.filter((job) => job.appliedAt && job.appliedAt.getTime() <= end)
    .sort((a, b) => a.appliedAt!.getTime() - b.appliedAt!.getTime());
  for (const job of submitted) {
    const key = job.canonicalUrl?.trim() || job.id;
    if (!unique.has(key)) unique.set(key, job);
  }

  const cohort = [...unique.values()].filter((job) => job.appliedAt!.getTime() >= start);
  const { respondedCount } = deriveFunnelCounts(cohort);
  const rate = responseRate(cohort.length, respondedCount);
  const awaiting = cohort.filter((job) => job.status === "APPLIED" || job.status === "STALLED");
  const rejected = cohort.filter((job) => job.status === "REJECTED").length;
  const followUps = [...unique.values()].filter((job) =>
    job.followUpDate && job.followUpDate.getTime() <= end + 7 * DAY &&
    ["APPLIED", "ASSESSMENT", "STANDBY", "STALLED"].includes(job.status),
  ).sort((a, b) => a.followUpDate!.getTime() - b.followUpDate!.getTime());
  const dueActions = actions.filter((action) => action.status === "open" &&
    action.dueDate && action.dueDate.getTime() <= end + 7 * DAY);
  const date = (value: Date) => value.toISOString().slice(0, 10);
  const section = (title: string, rows: string[]) => ["", `## ${title}`, ...(rows.length ? rows : ["None recorded."])];

  return [
    "# Application report",
    "",
    `Submissions in the last ${days} days (${date(new Date(start))} to ${date(now)}, UTC).`,
    "",
    `- Unique tracked submissions: ${cohort.length}`,
    `- Status-based responses: ${respondedCount}${rate === null ? "" : ` (${rate}%)`}`,
    `- Currently applied or stalled: ${awaiting.length}`,
    `- Currently in assessment: ${cohort.filter((job) => job.status === "ASSESSMENT").length}`,
    `- Currently rejected: ${rejected}${cohort.length ? ` (${(100 * rejected / cohort.length).toFixed(1)}% of submissions)` : ""}`,
    ...section("Current status", counts(cohort.map((job) => job.status))),
    ...section("Application sources", counts(cohort.map((job) => job.sourceType || "Unspecified"))),
    ...section("Applications currently applied or stalled", awaiting.map((job) =>
      `- ${line(job.company)} / ${line(job.title)} (${date(job.appliedAt!)})`)),
    ...section("Follow-ups due within seven days or overdue", followUps.map((job) =>
      `- ${date(job.followUpDate!)}: ${line(job.company)} / ${line(job.title)}`)),
    ...section("Open actions due within seven days or overdue", dueActions.map((action) =>
      `- ${date(action.dueDate!)}: ${line(action.title)}`)),
    "",
    "Counts use the first recorded submission per canonical URL or job ID. Records without a submission date are excluded.",
    "Status counts describe the current pipeline. The response estimate uses assessment, standby, closed and rejected statuses. Interview and offer totals and first-response time require structured outcome events.",
  ].join("\n");
}
