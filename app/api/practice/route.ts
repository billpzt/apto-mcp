import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  try {
    const sessions = await db.practiceSession.findMany({
      orderBy: { date: "desc" },
      take: 100,
      include: { skill: { select: { id: true, name: true } } },
    });
    return NextResponse.json(sessions);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load sessions" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const session = await db.practiceSession.create({
      data: {
        platform: String(body.platform || "").trim() || "Other",
        topic: String(body.topic || "").trim() || "General",
        problems: body.problems ? Number(body.problems) : null,
        duration: body.duration ? Number(body.duration) : null,
        difficulty: body.difficulty ? String(body.difficulty) : null,
        notes: body.notes ? String(body.notes) : null,
        skillId: body.skillId ? String(body.skillId) : null,
        date: body.date ? new Date(body.date) : new Date(),
      },
      include: { skill: { select: { id: true, name: true } } },
    });
    return NextResponse.json(session, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create session" },
      { status: 500 }
    );
  }
}
