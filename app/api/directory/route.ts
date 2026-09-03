import { NextResponse } from "next/server";
import { DIRECTORY_CATEGORIES, DIRECTORY_STATUSES } from "@/lib/constants";
import { parseOptionalDate } from "@/lib/date";
import { db } from "@/lib/db";
import { serializeDirectoryItem } from "@/lib/serialize";
import { optionalString, requireString, toErrorResponse, validateChoice } from "@/lib/validation";

export async function GET() {
  try {
    const items = await db.directoryItem.findMany({ orderBy: [{ status: "asc" }, { name: "asc" }] });
    return NextResponse.json(items.map(serializeDirectoryItem));
  } catch (error) {
    return NextResponse.json(toErrorResponse(error), { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const item = await db.directoryItem.create({
      data: {
        name: requireString(body.name, "name"),
        url: optionalString(body.url),
        category: validateChoice(body.category, DIRECTORY_CATEGORIES, "category", "platform"),
        status: validateChoice(body.status, DIRECTORY_STATUSES, "status", "active"),
        checkFrequencyDays: typeof body.checkFrequencyDays === "number" ? body.checkFrequencyDays : null,
        lastCheckedAt: parseOptionalDate(body.lastCheckedAt),
        nextAction: optionalString(body.nextAction),
        notes: optionalString(body.notes),
      },
    });
    return NextResponse.json(serializeDirectoryItem(item), { status: 201 });
  } catch (error) {
    return NextResponse.json(toErrorResponse(error), { status: 400 });
  }
}
