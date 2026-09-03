import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { optionalString, toErrorResponse } from "@/lib/validation";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const data: Record<string, unknown> = {};
    if (body.name !== undefined) data.name = optionalString(body.name);
    if (body.title !== undefined) data.title = optionalString(body.title);
    if (body.company !== undefined) data.company = optionalString(body.company);
    if (body.email !== undefined) data.email = optionalString(body.email);
    if (body.linkedin !== undefined) data.linkedin = optionalString(body.linkedin);
    if (body.notes !== undefined) data.notes = optionalString(body.notes);
    const contact = await db.contact.update({
      where: { id },
      data,
    });
    return NextResponse.json(contact);
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
    await db.contact.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json(toErrorResponse(error), { status: 400 });
  }
}
