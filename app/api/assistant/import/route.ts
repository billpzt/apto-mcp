import { NextResponse } from "next/server";
import { importJobCandidates } from "@/lib/assistant-service";
import { toErrorResponse } from "@/lib/validation";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const candidates = Array.isArray(body) ? body : body.candidates;
    if (!Array.isArray(candidates)) {
      return NextResponse.json({ error: "candidates must be an array" }, { status: 400 });
    }
    return NextResponse.json(await importJobCandidates(candidates));
  } catch (error) {
    return NextResponse.json(toErrorResponse(error), { status: 400 });
  }
}
