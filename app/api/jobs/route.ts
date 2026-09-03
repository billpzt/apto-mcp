import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { optionalString, requireString, toErrorResponse, validateChoice } from "@/lib/validation";
import { parseOptionalDate } from "@/lib/date";
import { JOB_STATUSES, PRIORITIES, SOURCE_TYPES } from "@/lib/constants";
import { serializeJob, serializeJobUpdate } from "@/lib/serialize";
import { writeJobUpdatesMarkdown } from "@/lib/job-updates";

export async function DELETE(req: Request) {
  try {
    const body = await req.json();
    const ids: string[] = Array.isArray(body.ids) ? body.ids : [];
    if (ids.length === 0) return NextResponse.json({ error: "No ids provided" }, { status: 400 });
    const { count } = await db.job.deleteMany({ where: { id: { in: ids } } });
    return NextResponse.json({ deleted: count });
  } catch (error) {
    return NextResponse.json(toErrorResponse(error), { status: 500 });
  }
}

export async function GET() {
  try {
    const jobs = await db.job.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        sourceContact: true,
        updates: { orderBy: { occurredAt: "desc" }, take: 1 },
      },
    });
    return NextResponse.json(jobs.map(serializeJob));
  } catch (error) {
    return NextResponse.json(toErrorResponse(error), { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const job = await db.job.create({
      data: {
        title: requireString(body.title, "title"),
        company: requireString(body.company, "company"),
        url: optionalString(body.url),
        status: validateChoice(body.status, JOB_STATUSES, "status", "BACKLOG"),
        location: optionalString(body.location),
        salary: optionalString(body.salary),
        jobType: optionalString(body.jobType),
        notes: optionalString(body.notes),
        resumeSent: optionalString(body.resumeSent),
        jdText: optionalString(body.jdText),
        score: optionalString(body.score),
        followUpDate: parseOptionalDate(body.followUpDate),
        lastContactDate: parseOptionalDate(body.lastContactDate),
        appliedAt: parseOptionalDate(body.appliedAt),
        nextAction: optionalString(body.nextAction),
        priority: body.priority
          ? validateChoice(body.priority, PRIORITIES, "priority")
          : null,
        sourceType: body.sourceType
          ? validateChoice(body.sourceType, SOURCE_TYPES, "sourceType")
          : null,
        sourceContactId: optionalString(body.sourceContactId),
        sourceNotes: optionalString(body.sourceNotes),
        closedReason: optionalString(body.closedReason),
      },
      include: {
        sourceContact: true,
        updates: { orderBy: { occurredAt: "desc" }, take: 1 },
      },
    });
    // Filesystem write - skip silently in read-only environments (e.g. Vercel)
    try {
      await writeJobUpdatesMarkdown(
        {
          id: job.id,
          company: job.company,
          title: job.title,
          status: job.status,
          lastContactDate: job.lastContactDate?.toISOString() ?? null,
          followUpDate: job.followUpDate?.toISOString() ?? null,
          nextAction: job.nextAction,
          closedReason: job.closedReason,
        },
        job.updates.map(serializeJobUpdate)
      );
    } catch (_e) {
      // read-only filesystem in prod, not fatal
    }
    return NextResponse.json(serializeJob(job), { status: 201 });
  } catch (error) {
    return NextResponse.json(toErrorResponse(error), { status: 400 });
  }
}
