import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { optionalString, requireString, toErrorResponse, validateChoice } from "@/lib/validation";
import { parseOptionalDate } from "@/lib/date";
import { JOB_STATUSES, PRIORITIES, SOURCE_TYPES } from "@/lib/constants";
import { removeJobUpdatesMarkdown, writeJobUpdatesMarkdown } from "@/lib/job-updates";
import { serializeJob, serializeJobUpdate } from "@/lib/serialize";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const job = await db.job.findUnique({
      where: { id },
      include: {
        sourceContact: true,
        updates: { orderBy: { occurredAt: "desc" }, take: 1 },
      },
    });
    if (!job) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(serializeJob(job));
  } catch (error) {
    return NextResponse.json(toErrorResponse(error), { status: 400 });
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const existing = await db.job.findUnique({
      where: { id },
      include: {
        sourceContact: true,
        updates: { orderBy: { occurredAt: "desc" } },
      },
    });
    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    const data: Record<string, unknown> = {};
    if (body.title !== undefined) data.title = requireString(body.title, "title");
    if (body.company !== undefined) data.company = requireString(body.company, "company");
    if (body.url !== undefined) data.url = optionalString(body.url);
    if (body.status !== undefined)
      data.status = validateChoice(body.status, JOB_STATUSES, "status", "BACKLOG");
    if (body.location !== undefined) data.location = optionalString(body.location);
    if (body.salary !== undefined) data.salary = optionalString(body.salary);
    if (body.jobType !== undefined) data.jobType = optionalString(body.jobType);
    if (body.notes !== undefined) data.notes = optionalString(body.notes);
    if (body.resumeSent !== undefined) data.resumeSent = optionalString(body.resumeSent);
    if (body.jdText !== undefined) data.jdText = optionalString(body.jdText);
    if (body.score !== undefined) data.score = optionalString(body.score);
    if (body.followUpDate !== undefined) data.followUpDate = parseOptionalDate(body.followUpDate);
    if (body.lastContactDate !== undefined) data.lastContactDate = parseOptionalDate(body.lastContactDate);
    if (body.appliedAt !== undefined) data.appliedAt = parseOptionalDate(body.appliedAt);
    if (body.nextAction !== undefined) data.nextAction = optionalString(body.nextAction);
    if (body.priority !== undefined)
      data.priority = body.priority
        ? validateChoice(body.priority, PRIORITIES, "priority")
        : null;
    if (body.sourceType !== undefined)
      data.sourceType = body.sourceType
        ? validateChoice(body.sourceType, SOURCE_TYPES, "sourceType")
        : null;
    if (body.sourceContactId !== undefined) data.sourceContactId = optionalString(body.sourceContactId);
    if (body.sourceNotes !== undefined) data.sourceNotes = optionalString(body.sourceNotes);
    if (body.closedReason !== undefined) data.closedReason = optionalString(body.closedReason);
    const job = await db.job.update({
      where: { id },
      data,
      include: {
        sourceContact: true,
        updates: { orderBy: { occurredAt: "desc" } },
      },
    });
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
    if (existing.company !== job.company || existing.title !== job.title) {
      await removeJobUpdatesMarkdown(existing.company, existing.title);
    }
    return NextResponse.json(serializeJob(job));
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json(toErrorResponse(error), { status: 400 });
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const existing = await db.job.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    await db.job.delete({ where: { id } });
    await removeJobUpdatesMarkdown(existing.company, existing.title);
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json(toErrorResponse(error), { status: 400 });
  }
}
