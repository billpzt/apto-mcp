import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  const skills = await db.skill.findMany({ orderBy: { name: "asc" } });
  return NextResponse.json(skills);
}

export async function POST(req: Request) {
  const body = await req.json();
  const skill = await db.skill.create({
    data: {
      name: body.name,
      category: body.category ?? null,
      level: body.level ?? 3,
      yearsExp: body.yearsExp ?? null,
      notes: body.notes ?? null,
      featured: body.featured ?? false,
    },
  });
  return NextResponse.json(skill, { status: 201 });
}
