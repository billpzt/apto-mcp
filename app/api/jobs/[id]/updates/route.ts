import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { parseOptionalDate } from "@/lib/date";
import { optionalString, requireString, toErrorResponse } from "@/lib/validation";
import { serializeJob, serializeJobUpdate } from "@/lib/serialize";
import { writeJobUpdatesMarkdown } from "@/lib/job-updates";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const updates = await db.jobUpdate.findMany({
      where: { jobId: id },
      orderBy: [{ occurredAt: "desc" }, { createdAt: "desc" }],
    });
    return NextResponse.json(updates.map(serializeJobUpdate));
  } catch (error) {
    return NextResponse.json(toErrorResponse(error), { status: 500 });
  }
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const occurredAt = parseOptionalDate(body.occurredAt);
    if (!occurredAt) {
      throw new Error("occurredAt is required");
    }

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

    const update = await db.jobUpdate.create({
      data: {
        jobId: id,
        occurredAt,
        kind: optionalString(body.kind) ?? "note",
        summary: requireString(body.summary, "summary"),
        details: optionalString(body.details),
      },
    });

    const lastContactDate =
      existing.lastContactDate && existing.lastContactDate > occurredAt
        ? existing.lastContactDate
        : occurredAt;

    const job = await db.job.update({
      where: { id },
      data: { lastContactDate },
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

    return NextResponse.json(
      { update: serializeJobUpdate(update), job: serializeJob(job) },
      { status: 201 }
    );
  } catch (error) {
    return NextResponse.json(toErrorResponse(error), { status: 400 });
  }
}
