import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { db } from "@/lib/db";
import { AI_PROVIDER_CONFIG } from "@/lib/constants";
import {
  buildCoverLetterPrompts,
  normalizeCoverLetterInput,
  validateCoverLetterInput,
} from "@/lib/cover-letter";

async function callOpenAICompatible(
  baseUrl: string,
  apiKey: string,
  model: string,
  systemPrompt: string,
  userPrompt: string,
  providerLabel: string
): Promise<string> {
  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "http://localhost:3000",
      "X-Title": "Apto Career Dashboard",
    },
    body: JSON.stringify({
      model,
      max_tokens: 1024,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(providerLabel + " error " + res.status + ": " + err);
  }

  const data = await res.json();
  return String(data.choices?.[0]?.message?.content ?? "").trim();
}

async function callAnthropic(
  apiKey: string,
  model: string,
  systemPrompt: string,
  userPrompt: string
): Promise<string> {
  const client = new Anthropic({ apiKey });
  const response = await client.messages.create({
    model,
    max_tokens: 1024,
    system: systemPrompt,
    messages: [{ role: "user", content: userPrompt }],
  });
  const content = response.content[0];
  return content.type === "text" ? content.text.trim() : "";
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const input = validateCoverLetterInput(normalizeCoverLetterInput(body));

    const job = await db.job.findUnique({
      where: { id: input.jobId },
      select: {
        id: true,
        title: true,
        company: true,
        location: true,
        salary: true,
        jobType: true,
        notes: true,
        jdText: true,
        jdAnalysis: true,
      },
    });

    if (!job) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    const resume = await db.resumeVersion.findFirst({
      where: { isDefault: true },
      select: { content: true },
    });

    if (!resume?.content?.trim()) {
      return NextResponse.json(
        { error: "Default resume not found. Add or mark a default resume first." },
        { status: 422 }
      );
    }

    const defaultConfig = await db.aiProviderConfig.findFirst({
      where: { isDefault: true },
      orderBy: { createdAt: "asc" },
    });

    const provider = defaultConfig?.provider ?? "openrouter";
    if (provider === "manual") {
      return NextResponse.json(
        { error: "Provider is set to manual. Configure a live provider in Settings > AI." },
        { status: 400 }
      );
    }

    const { systemPrompt, userPrompt } = buildCoverLetterPrompts({
      input,
      job,
      resumeContent: resume.content,
    });

    let letter = "";

    if (provider === "anthropic") {
      const keyName = defaultConfig?.apiKeyName || "ANTHROPIC_API_KEY";
      const key = process.env[keyName] || process.env.ANTHROPIC_API_KEY;
      if (!key) {
        return NextResponse.json(
          { error: "No Anthropic key. Set " + keyName + " in .env.local." },
          { status: 400 }
        );
      }

      const model = defaultConfig?.model || "claude-haiku-4-5-20251001";
      letter = await callAnthropic(key, model, systemPrompt, userPrompt);
    } else {
      const providerConfig = AI_PROVIDER_CONFIG[provider];
      if (!providerConfig) {
        return NextResponse.json({ error: "Unknown provider: " + provider }, { status: 400 });
      }

      const keyName = defaultConfig?.apiKeyName || providerConfig.keyEnvVar;
      const key = process.env[keyName] || process.env[providerConfig.keyEnvVar];
      if (!key) {
        return NextResponse.json(
          {
            error:
              "No API key for " +
              providerConfig.label +
              ". Set " +
              providerConfig.keyEnvVar +
              " in .env.local.",
          },
          { status: 400 }
        );
      }

      const model = defaultConfig?.model || providerConfig.defaultModel;
      letter = await callOpenAICompatible(
        providerConfig.baseUrl,
        key,
        model,
        systemPrompt,
        userPrompt,
        providerConfig.label
      );
    }

    if (!letter) {
      return NextResponse.json(
        { error: "The AI provider returned an empty response." },
        { status: 502 }
      );
    }

    return NextResponse.json({ letter });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not generate cover letter";
    const status = message === "jobId is required" || message.startsWith("Invalid ")
      ? 400
      : message.includes(" error ")
        ? 502
        : 500;

    return NextResponse.json({ error: message }, { status });
  }
}
