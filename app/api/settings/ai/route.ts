import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { optionalString, toErrorResponse, validateChoice } from "@/lib/validation";
import { AI_PROVIDERS } from "@/lib/constants";

export async function GET() {
  try {
    const configs = await db.aiProviderConfig.findMany({
      orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
    });
    return NextResponse.json(configs);
  } catch (error) {
    return NextResponse.json(toErrorResponse(error), { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const provider = validateChoice(body.provider, AI_PROVIDERS, "provider", "manual");
    if (body.isDefault) {
      await db.aiProviderConfig.updateMany({ data: { isDefault: false } });
    }
    const config = await db.aiProviderConfig.create({
      data: {
        provider,
        model: optionalString(body.model),
        apiKeyName: optionalString(body.apiKeyName),
        isDefault: Boolean(body.isDefault),
      },
    });
    return NextResponse.json(config, { status: 201 });
  } catch (error) {
    return NextResponse.json(toErrorResponse(error), { status: 400 });
  }
}
