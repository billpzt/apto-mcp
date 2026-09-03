import { STALE_THRESHOLDS } from "./constants";
import { daysBetween, isDueOrOverdue } from "./date";
import type { SerializedActionItem, SerializedDirectoryItem, SerializedJob } from "./types";

export type DashboardInput = {
  jobs: SerializedJob[];
  actions: SerializedActionItem[];
  directoryItems: SerializedDirectoryItem[];
};

export type DashboardSections = {
  summary: {
    activeJobs: number;
    highPriorityJobs: number;
    openActions: number;
    dueToday: number;
    staleJobs: number;
  };
  todayActions: DashboardAction[];
  hotPipeline: SerializedJob[];
  staleOpportunities: SerializedJob[];
  prepQueue: SerializedActionItem[];
  directoryDue: SerializedDirectoryItem[];
};

const CLOSED_STATUSES = new Set(["CLOSED", "REJECTED", "WITHDRAWN"]);
const WARM_SOURCE_TYPES = new Set(["referral", "recruiter_inbound"]);

export type DashboardAction = {
  id: string;
  source: "action_item" | "job_follow_up" | "job_prep" | "stale_job" | "directory_check";
  title: string;
  kind: string;
  dueDate: string | null;
  reason: string;
  rank: number;
  canComplete: boolean;
  canTrack: boolean;
  actionItemId: string | null;
  job: Pick<SerializedJob, "id" | "company" | "title" | "status" | "score" | "priority"> | null;
  directoryItem: Pick<SerializedDirectoryItem, "id" | "name" | "category"> | null;
};

export type ActionCreatePayload = {
  title: string;
  kind: string;
  status: "open";
  dueDate: string | null;
  jobId: string | null;
  contactId: string | null;
  notes: string | null;
};

export function buildActionCreatePayload(action: DashboardAction): ActionCreatePayload {
  return {
    title: action.title,
    kind: action.kind,
    status: "open",
    dueDate: action.dueDate,
    jobId: action.job?.id ?? null,
    contactId: null,
    notes: `Derived from dashboard: ${action.reason}`,
  };
}

function jobHeat(job: SerializedJob): number {
  let score = 0;
  if (job.priority === "high") score += 50;
  if (WARM_SOURCE_TYPES.has(job.sourceType ?? "")) score += 30;
  if (job.score === "A") score += 20;
  if (job.score === "B") score += 10;
  if (job.status === "ASSESSMENT") score += 15;
  if (job.status === "STANDBY") score += 15;
  if (job.followUpDate && isDueOrOverdue(job.followUpDate)) score += 10;
  return score;
}

function isStaleJob(job: SerializedJob, now: Date): boolean {
  if (CLOSED_STATUSES.has(job.status)) return false;
  if (job.status === "APPLIED") {
    const days = daysBetween(job.lastContactDate ?? job.appliedAt ?? job.createdAt, now);
    return days !== null && days >= STALE_THRESHOLDS.appliedFollowUpDays;
  }
  if (job.status === "BACKLOG") {
    const days = daysBetween(job.createdAt, now);
    return days !== null && days >= STALE_THRESHOLDS.backlogDecisionDays;
  }
  return false;
}

function hasOpenActionForJob(
  actions: SerializedActionItem[],
  jobId: string,
  kinds: string[]
): boolean {
  return actions.some((action) => (
    action.status === "open" &&
    action.jobId === jobId &&
    kinds.includes(action.kind)
  ));
}

function toJobSummary(job: SerializedJob): DashboardAction["job"] {
  return {
    id: job.id,
    company: job.company,
    title: job.title,
    status: job.status,
    score: job.score,
    priority: job.priority,
  };
}

function buildTodayActions(
  input: DashboardInput,
  activeJobs: SerializedJob[],
  staleJobs: SerializedJob[],
  directoryDue: SerializedDirectoryItem[],
  now: Date
): DashboardAction[] {
  const openActions = input.actions.filter((action) => action.status === "open");
  const explicitActions: DashboardAction[] = openActions
    .filter((action) => isDueOrOverdue(action.dueDate, now))
    .map((action) => ({
      id: `action:${action.id}`,
      source: "action_item",
      title: action.title,
      kind: action.kind,
      dueDate: action.dueDate,
      reason: action.dueDate ? "Scheduled action due" : "Open action",
      rank: action.kind === "prep" ? 90 : 80,
      canComplete: true,
      canTrack: false,
      actionItemId: action.id,
      job: action.job
        ? {
            id: action.job.id,
            company: action.job.company,
            title: action.job.title,
            status: action.job.status,
            score: action.job.score,
            priority: action.job.priority,
          }
        : null,
      directoryItem: null,
    }));

  const followUps: DashboardAction[] = activeJobs
    .filter((job) => job.followUpDate && isDueOrOverdue(job.followUpDate, now))
    .filter((job) => !hasOpenActionForJob(input.actions, job.id, ["follow_up", "outreach"]))
    .map((job) => ({
      id: `job-follow-up:${job.id}`,
      source: "job_follow_up",
      title: job.nextAction || `Follow up with ${job.company}.`,
      kind: "follow_up",
      dueDate: job.followUpDate,
      reason: "Job follow-up date is due",
      rank: 100 + jobHeat(job),
      canComplete: false,
      canTrack: true,
      actionItemId: null,
      job: toJobSummary(job),
      directoryItem: null,
    }));

  const prep: DashboardAction[] = activeJobs
    .filter((job) => job.status === "ASSESSMENT")
    .filter((job) => !hasOpenActionForJob(input.actions, job.id, ["prep"]))
    .map((job) => ({
      id: `job-prep:${job.id}`,
      source: "job_prep",
      title: job.nextAction || `Prepare for ${job.company} assessment.`,
      kind: "prep",
      dueDate: job.followUpDate,
      reason: "Assessment is active",
      rank: 95 + jobHeat(job),
      canComplete: false,
      canTrack: true,
      actionItemId: null,
      job: toJobSummary(job),
      directoryItem: null,
    }));

  const stale: DashboardAction[] = staleJobs
    .filter((job) => !hasOpenActionForJob(input.actions, job.id, ["follow_up", "admin"]))
    .map((job) => ({
      id: `stale-job:${job.id}`,
      source: "stale_job",
      title: job.status === "BACKLOG"
        ? `Decide whether to pursue ${job.company}.`
        : `Follow up or close ${job.company}.`,
      kind: "follow_up",
      dueDate: null,
      reason: job.status === "BACKLOG" ? "Backlog item is aging" : "Application is stale",
      rank: 60 + jobHeat(job),
      canComplete: false,
      canTrack: true,
      actionItemId: null,
      job: toJobSummary(job),
      directoryItem: null,
    }));

  const directoryChecks: DashboardAction[] = directoryDue.map((item) => ({
    id: `directory:${item.id}`,
    source: "directory_check",
    title: item.nextAction || `Check ${item.name}.`,
    kind: "admin",
    dueDate: null,
    reason: "Directory check cadence is due",
    rank: 30,
    canComplete: false,
    canTrack: false,
    actionItemId: null,
    job: null,
    directoryItem: { id: item.id, name: item.name, category: item.category },
  }));

  return [...explicitActions, ...followUps, ...prep, ...stale, ...directoryChecks]
    .sort((a, b) => {
      if (b.rank !== a.rank) return b.rank - a.rank;
      return (a.dueDate ?? "").localeCompare(b.dueDate ?? "");
    })
    .slice(0, 7);
}

export function buildDashboard(input: DashboardInput, now = new Date()): DashboardSections {
  const activeJobs = input.jobs.filter((job) => !CLOSED_STATUSES.has(job.status));
  const openActions = input.actions.filter((action) => action.status === "open");
  const hotPipeline = activeJobs
    .filter((job) => jobHeat(job) > 0)
    .sort((a, b) => jobHeat(b) - jobHeat(a))
    .slice(0, 8);
  const staleJobList = activeJobs
    .filter((job) => isStaleJob(job, now))
    .sort((a, b) => (a.lastContactDate ?? a.appliedAt ?? a.createdAt).localeCompare(b.lastContactDate ?? b.appliedAt ?? b.createdAt));
  const staleOpportunities = staleJobList.slice(0, 8);
  const prepQueue = openActions
    .filter((action) => action.kind === "prep")
    .sort((a, b) => (a.dueDate ?? "").localeCompare(b.dueDate ?? ""))
    .slice(0, 6);
  const directoryDue = input.directoryItems
    .filter((item) => {
      if (item.status === "skip") return false;
      const threshold = item.checkFrequencyDays ?? STALE_THRESHOLDS.directoryCheckDays;
      const days = daysBetween(item.lastCheckedAt ?? item.createdAt, now);
      return days !== null && days >= threshold;
    })
    .slice(0, 6);
  const todayActions = buildTodayActions(input, activeJobs, staleJobList, directoryDue, now);

  return {
    summary: {
      activeJobs: activeJobs.length,
      highPriorityJobs: activeJobs.filter((job) => job.priority === "high").length,
      openActions: openActions.length,
      dueToday: todayActions.length,
      staleJobs: staleJobList.length,
    },
    todayActions,
    hotPipeline,
    staleOpportunities,
    prepQueue,
    directoryDue,
  };
}
