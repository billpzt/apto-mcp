import { NextResponse } from "next/server";
import { getDailyAssistantContext } from "@/lib/assistant-service";

export async function GET() {
  const context = await getDailyAssistantContext();
  return new NextResponse(JSON.stringify(context, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": "attachment; filename=apto-daily-context.json",
    },
  });
}
