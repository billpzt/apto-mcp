import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { DIRECTORY_CATEGORIES, DIRECTORY_STATUSES } from "@/lib/constants";
import { parseOptionalDate } from "@/lib/date";
import { db } from "@/lib/db";
import { serializeDirectoryItem } from "@/lib/serialize";
import { optionalString, requireString, toErrorResponse, validateChoice } from "@/lib/validation";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json();
    const data: Record<string, unknown> = {};
    if (body.name !== undefined) data.name = requireString(body.name, "name");
    if (body.url !== undefined) data.url = optionalString(body.url);
    if (body.category !== undefined)
      data.category = validateChoice(body.category, DIRECTORY_CATEGORIES, "category");
    if (body.status !== undefined)
      data.status = validateChoice(body.status, DIRECTORY_STATUSES, "status");
    if (body.checkFrequencyDays !== undefined)
      data.checkFrequencyDays = typeof body.checkFrequencyDays === "number" ? body.checkFrequencyDays : null;
    if (body.lastCheckedAt !== undefined)
      data.lastCheckedAt = parseOptionalDate(body.lastCheckedAt);
    if (body.nextAction !== undefined) data.nextAction = optionalString(body.nextAction);
    if (body.notes !== undefined) data.notes = optionalString(body.notes);
    const item = await db.directoryItem.update({ where: { id }, data });
    return NextResponse.json(serializeDirectoryItem(item));
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
    await db.directoryItem.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json(toErrorResponse(error), { status: 400 });
  }
}
