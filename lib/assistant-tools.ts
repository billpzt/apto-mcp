import {
  addJob,
  addJobUpdate,
  closeAction,
  closeJob,
  deleteJobs,
  getDailyAssistantContext,
  importJobCandidates,
  listJobs,
  MAX_DELETE_BATCH,
  recordApplication,
  recordJobAnalysis,
  recordLearning,
  updateJob,
} from "./assistant-service";
import { JOB_STATUSES, PRIORITIES, SOURCE_TYPES } from "./constants";

export const ASSISTANT_TOOL_NAMES = [
  "apto_get_daily_context",
  "apto_import_job_candidates",
  "apto_record_job_analysis",
  "apto_record_application",
  "apto_add_job_update",
  "apto_close_job",
  "apto_close_action",
  "apto_record_learning",
  "apto_list_jobs",
  "apto_add_job",
  "apto_update_job",
  "apto_delete_jobs",
] as const;

// Status values apto_update_job may set directly (see the guard in
// updateJob()) — excludes APPLIED and the CLOSEABLE_STATUSES, which have
// their own dedicated tools so the audit trail (appliedAt, closing note)
// can't be bypassed by a plain field edit.
const UPDATE_JOB_STATUS_VALUES = JOB_STATUSES.filter(
  (s) => s !== "APPLIED" && s !== "CLOSED" && s !== "REJECTED" && s !== "WITHDRAWN" && s !== "STALLED"
);

const candidateProperties = {
  title: { type: "string" },
  company: { type: "string" },
  url: { type: "string" },
  canonicalUrl: { type: "string" },
  sourceType: { type: "string" },
  location: { type: "string" },
  salary: { type: "string" },
  jobType: { type: "string" },
  notes: { type: "string" },
  jdText: { type: "string" },
  score: { type: "string", enum: ["A", "B", "C", "D", "F"] },
  priority: { type: "string", enum: ["low", "medium", "high"] },
  titleFamily: { type: "string" },
  remoteScope: { type: "string" },
  eligibleFromBrazil: { type: "string", enum: ["eligible", "ineligible", "uncertain"] },
  eligibilityEvidence: { type: "string" },
  postedAt: { type: "string" },
  lastVerifiedAt: { type: "string" },
};

export const ASSISTANT_TOOLS = [
  {
    name: "apto_get_daily_context",
    description: "Read Apto's deadline, daily progress, uncapped ranked queue, jobs, follow-ups, skills, and resume context.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "apto_import_job_candidates",
    description: "Validate and idempotently import job candidates. Importing does not count as applying.",
    inputSchema: {
      type: "object",
      required: ["candidates"],
      properties: {
        candidates: {
          type: "array",
          items: { type: "object", required: ["title", "company"], properties: candidateProperties },
        },
      },
    },
  },
  {
    name: "apto_record_job_analysis",
    description: "Persist a validated JD analysis produced by a desktop assistant.",
    inputSchema: {
      type: "object",
      required: ["jobId", "jdText", "analysis"],
      properties: {
        jobId: { type: "string" },
        jdText: { type: "string" },
        analysis: { type: "object" },
      },
    },
  },
  {
    name: "apto_record_application",
    description:
      "Record an application only after the human submitted it. Calling this on a job that is " +
      "already recorded as applied does nothing, and calling it on a closed or rejected job is " +
      "refused, so it is safe to call when unsure whether an earlier attempt landed.",
    inputSchema: {
      type: "object",
      required: ["jobId", "submittedAt"],
      properties: {
        jobId: { type: "string" },
        submittedAt: { type: "string" },
        followUpDate: { type: "string" },
        resumeSent: { type: "string" },
        notes: { type: "string" },
        correction: {
          type: "boolean",
          description:
            "Overwrite an already-recorded application date, or reopen a closed job. Only set " +
            "this when the human has said the stored record is wrong. It is not the way to log " +
            "a second application: create a separate job for a different posting.",
        },
      },
    },
  },
  {
    name: "apto_add_job_update",
    description: "Add a dated note or event to a tracked job.",
    inputSchema: {
      type: "object",
      required: ["jobId", "summary"],
      properties: {
        jobId: { type: "string" }, summary: { type: "string" }, kind: { type: "string" },
        details: { type: "string" }, occurredAt: { type: "string" },
      },
    },
  },
  {
    name: "apto_close_job",
    description:
      "Retire a job that is confirmed dead, a duplicate, or a dead end, so it stops resurfacing in Today's Three. Actually updates job.status (unlike apto_add_job_update, which only logs a note). Never use this to mark a job APPLIED — that requires apto_record_application after the human submits.",
    inputSchema: {
      type: "object",
      required: ["jobId", "status"],
      properties: {
        jobId: { type: "string" },
        status: { type: "string", enum: ["CLOSED", "REJECTED", "WITHDRAWN", "STALLED"] },
        closedReason: { type: "string" },
        summary: { type: "string" },
        occurredAt: { type: "string" },
      },
    },
  },
  {
    name: "apto_close_action",
    description:
      "Retire an item in openActions once the user says it is finished or dead, so it stops being raised every session. Actually updates ActionItem.status (unlike apto_add_job_update, which only logs a note). Use status 'done' when the action was completed and 'skipped' when it was abandoned or overtaken by events. Closing a job does not close its actions, so retire both.",
    inputSchema: {
      type: "object",
      required: ["actionId"],
      properties: {
        actionId: { type: "string" },
        status: { type: "string", enum: ["done", "skipped"] },
        notes: { type: "string" },
      },
    },
  },
  {
    name: "apto_list_jobs",
    description:
      "List tracked jobs from Apto (id, title, company, status, location, url, score, priority, sourceType, nextAction, a truncated notes preview, appliedAt, followUpDate, lastContactDate). Optionally filter by status. Results are capped (default 50, max 200 rows) to stay compact for a context window; the response says whether more rows exist beyond the cap. Use this to find a job's id before calling apto_update_job or apto_delete_jobs.",
    inputSchema: {
      type: "object",
      properties: {
        status: { type: "string", enum: JOB_STATUSES, description: "Filter to a single status. Omit to return all statuses." },
        limit: { type: "number", description: "Max rows to return (default 50, max 200)." },
      },
    },
  },
  {
    name: "apto_add_job",
    description:
      "Create a new tracked job in Apto. Before creating, checks for an existing job with the same title and company (case-insensitive) and returns that record instead of a duplicate — pass allowDuplicate: true to force a second record anyway. Status defaults to BACKLOG. Setting status APPLIED here is fine for backfilling a job that was already applied to before it was tracked; for a job already tracked in Apto, use apto_record_application instead so application history stays intact.",
    inputSchema: {
      type: "object",
      required: ["title", "company"],
      properties: {
        title: { type: "string", description: "Job title" },
        company: { type: "string", description: "Company name" },
        url: { type: "string", description: "Job posting URL" },
        status: { type: "string", enum: JOB_STATUSES, description: "Defaults to BACKLOG." },
        location: { type: "string" },
        notes: { type: "string" },
        jdText: { type: "string", description: "Full job description text" },
        sourceType: { type: "string", enum: SOURCE_TYPES },
        appliedAt: { type: "string", description: "ISO date string, only for backfilling an already-applied job." },
        nextAction: { type: "string" },
        allowDuplicate: {
          type: "boolean",
          description: "Set true to deliberately create a second record even though a job with the same title and company already exists.",
        },
      },
    },
  },
  {
    name: "apto_update_job",
    description:
      "Update fields on an existing tracked job in Apto. Only the fields you pass are changed — every omitted field, including appliedAt, is left untouched, so this cannot silently overwrite a real application date. Cannot set status to APPLIED (use apto_record_application, which stamps appliedAt and preserves history) or to CLOSED/REJECTED/WITHDRAWN/STALLED (use apto_close_job, which also logs the closing note).",
    inputSchema: {
      type: "object",
      required: ["jobId"],
      properties: {
        jobId: { type: "string", description: "Job id (from apto_list_jobs)." },
        title: { type: "string" },
        company: { type: "string" },
        url: { type: "string" },
        status: { type: "string", enum: UPDATE_JOB_STATUS_VALUES },
        location: { type: "string" },
        salary: { type: "string" },
        jobType: { type: "string" },
        notes: { type: "string" },
        resumeSent: { type: "string" },
        jdText: { type: "string" },
        score: { type: "string", enum: ["A", "B", "C", "D", "F"] },
        followUpDate: { type: "string", description: "ISO date string." },
        lastContactDate: { type: "string", description: "ISO date string." },
        appliedAt: { type: "string", description: "ISO date string. Only pass this to deliberately change the recorded application date." },
        nextAction: { type: "string" },
        priority: { type: "string", enum: PRIORITIES },
        sourceType: { type: "string", enum: SOURCE_TYPES },
        closedReason: { type: "string" },
      },
    },
  },
  {
    name: "apto_delete_jobs",
    description: `Permanently delete tracked jobs from Apto by id. Irreversible — there is no undo. Accepts only an explicit list of job ids (1 to ${MAX_DELETE_BATCH} per call); there is no filter, query, or "delete all" mode. Returns exactly what was deleted (id, title, company) for audit, and reports any ids that did not exist rather than failing the whole batch. Prefer apto_close_job when a job should just stop resurfacing — that keeps the history instead of destroying it.`,
    inputSchema: {
      type: "object",
      required: ["jobIds"],
      properties: {
        jobIds: {
          type: "array",
          items: { type: "string" },
          minItems: 1,
          maxItems: MAX_DELETE_BATCH,
          description: `Exact job ids to delete (from apto_list_jobs), 1 to ${MAX_DELETE_BATCH} per call.`,
        },
      },
    },
  },
  {
    name: "apto_record_learning",
    description: "Record bounded learning from Claude, YouTube, documentation, a project, or manual practice.",
    inputSchema: {
      type: "object",
      required: ["platform", "topic"],
      properties: {
        platform: { type: "string" }, topic: { type: "string" }, duration: { type: "number" },
        problems: { type: "number" }, difficulty: { type: "string" }, notes: { type: "string" },
        skillId: { type: "string" }, date: { type: "string" },
      },
    },
  },
] as const;

export async function callAssistantTool(name: string, args: Record<string, unknown>) {
  switch (name) {
    case "apto_get_daily_context": return getDailyAssistantContext();
    case "apto_import_job_candidates":
      if (!Array.isArray(args.candidates)) throw new Error("candidates must be an array");
      return importJobCandidates(args.candidates);
    case "apto_record_job_analysis": return recordJobAnalysis(args as never);
    case "apto_record_application": return recordApplication(args as never);
    case "apto_add_job_update": return addJobUpdate(args as never);
    case "apto_close_job": return closeJob(args as never);
    case "apto_close_action": return closeAction(args as never);
    case "apto_record_learning": return recordLearning(args as never);
    case "apto_list_jobs": return listJobs(args);
    case "apto_add_job": return addJob(args as never);
    case "apto_update_job": return updateJob(args as never);
    case "apto_delete_jobs":
      if (!Array.isArray(args.jobIds)) throw new Error("jobIds must be an array");
      return deleteJobs(args as never);
    default: throw new Error(`Unknown tool: ${name}`);
  }
}
