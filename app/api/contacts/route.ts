import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { optionalString, requireString, toErrorResponse } from "@/lib/validation";

export async function GET() {
  const contacts = await db.contact.findMany({ orderBy: { name: "asc" } });
  return NextResponse.json(contacts);
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const contact = await db.contact.create({
      data: {
        name: requireString(body.name, "name"),
        title: optionalString(body.title),
        company: optionalString(body.company),
        email: optionalString(body.email),
        linkedin: optionalString(body.linkedin),
        notes: optionalString(body.notes),
      },
    });
    return NextResponse.json(contact, { status: 201 });
  } catch (error) {
    return NextResponse.json(toErrorResponse(error), { status: 400 });
  }
}
