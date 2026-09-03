import { NextResponse } from "next/server";
import { getDailyAssistantContext } from "@/lib/assistant-service";
import { toErrorResponse } from "@/lib/validation";

export async function GET() {
  try {
    return NextResponse.json(await getDailyAssistantContext());
  } catch (error) {
    return NextResponse.json(toErrorResponse(error), { status: 500 });
  }
}
