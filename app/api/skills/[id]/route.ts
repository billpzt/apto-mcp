import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json();
  const skill = await db.skill.update({
    where: { id },
    data: {
      name: body.name,
      category: body.category ?? null,
      level: body.level,
      yearsExp: body.yearsExp ?? null,
      notes: body.notes ?? null,
      featured: body.featured ?? false,
    },
  });
  return NextResponse.json(skill);
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  await db.skill.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
