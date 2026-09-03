import type { SourceType } from "./constants";
import { optionalString, requireString } from "./validation";

export const ELIGIBILITY_VALUES = ["eligible", "ineligible", "uncertain"] as const;
export type EligibilityValue = (typeof ELIGIBILITY_VALUES)[number];

// Pure action-name registry. The /api/assistant/actions route and the pure
// test harness share this as the single source of truth for which action
// types the dispatcher accepts, so the route cannot drift from the tests.
export const LEGACY_ASSISTANT_ACTIONS = [
  "update_job",
  "add_job",
  "add_note",
  "add_action_item",
  "complete_action_item",
  "log_practice",
] as const;

export const SLICE0_ASSISTANT_ACTIONS = [
  "import_job_candidates",
  "record_application",
  "record_job_analysis",
  "add_job_update",
  "record_learning",
] as const;

export const ASSISTANT_ACTION_TYPES = [
  ...LEGACY_ASSISTANT_ACTIONS,
  ...SLICE0_ASSISTANT_ACTIONS,
] as const;

export function assertKnownAssistantAction(action: string): void {
  if (!(ASSISTANT_ACTION_TYPES as readonly string[]).includes(action)) {
    throw new Error("Unknown action type: " + action);
  }
}

export type AssistantJobCandidateInput = {
  title: unknown;
  company: unknown;
  url?: unknown;
  canonicalUrl?: unknown;
  sourceType?: unknown;
  location?: unknown;
  salary?: unknown;
  jobType?: unknown;
  notes?: unknown;
  jdText?: unknown;
  score?: unknown;
  priority?: unknown;
  titleFamily?: unknown;
  remoteScope?: unknown;
  eligibleFromBrazil?: unknown;
  eligibilityEvidence?: unknown;
  postedAt?: unknown;
  lastVerifiedAt?: unknown;
};

export type NormalizedAssistantCandidate = {
  title: string;
  company: string;
  url: string | null;
  canonicalUrl: string | null;
  sourceType: SourceType | null;
  location: string | null;
  salary: string | null;
  jobType: string | null;
  notes: string | null;
  jdText: string | null;
  score: string | null;
  priority: string | null;
  titleFamily: string | null;
  remoteScope: string | null;
  eligibleFromBrazil: EligibilityValue;
  eligibilityEvidence: string | null;
  postedAt: Date | null;
  lastVerifiedAt: Date;
};

export type AssistantItemResult = {
  index: number;
  status: "created" | "updated" | "merged" | "skipped" | "failed";
  jobId: string | null;
  message: string;
};

export type RecordApplicationInput = {
  jobId: unknown;
  submittedAt: unknown;
  followUpDate?: unknown;
  resumeSent?: unknown;
  notes?: unknown;
};

export type NormalizedRecordApplicationInput = {
  jobId: string;
  submittedAt: Date;
  followUpDate: Date | null;
  resumeSent: string | null;
  notes: string | null;
};

export function normalizeRecordApplication(
  input: RecordApplicationInput
): NormalizedRecordApplicationInput {
  const jobId = requireString(input.jobId, "jobId");
  const submittedAt = new Date(String(input.submittedAt ?? ""));
  if (Number.isNaN(submittedAt.getTime())) {
    throw new Error("submittedAt must be a valid ISO date");
  }
  const followUpDate = input.followUpDate ? new Date(String(input.followUpDate)) : null;
  if (followUpDate && Number.isNaN(followUpDate.getTime())) {
    throw new Error("followUpDate must be a valid ISO date");
  }
  return {
    jobId,
    submittedAt,
    followUpDate,
    resumeSent: optionalString(input.resumeSent),
    notes: optionalString(input.notes),
  };
}
