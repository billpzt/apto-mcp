import { NextResponse } from "next/server";
import { ACTION_KINDS, ACTION_STATUSES } from "@/lib/constants";
import { parseOptionalDate } from "@/lib/date";
import { db } from "@/lib/db";
import { optionalString, requireString, toErrorResponse, validateChoice } from "@/lib/validation";

export async function GET() {
  try {
    const actions = await db.actionItem.findMany({
      orderBy: [{ status: "asc" }, { dueDate: "asc" }, { createdAt: "desc" }],
      include: {
        job: { select: { id: true, company: true, title: true, status: true, score: true, priority: true } },
        contact: { select: { id: true, name: true, company: true } },
      },
    });
    return NextResponse.json(actions);
  } catch (error) {
    return NextResponse.json(toErrorResponse(error), { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const action = await db.actionItem.create({
      data: {
        title: requireString(body.title, "title"),
        kind: validateChoice(body.kind, ACTION_KINDS, "kind", "follow_up"),
        status: validateChoice(body.status, ACTION_STATUSES, "status", "open"),
        dueDate: parseOptionalDate(body.dueDate),
        completedAt: parseOptionalDate(body.completedAt),
        jobId: optionalString(body.jobId),
        contactId: optionalString(body.contactId),
        notes: optionalString(body.notes),
      },
    });
    return NextResponse.json(action, { status: 201 });
  } catch (error) {
    return NextResponse.json(toErrorResponse(error), { status: 400 });
  }
}
