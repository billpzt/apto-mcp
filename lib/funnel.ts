import type { JobStatus } from "./constants";

// A response is anything the company came back with, including a rejection.
// STALLED is deliberately excluded: it means no response ever came (ghosted).
// WITHDRAWN is deliberately excluded: it is the user's own choice, not a
// response from the company.
export const RESPONSE_STATUSES: JobStatus[] = ["ASSESSMENT", "STANDBY", "CLOSED", "REJECTED"];

export function responseRate(submittedCount: number, respondedCount: number): number | null {
  return submittedCount > 0 ? Math.round((respondedCount / submittedCount) * 100) : null;
}

// Denominator is every job that was actually applied to (non-null appliedAt),
// whatever its current status is now. Numerator is the subset of those that
// reached a response status. Deriving both from appliedAt, not from status
// counts, is the fix: a REJECTED job may never have been applied to, and an
// APPLIED job that later gets rejected leaves the APPLIED bucket entirely.
export function deriveFunnelCounts(
  jobs: Array<{ status: string; appliedAt: string | Date | null }>
): { submittedCount: number; respondedCount: number } {
  const responseStatuses: string[] = RESPONSE_STATUSES;
  const submitted = jobs.filter((job) => job.appliedAt !== null && job.appliedAt !== undefined);
  const responded = submitted.filter((job) => responseStatuses.includes(job.status));
  return { submittedCount: submitted.length, respondedCount: responded.length };
}
