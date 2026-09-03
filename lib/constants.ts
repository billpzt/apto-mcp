export type JobStatus =
  | "BACKLOG"
  | "PROFILE_LIVE"
  | "APPLIED"
  | "ASSESSMENT"
  | "STANDBY"
  | "CLOSED"
  | "STALLED"
  | "REJECTED"
  | "WITHDRAWN";

export const JOB_STATUSES: JobStatus[] = [
  "BACKLOG",
  "PROFILE_LIVE",
  "APPLIED",
  "ASSESSMENT",
  "STANDBY",
  "CLOSED",
  "STALLED",
  "REJECTED",
  "WITHDRAWN",
];

// Statuses shown as Kanban columns — excludes PROFILE_LIVE (those go to /platforms)
export const KANBAN_STATUSES: JobStatus[] = JOB_STATUSES.filter(
  (s) => s !== "PROFILE_LIVE"
);

export const STATUS_CONFIG: Record<
  JobStatus,
  { label: string; color: string; bg: string; border: string; dot: string }
> = {
  BACKLOG: {
    label: "Backlog",
    color: "text-slate-500",
    bg: "bg-slate-100",
    border: "border-slate-200",
    dot: "bg-slate-400",
  },
  PROFILE_LIVE: {
    label: "Profile Live",
    color: "text-teal-600",
    bg: "bg-teal-50",
    border: "border-teal-200",
    dot: "bg-teal-400",
  },
  APPLIED: {
    label: "Applied",
    color: "text-blue-600",
    bg: "bg-blue-50",
    border: "border-blue-200",
    dot: "bg-blue-500",
  },
  ASSESSMENT: {
    label: "Assessment",
    color: "text-violet-600",
    bg: "bg-violet-50",
    border: "border-violet-200",
    dot: "bg-violet-500",
  },
  STANDBY: {
    label: "Standby",
    color: "text-amber-600",
    bg: "bg-amber-50",
    border: "border-amber-200",
    dot: "bg-amber-400",
  },
  CLOSED: {
    label: "Closed",
    color: "text-emerald-600",
    bg: "bg-emerald-50",
    border: "border-emerald-200",
    dot: "bg-emerald-500",
  },
  STALLED: {
    label: "Stalled",
    color: "text-orange-500",
    bg: "bg-orange-50",
    border: "border-orange-200",
    dot: "bg-orange-400",
  },
  REJECTED: {
    label: "Rejected",
    color: "text-red-500",
    bg: "bg-red-50",
    border: "border-red-200",
    dot: "bg-red-400",
  },
  WITHDRAWN: {
    label: "Withdrawn",
    color: "text-slate-400",
    bg: "bg-slate-50",
    border: "border-slate-200",
    dot: "bg-slate-300",
  },
};

export const SKILL_LEVELS: Record<number, string> = {
  1: "Beginner",
  2: "Basic",
  3: "Intermediate",
  4: "Advanced",
  5: "Expert",
};

export const SKILL_CATEGORIES = [
  "Languages",
  "Frameworks",
  "Automation & RPA",
  "Cloud & DevOps",
  "Databases",
  "AI & ML",
  "Tools",
  "Soft Skills",
  "Other",
];

export const SOURCE_TYPES = [
  "manual",
  "linkedin",
  "referral",
  "recruiter_inbound",
  "platform",
  "job_board",
  "adzuna",
  "scanner",
  "imported_note",
  "other",
] as const;

export type SourceType = (typeof SOURCE_TYPES)[number];

export const PRIORITIES = ["low", "medium", "high"] as const;
export type Priority = (typeof PRIORITIES)[number];

export const ACTION_KINDS = [
  "follow_up",
  "prep",
  "apply",
  "outreach",
  "resume",
  "client",
  "product",
  "admin",
] as const;

export type ActionKind = (typeof ACTION_KINDS)[number];

export const ACTION_STATUSES = ["open", "done", "skipped"] as const;
export type ActionStatus = (typeof ACTION_STATUSES)[number];

export const DIRECTORY_CATEGORIES = [
  "platform",
  "job_board",
  "recruiter_portal",
  "assessment",
  "saved_search",
  "company_jobs",
  "community",
  "other",
] as const;

export type DirectoryCategory = (typeof DIRECTORY_CATEGORIES)[number];

export const DIRECTORY_STATUSES = ["active", "passive", "paused", "skip"] as const;
export type DirectoryStatus = (typeof DIRECTORY_STATUSES)[number];

export const STALE_THRESHOLDS = {
  appliedFollowUpDays: 7,
  appliedCloseDays: 21,
  backlogDecisionDays: 14,
  directoryCheckDays: 14,
} as const;

export const AI_PROVIDERS = ["manual", "anthropic", "openai", "openrouter", "deepseek", "zai"] as const;
export type AiProvider = (typeof AI_PROVIDERS)[number];

export const AI_PROVIDER_CONFIG: Record<
  string,
  { baseUrl: string; defaultModel: string; keyEnvVar: string; label: string }
> = {
  openrouter: {
    baseUrl: "https://openrouter.ai/api/v1",
    defaultModel: "deepseek/deepseek-chat",
    keyEnvVar: "OPENROUTER_API_KEY",
    label: "OpenRouter",
  },
  openai: {
    baseUrl: "https://api.openai.com/v1",
    defaultModel: "gpt-4o-mini",
    keyEnvVar: "OPENAI_API_KEY",
    label: "OpenAI",
  },
  deepseek: {
    baseUrl: "https://api.deepseek.com/v1",
    defaultModel: "deepseek-chat",
    keyEnvVar: "DEEPSEEK_API_KEY",
    label: "DeepSeek",
  },
  zai: {
    baseUrl: "https://api.z.ai/api/coding/paas/v4",
    defaultModel: "glm-4-plus",
    keyEnvVar: "ZAI_API_KEY",
    label: "Z.ai (GLM)",
  },
};
