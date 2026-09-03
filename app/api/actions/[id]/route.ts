import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { ACTION_KINDS, ACTION_STATUSES } from "@/lib/constants";
import { parseOptionalDate } from "@/lib/date";
import { db } from "@/lib/db";
import { optionalString, requireString, toErrorResponse, validateChoice } from "@/lib/validation";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json();
    const data: Record<string, unknown> = {};
    if (body.title !== undefined) data.title = requireString(body.title, "title");
    if (body.kind !== undefined) data.kind = validateChoice(body.kind, ACTION_KINDS, "kind");
    if (body.status !== undefined) {
      data.status = validateChoice(body.status, ACTION_STATUSES, "status");
      data.completedAt = body.status === "done" ? new Date() : null;
    }
    if (body.dueDate !== undefined) data.dueDate = parseOptionalDate(body.dueDate);
    if (body.jobId !== undefined) data.jobId = optionalString(body.jobId);
    if (body.contactId !== undefined) data.contactId = optionalString(body.contactId);
    if (body.notes !== undefined) data.notes = optionalString(body.notes);
    const action = await db.actionItem.update({ where: { id }, data });
    return NextResponse.json(action);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json(toErrorResponse(error), { status: 400 });
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await db.actionItem.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json(toErrorResponse(error), { status: 400 });
  }
}
