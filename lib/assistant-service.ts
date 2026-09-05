import type { Job } from "@prisma/client";
import { db } from "./db";
import { buildDailyApplicationQueue } from "./daily-search";
import { normalizeCandidate } from "./job-candidate";
import {
  normalizeRecordApplication,
  type AssistantItemResult,
  type AssistantJobCandidateInput,
  type RecordApplicationInput,
} from "./assistant-contracts";
import { parseJdAnalysis } from "./jd-analysis";
import { serializeJob } from "./serialize";
import { serializeDate, parseOptionalDate } from "./date";
import { optionalString, requireString, validateChoice } from "./validation";
import { JOB_STATUSES, PRIORITIES, SOURCE_TYPES } from "./constants";

// Compact job shape shared by apto_list_jobs / apto_add_job / apto_update_job
// so responses stay small enough for an LLM context window. Notes are
// truncated rather than dropped, so the caller still has enough to identify
// the right job before fetching full detail through the REST API.
const NOTES_PREVIEW_LENGTH = 200;

function toJobSummary(job: Job) {
  return {
    id: job.id,
    title: job.title,
    company: job.company,
    status: job.status,
    location: job.location,
    salary: job.salary,
    jobType: job.jobType,
    url: job.url,
    score: job.score,
    priority: job.priority,
    sourceType: job.sourceType,
    nextAction: job.nextAction,
    notes: job.notes ? job.notes.slice(0, NOTES_PREVIEW_LENGTH) : null,
    appliedAt: serializeDate(job.appliedAt),
    followUpDate: serializeDate(job.followUpDate),
    lastContactDate: serializeDate(job.lastContactDate),
    createdAt: job.createdAt.toISOString(),
    updatedAt: job.updatedAt.toISOString(),
  };
}

const DEFAULT_LIST_LIMIT = 50;
const MAX_LIST_LIMIT = 200;

export async function listJobs(input: { status?: unknown; limit?: unknown }) {
  const status =
    input.status !== undefined && input.status !== null && input.status !== ""
      ? validateChoice(input.status, JOB_STATUSES, "status")
      : undefined;

  let limit = DEFAULT_LIST_LIMIT;
  if (input.limit !== undefined && input.limit !== null && input.limit !== "") {
    const parsed = Number(input.limit);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      throw new Error("limit must be a positive number");
    }
    limit = Math.min(Math.floor(parsed), MAX_LIST_LIMIT);
  }

  const where = status ? { status } : undefined;
  const [jobs, totalMatching] = await Promise.all([
    db.job.findMany({ where, orderBy: { createdAt: "desc" }, take: limit }),
    db.job.count({ where }),
  ]);

  return {
    jobs: jobs.map(toJobSummary),
    count: jobs.length,
    totalMatching,
    truncated: totalMatching > jobs.length,
  };
}

export async function addJob(input: {
  title: unknown;
  company: unknown;
  url?: unknown;
  status?: unknown;
  location?: unknown;
  notes?: unknown;
  jdText?: unknown;
  sourceType?: unknown;
  appliedAt?: unknown;
  nextAction?: unknown;
  allowDuplicate?: unknown;
}) {
  const title = requireString(input.title, "title");
  const company = requireString(input.company, "company");
  const allowDuplicate = input.allowDuplicate === true;

  // Prior art: a role that had already been applied to was silently merged as
  // if new during a later import, and apto_record_application then overwrote
  // the original appliedAt. Default to surfacing an existing title+company
  // match instead of creating a second record, unless the caller deliberately
  // opts in.
  if (!allowDuplicate) {
    const existing = await db.job.findFirst({
      where: {
        title: { equals: title, mode: "insensitive" },
        company: { equals: company, mode: "insensitive" },
      },
      orderBy: { createdAt: "desc" },
    });
    if (existing) {
      return { created: false, duplicate: true, job: toJobSummary(existing) };
    }
  }

  const status = validateChoice(input.status, JOB_STATUSES, "status", "BACKLOG");
  const job = await db.job.create({
    data: {
      title,
      company,
      url: optionalString(input.url),
      status,
      location: optionalString(input.location),
      notes: optionalString(input.notes),
      jdText: optionalString(input.jdText),
      sourceType: input.sourceType
        ? validateChoice(input.sourceType, SOURCE_TYPES, "sourceType")
        : null,
      appliedAt: parseOptionalDate(input.appliedAt),
      nextAction: optionalString(input.nextAction),
    },
  });
  return { created: true, duplicate: false, job: toJobSummary(job) };
}

// Statuses apto_update_job may set directly. Excludes APPLIED (only
// apto_record_application may set that — it stamps appliedAt and writes
// application history) and the statuses closeJob owns (CLOSED, REJECTED,
// WITHDRAWN, STALLED — apto_close_job also writes the closing jobUpdate note
// that a plain field update would skip). Declared here and referenced by
// closeJob's CLOSEABLE_STATUSES below at call time.
function updateJobAllowedStatuses(): Set<string> {
  return new Set(JOB_STATUSES.filter((s) => s !== "APPLIED" && !CLOSEABLE_STATUSES.has(s)));
}

export async function updateJob(input: {
  jobId: unknown;
  title?: unknown;
  company?: unknown;
  url?: unknown;
  status?: unknown;
  location?: unknown;
  salary?: unknown;
  jobType?: unknown;
  notes?: unknown;
  resumeSent?: unknown;
  jdText?: unknown;
  score?: unknown;
  followUpDate?: unknown;
  lastContactDate?: unknown;
  appliedAt?: unknown;
  nextAction?: unknown;
  priority?: unknown;
  sourceType?: unknown;
  closedReason?: unknown;
}) {
  const jobId = requireString(input.jobId, "jobId");
  const existing = await db.job.findUnique({ where: { id: jobId } });
  if (!existing) throw new Error("Job not found");

  const data: Record<string, unknown> = {};
  if (input.title !== undefined) data.title = requireString(input.title, "title");
  if (input.company !== undefined) data.company = requireString(input.company, "company");
  if (input.url !== undefined) data.url = optionalString(input.url);
  if (input.status !== undefined) {
    const status = validateChoice(input.status, JOB_STATUSES, "status", "BACKLOG");
    if (!updateJobAllowedStatuses().has(status)) {
      throw new Error(
        status === "APPLIED"
          ? "Use apto_record_application to mark a job APPLIED — it also stamps appliedAt and preserves application history."
          : `Use apto_close_job to set status ${status} — it also logs a closing note.`
      );
    }
    data.status = status;
  }
  if (input.location !== undefined) data.location = optionalString(input.location);
  if (input.salary !== undefined) data.salary = optionalString(input.salary);
  if (input.jobType !== undefined) data.jobType = optionalString(input.jobType);
  if (input.notes !== undefined) data.notes = optionalString(input.notes);
  if (input.resumeSent !== undefined) data.resumeSent = optionalString(input.resumeSent);
  if (input.jdText !== undefined) data.jdText = optionalString(input.jdText);
  if (input.score !== undefined) data.score = optionalString(input.score);
  if (input.nextAction !== undefined) data.nextAction = optionalString(input.nextAction);
  if (input.priority !== undefined) {
    data.priority = input.priority ? validateChoice(input.priority, PRIORITIES, "priority") : null;
  }
  if (input.sourceType !== undefined) {
    data.sourceType = input.sourceType
      ? validateChoice(input.sourceType, SOURCE_TYPES, "sourceType")
      : null;
  }
  if (input.closedReason !== undefined) data.closedReason = optionalString(input.closedReason);
  if (input.followUpDate !== undefined) data.followUpDate = parseOptionalDate(input.followUpDate);
  if (input.lastContactDate !== undefined) data.lastContactDate = parseOptionalDate(input.lastContactDate);
  // appliedAt is deliberately only touched when explicitly passed. Prior art:
  // recordApplication unconditionally overwrote appliedAt and destroyed the
  // original application date of a real job — see AGENTS.md Session 7.
  if (input.appliedAt !== undefined) data.appliedAt = parseOptionalDate(input.appliedAt);

  const job = await db.job.update({ where: { id: jobId }, data });
  return toJobSummary(job);
}

// Small, fixed cap on a destructive, typed-ID-only batch delete — this is the
// first time deletion has a dedicated assistant tool, so no filter/query/
// "delete all" mode exists at all, and the cap keeps a single bad call from
// wiping the board. Reports not-found ids instead of failing the whole batch,
// and returns exactly what was deleted (id, title, company) for audit.
export const MAX_DELETE_BATCH = 10;

export async function deleteJobs(input: { jobIds: unknown }) {
  if (!Array.isArray(input.jobIds) || input.jobIds.length === 0) {
    throw new Error("jobIds must be a non-empty array of job ids");
  }
  if (input.jobIds.some((id) => typeof id !== "string" || id.trim().length === 0)) {
    throw new Error("jobIds must contain only non-empty strings");
  }
  const jobIds = [...new Set(input.jobIds as string[])];
  if (jobIds.length > MAX_DELETE_BATCH) {
    throw new Error(
      `apto_delete_jobs accepts at most ${MAX_DELETE_BATCH} ids per call (got ${jobIds.length}). This is irreversible — delete in smaller batches.`
    );
  }

  const found = await db.job.findMany({
    where: { id: { in: jobIds } },
    select: { id: true, title: true, company: true },
  });
  const foundById = new Map(found.map((j) => [j.id, j]));

  const deleted: { id: string; title: string; company: string }[] = [];
  const notFound: string[] = [];
  for (const id of jobIds) {
    const job = foundById.get(id);
    if (job) deleted.push(job);
    else notFound.push(id);
  }

  if (deleted.length > 0) {
    await db.job.deleteMany({ where: { id: { in: deleted.map((j) => j.id) } } });
  }

  return { deleted, notFound };
}

// Statuses at which no application has been submitted yet. Only these are safe
// targets for the fuzzy title+company dedup branch. Before this distinction
// existed, a genuinely NEW posting from a company you had already applied to
// silently merged into the applied record, because the fuzzy branch excluded
// only the dead statuses. The new opening vanished from the pipeline and the
// applied record had its verification fields rewritten with candidate data,
// which is how an applied job could come back looking freshly sourced today.
const PRE_APPLICATION_STATUSES = ["BACKLOG", "PROFILE_LIVE"];

// Hosts that hand out a fresh per-impression redirect for the same posting.
// Two different to.indeed.com links routinely point at one job, so a URL here
// is NOT a reliable identity: dedup silently falls through to the fuzzy
// title+company branch, which is exactly where the damage used to happen.
// Worth saying out loud in the import result so the operator knows the match
// was weak rather than assuming Apto checked properly.
const REDIRECT_HOSTS = ["to.indeed.com", "cts.indeed.com", "lnkd.in", "bit.ly"];

function isRedirectUrl(url: string | null | undefined) {
  if (!url) return false;
  try {
    return REDIRECT_HOSTS.includes(new URL(url).hostname.toLowerCase());
  } catch {
    return false;
  }
}

// Statuses where a real application (or an active conversation) exists, so the
// record carries history that an import must never overwrite.
function isPostApplication(status: string) {
  return !PRE_APPLICATION_STATUSES.includes(status) && !DEAD_JOB_STATUSES.includes(status);
}

export async function importJobCandidates(
  inputs: AssistantJobCandidateInput[]
): Promise<{ results: AssistantItemResult[] }> {
  const results: AssistantItemResult[] = [];
  for (let index = 0; index < inputs.length; index += 1) {
    try {
      const candidate = normalizeCandidate(inputs[index]);

      // Two distinct kinds of match, deliberately resolved in priority order.
      // A URL match means it is literally the same posting, so merging is
      // correct at any status. A title+company match only means "same company
      // is hiring a similar role", which is NOT evidence of the same posting.
      const candidateUrls = [candidate.canonicalUrl, candidate.url].filter(
        (u): u is string => typeof u === "string" && u.length > 0
      );
      const samePosting = candidateUrls.length
        ? await db.job.findFirst({
            where: {
              OR: [
                { canonicalUrl: { in: candidateUrls } },
                { url: { in: candidateUrls } },
              ],
            },
          })
        : null;

      const existing =
        samePosting ??
        (await db.job.findFirst({
          where: {
            company: { equals: candidate.company, mode: "insensitive" },
            title: { equals: candidate.title, mode: "insensitive" },
            status: { notIn: DEAD_JOB_STATUSES },
          },
        }));

      if (!existing) {
        const created = await db.job.create({ data: candidate });
        results.push({
          index,
          status: "created",
          jobId: created.id,
          message: `Created ${created.company}: ${created.title}`,
        });
        continue;
      }

      // Fuzzy match against a record that already has an application or a live
      // conversation behind it: refuse to touch it. Surfacing this as a skip
      // rather than a silent merge is the whole point, because the operator
      // needs to see that a possibly-new opening was found at a company
      // already in flight, and decide for themselves.
      if (!samePosting && isPostApplication(existing.status)) {
        results.push({
          index,
          status: "skipped",
          jobId: existing.id,
          message:
            `Not merged. "${candidate.title}" at ${candidate.company} matches an existing record ` +
            `by title and company, but that record is ${existing.status}` +
            (existing.appliedAt ? ` (applied ${existing.appliedAt.toISOString().slice(0, 10)})` : "") +
            `. This may be a different, newer posting. Review it and, if it is genuinely a separate ` +
            `opening, add it with apto_add_job and allowDuplicate.` +
            (isRedirectUrl(candidate.canonicalUrl) || isRedirectUrl(existing.canonicalUrl)
              ? ` Note: one of these URLs is a redirect link, which is not a stable identifier. The same posting can produce several, so URL matching could not settle this either way.`
              : ""),
        });
        continue;
      }

      // Merge. Existing values always win for anything that could carry
      // human-entered history; the candidate only fills blanks. The three
      // fields that previously overwrote unconditionally, eligibleFromBrazil,
      // lastVerifiedAt and remoteScope, are the ones that made an applied
      // record look freshly verified, so they now only advance on a true URL
      // match.
      const updated = await db.$transaction(async (tx) => {
        const job = await tx.job.update({
          where: { id: existing.id },
          data: {
            canonicalUrl: existing.canonicalUrl ?? candidate.canonicalUrl,
            url: existing.url ?? candidate.url,
            titleFamily: existing.titleFamily ?? candidate.titleFamily,
            remoteScope: existing.remoteScope ?? candidate.remoteScope,
            eligibleFromBrazil: existing.eligibleFromBrazil ?? candidate.eligibleFromBrazil,
            eligibilityEvidence: existing.eligibilityEvidence ?? candidate.eligibilityEvidence,
            postedAt: existing.postedAt ?? candidate.postedAt,
            ...(samePosting && candidate.lastVerifiedAt
              ? { lastVerifiedAt: candidate.lastVerifiedAt }
              : {}),
            location: existing.location ?? candidate.location,
            salary: existing.salary ?? candidate.salary,
            jobType: existing.jobType ?? candidate.jobType,
            jdText: existing.jdText ?? candidate.jdText,
            score: existing.score ?? candidate.score,
            priority: existing.priority ?? candidate.priority,
            sourceType: existing.sourceType ?? candidate.sourceType,
          },
        });
        // Every merge leaves a trace. Without this a record could change
        // underneath the operator with nothing in its history to explain it.
        await tx.jobUpdate.create({
          data: {
            jobId: job.id,
            occurredAt: new Date(),
            kind: "import_merge",
            summary: samePosting
              ? "Re-imported: same posting matched by URL"
              : "Re-imported: matched by title and company",
            details:
              `Import merged into this record (status ${existing.status}). ` +
              `Only blank fields were filled; existing values were preserved.` +
              (samePosting && candidate.lastVerifiedAt
                ? ` lastVerifiedAt advanced to ${candidate.lastVerifiedAt.toISOString().slice(0, 10)}.`
                : ""),
          },
        });
        return job;
      });

      results.push({
        index,
        status: "merged",
        jobId: updated.id,
        message:
          `Merged with ${updated.company}: ${updated.title}` +
          (samePosting ? " (same posting, matched by URL)" : " (matched by title and company)"),
      });
    } catch (error) {
      results.push({
        index,
        status: "failed",
        jobId: null,
        message: error instanceof Error ? error.message : "Candidate import failed",
      });
    }
  }
  return { results };
}

export async function recordApplication(input: RecordApplicationInput) {
  const value = normalizeRecordApplication(input);
  return db.$transaction(async (tx) => {
    const existing = await tx.job.findUnique({ where: { id: value.jobId } });
    if (!existing) throw new Error("Job not found");

    // Recording an application is not a safe thing to repeat. It used to
    // overwrite appliedAt, append a second history row and happily reopen a
    // rejected job, so a duplicated call lost the real submission date. The
    // transport already refuses to retry writes; this covers the other route
    // to the same damage, which is a caller simply asking twice.
    if (existing.appliedAt && !value.correction) {
      const alreadyRecorded = existing.appliedAt.getTime() === value.submittedAt.getTime();
      if (alreadyRecorded) return existing;
      throw new Error(
        `${existing.company}: ${existing.title} is already recorded as applied on ` +
          `${existing.appliedAt.toISOString()}. Pass correction: true to replace that date, ` +
          `and only if it is wrong. If this is a second application to a different posting, ` +
          `create a separate job instead.`
      );
    }

    if (DEAD_JOB_STATUSES.includes(existing.status) && !value.correction) {
      throw new Error(
        `${existing.company}: ${existing.title} is ${existing.status}. Recording an application ` +
          `would silently reopen it. Pass correction: true if that is genuinely what you mean.`
      );
    }

    const job = await tx.job.update({
      where: { id: value.jobId },
      data: {
        status: "APPLIED",
        appliedAt: value.submittedAt,
        followUpDate: value.followUpDate ?? existing.followUpDate,
        resumeSent: value.resumeSent ?? existing.resumeSent,
      },
    });
    await tx.jobUpdate.create({
      data: {
        jobId: job.id,
        occurredAt: value.submittedAt,
        kind: "application",
        summary: `Application submitted to ${job.company}.`,
        details: value.notes,
      },
    });
    return job;
  });
}

export async function recordJobAnalysis(input: {
  jobId: unknown;
  jdText: unknown;
  analysis: unknown;
}) {
  const jobId = requireString(input.jobId, "jobId");
  const jdText = requireString(input.jdText, "jdText");
  const raw = typeof input.analysis === "string"
    ? input.analysis
    : JSON.stringify(input.analysis);
  const analysis = parseJdAnalysis(raw);
  if (!analysis) throw new Error("analysis must match the JdAnalysis contract");
  return db.job.update({
    where: { id: jobId },
    data: { jdText, jdAnalysis: JSON.stringify(analysis), score: analysis.grade },
  });
}

export async function addJobUpdate(input: {
  jobId: unknown;
  summary: unknown;
  kind?: unknown;
  details?: unknown;
  occurredAt?: unknown;
}) {
  const jobId = requireString(input.jobId, "jobId");
  const summary = requireString(input.summary, "summary");
  const occurredAt = input.occurredAt ? new Date(String(input.occurredAt)) : new Date();
  if (Number.isNaN(occurredAt.getTime())) throw new Error("occurredAt must be a valid ISO date");
  return db.jobUpdate.create({
    data: {
      jobId,
      summary,
      kind: optionalString(input.kind) ?? "note",
      details: optionalString(input.details),
      occurredAt,
    },
  });
}

// Statuses a desktop assistant is allowed to set directly. Deliberately
// excludes APPLIED (only apto_record_application may set that, since only an
// explicit human submission should create application credit) and BACKLOG
// (re-opening a job is a human decision, not an assistant one).
const CLOSEABLE_STATUSES = new Set(["CLOSED", "REJECTED", "WITHDRAWN", "STALLED"]);

// Same list as an array, for Prisma `notIn` filters.
const DEAD_JOB_STATUSES = Array.from(CLOSEABLE_STATUSES);

// Statuses that retire an action item. Mirrors ACTION_STATUSES in constants.ts
// minus "open".
const RESOLVABLE_ACTION_STATUSES = new Set(["done", "skipped"]);

// Root-cause fix for jobs that keep resurfacing in Today's Three after being
// "closed": prior to this, the only assistant-facing tool was addJobUpdate,
// which writes a note/history row but never touches job.status. The ranking
// query in daily-search.ts filters on job.status === "BACKLOG", so a job
// whose status was never actually flipped kept ranking as if it were live,
// no matter how many times an update said otherwise. This action is the only
// place besides recordApplication that mutates job.status, and it always
// pairs the status change with a jobUpdate row so the history stays intact.
export async function closeJob(input: {
  jobId: unknown;
  status: unknown;
  closedReason?: unknown;
  summary?: unknown;
  occurredAt?: unknown;
}) {
  const jobId = requireString(input.jobId, "jobId");
  const status = requireString(input.status, "status");
  if (!CLOSEABLE_STATUSES.has(status)) {
    throw new Error(
      `status must be one of ${Array.from(CLOSEABLE_STATUSES).join(", ")} (use apto_record_application to mark a job APPLIED)`
    );
  }
  const closedReason = optionalString(input.closedReason);
  const occurredAt = input.occurredAt ? new Date(String(input.occurredAt)) : new Date();
  if (Number.isNaN(occurredAt.getTime())) throw new Error("occurredAt must be a valid ISO date");
  const summary = optionalString(input.summary) ?? `Marked ${status}${closedReason ? `: ${closedReason}` : ""}`;

  return db.$transaction(async (tx) => {
    const existing = await tx.job.findUnique({ where: { id: jobId } });
    if (!existing) throw new Error("Job not found");
    const job = await tx.job.update({
      where: { id: jobId },
      data: { status, closedReason: closedReason ?? existing.closedReason },
    });
    await tx.jobUpdate.create({
      data: { jobId: job.id, occurredAt, kind: "status_change", summary, details: closedReason },
    });
    return job;
  });
}

// Companion to closeJob for the openActions list. Before this existed, an
// assistant could close a job but had no way to retire the action items
// attached to it, so stale follow-ups (status "open") were re-read out of
// getDailyAssistantContext on every session and surfaced to the user again
// and again, no matter how many times they said the thread was dead. The
// REST layer (PATCH /api/actions/[id]) always supported this; only the
// assistant-facing tool was missing.
export async function closeAction(input: {
  actionId: unknown;
  status?: unknown;
  notes?: unknown;
}) {
  const actionId = requireString(input.actionId, "actionId");
  const status = optionalString(input.status) ?? "done";
  if (!RESOLVABLE_ACTION_STATUSES.has(status)) {
    throw new Error(
      `status must be one of ${Array.from(RESOLVABLE_ACTION_STATUSES).join(", ")}`
    );
  }
  const notes = optionalString(input.notes);
  const existing = await db.actionItem.findUnique({ where: { id: actionId } });
  if (!existing) throw new Error("Action not found");
  return db.actionItem.update({
    where: { id: actionId },
    data: {
      status,
      completedAt: new Date(),
      notes: notes ? [existing.notes, notes].filter(Boolean).join("\n\n") : existing.notes,
    },
  });
}

export async function recordLearning(input: {
  platform: unknown;
  topic: unknown;
  duration?: unknown;
  problems?: unknown;
  difficulty?: unknown;
  notes?: unknown;
  skillId?: unknown;
  date?: unknown;
}) {
  const date = input.date ? new Date(String(input.date)) : new Date();
  if (Number.isNaN(date.getTime())) throw new Error("date must be a valid ISO date");
  return db.practiceSession.create({
    data: {
      platform: requireString(input.platform, "platform"),
      topic: requireString(input.topic, "topic"),
      duration: input.duration ? Number(input.duration) : null,
      problems: input.problems ? Number(input.problems) : null,
      difficulty: optionalString(input.difficulty),
      notes: optionalString(input.notes),
      skillId: optionalString(input.skillId),
      date,
    },
  });
}

export async function getDailyAssistantContext() {
  const [jobs, actions, skills, resume] = await Promise.all([
    db.job.findMany({
      orderBy: { createdAt: "desc" },
      include: { sourceContact: true, updates: { orderBy: { occurredAt: "desc" }, take: 1 } },
    }),
    // Only surface actions that are still open AND whose parent job is still
    // live. Without the job filter, closing a job left its follow-ups behind
    // in openActions, so a dead thread kept being raised with the user every
    // session. Actions with no jobId are standalone and always included.
    db.actionItem.findMany({
      where: {
        status: "open",
        OR: [{ jobId: null }, { job: { status: { notIn: DEAD_JOB_STATUSES } } }],
      },
      orderBy: { dueDate: "asc" },
    }),
    db.skill.findMany({ orderBy: { level: "desc" } }),
    db.resumeVersion.findFirst({ where: { isDefault: true } }),
  ]);
  const serializedJobs = jobs.map(serializeJob);
  return {
    generatedAt: new Date().toISOString(),
    employmentDeadline: "2026-09-30",
    daily: buildDailyApplicationQueue(serializedJobs),
    jobs: serializedJobs,
    openActions: actions.map((action) => ({
      ...action,
      dueDate: action.dueDate?.toISOString() ?? null,
      completedAt: action.completedAt?.toISOString() ?? null,
      createdAt: action.createdAt.toISOString(),
      updatedAt: action.updatedAt.toISOString(),
    })),
    skills,
    resume,
  };
}
