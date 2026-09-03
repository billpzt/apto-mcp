import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { JOB_STATUSES, ACTION_KINDS } from "@/lib/constants";
import {
  addJobUpdate,
  importJobCandidates,
  recordApplication,
  recordJobAnalysis,
  recordLearning,
} from "@/lib/assistant-service";
import { assertKnownAssistantAction } from "@/lib/assistant-contracts";
import { toErrorResponse } from "@/lib/validation";

interface ActionPayload {
  action: string;
  [key: string]: unknown;
}

interface ActionResult {
  action: string;
  success: boolean;
  message: string;
  data?: unknown;
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const actions: ActionPayload[] = Array.isArray(body) ? body : [body];
    const results: ActionResult[] = [];

    for (const payload of actions) {
      try {
        assertKnownAssistantAction(payload.action);
        switch (payload.action) {
          // Legacy embedded-chat compatibility dispatch. These six handlers
          // preserve the original /api/assistant/actions behavior (direct
          // db.* calls and the {action, success, message} response shape) so
          // the live ChatPanel keeps working. They must remain until a
          // separately planned migration provides full capability parity with
          // the shared assistant service. Do not remap them to shared-service
          // calls: their payloads, defaults, and response shapes differ.
          case "update_job": {
            const id = String(payload.id ?? "");
            if (!id) throw new Error("Missing job id");
            const update: Record<string, unknown> = {};
            if (payload.status && JOB_STATUSES.includes(payload.status as never))
              update.status = payload.status;
            if (payload.notes) update.notes = String(payload.notes);
            if (payload.nextAction) update.nextAction = String(payload.nextAction);
            if (payload.score) update.score = String(payload.score);
            if (payload.priority) update.priority = String(payload.priority);
            if (Object.keys(update).length === 0) throw new Error("No valid fields to update");
            const job = await db.job.update({ where: { id }, data: update });
            results.push({ action: "update_job", success: true, message: "Updated " + job.company + " to " + job.status });
            break;
          }
          case "add_job": {
            const data = (payload.data as Record<string, unknown>) ?? payload;
            const job = await db.job.create({
              data: {
                title: String(data.title ?? "Untitled"),
                company: String(data.company ?? "Unknown"),
                status: JOB_STATUSES.includes(data.status as never) ? String(data.status) : "BACKLOG",
                url: data.url ? String(data.url) : undefined,
                notes: data.notes ? String(data.notes) : undefined,
                score: data.score ? String(data.score) : undefined,
                salary: data.salary ? String(data.salary) : undefined,
                location: data.location ? String(data.location) : undefined,
              },
            });
            results.push({ action: "add_job", success: true, message: "Added " + job.company + " - " + job.title });
            break;
          }
          case "add_action_item": {
            const data = (payload.data as Record<string, unknown>) ?? payload;
            const kindRaw = String(data.kind ?? "follow_up");
            const kind = ACTION_KINDS.includes(kindRaw as never) ? kindRaw : "follow_up";
            const item = await db.actionItem.create({
              data: {
                title: String(data.title ?? "Action item"),
                kind,
                status: "open",
                jobId: data.jobId ? String(data.jobId) : undefined,
                contactId: data.contactId ? String(data.contactId) : undefined,
                notes: data.notes ? String(data.notes) : undefined,
                dueDate: data.dueDate ? new Date(String(data.dueDate)) : undefined,
              },
            });
            results.push({ action: "add_action_item", success: true, message: "Created action: " + item.title });
            break;
          }
          case "add_note": {
            const jobId = String(payload.jobId ?? "");
            if (!jobId) throw new Error("Missing jobId for add_note");
            const note = await db.jobUpdate.create({
              data: {
                jobId,
                occurredAt: new Date(),
                kind: "note",
                summary: String(payload.summary ?? payload.note ?? "Note added by AI"),
                details: payload.details ? String(payload.details) : undefined,
              },
            });
            results.push({ action: "add_note", success: true, message: "Note logged: " + note.summary });
            break;
          }
          case "complete_action_item": {
            const id = String(payload.id ?? "");
            if (!id) throw new Error("Missing action item id");
            const item = await db.actionItem.update({
              where: { id },
              data: { status: "done", completedAt: new Date() },
            });
            results.push({ action: "complete_action_item", success: true, message: "Marked done: " + item.title });
            break;
          }
          case "log_practice": {
            const data = (payload.data as Record<string, unknown>) ?? payload;
            const session = await db.practiceSession.create({
              data: {
                platform: String(data.platform ?? "Other"),
                topic: String(data.topic ?? "General"),
                problems: data.problems ? Number(data.problems) : null,
                duration: data.duration ? Number(data.duration) : null,
                difficulty: data.difficulty ? String(data.difficulty) : null,
                notes: data.notes ? String(data.notes) : null,
                skillId: data.skillId ? String(data.skillId) : null,
              },
            });
            results.push({ action: "log_practice", success: true, message: "Logged " + session.platform + " session: " + session.topic });
            break;
          }
          // Slice 0 shared-service dispatch. These five actions delegate to the
          // shared persistence service and return the plan's response shape
          // with a data payload.
          case "import_job_candidates": {
            if (!Array.isArray(payload.candidates)) throw new Error("candidates must be an array");
            const data = await importJobCandidates(payload.candidates);
            results.push({ action: payload.action, success: true, message: "Action completed", data });
            break;
          }
          case "record_application": {
            const data = await recordApplication(payload as never);
            results.push({ action: payload.action, success: true, message: "Action completed", data });
            break;
          }
          case "record_job_analysis": {
            const data = await recordJobAnalysis(payload as never);
            results.push({ action: payload.action, success: true, message: "Action completed", data });
            break;
          }
          case "add_job_update": {
            const data = await addJobUpdate(payload as never);
            results.push({ action: payload.action, success: true, message: "Action completed", data });
            break;
          }
          case "record_learning": {
            const data = await recordLearning(payload as never);
            results.push({ action: payload.action, success: true, message: "Action completed", data });
            break;
          }
          default:
            throw new Error("Unknown action type: " + payload.action);
        }
      } catch (error) {
        results.push({
          action: payload.action,
          success: false,
          message: error instanceof Error ? error.message : "Action failed",
        });
      }
    }

    return NextResponse.json({ results });
  } catch (error) {
    return NextResponse.json(toErrorResponse(error), { status: 400 });
  }
}
