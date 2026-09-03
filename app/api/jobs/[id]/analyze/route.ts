import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { AI_PROVIDER_CONFIG } from "@/lib/constants";
import { computeAtsCheck, parseJdAnalysis } from "@/lib/jd-analysis";
import Anthropic from "@anthropic-ai/sdk";

async function callAI(systemPrompt: string, userMsg: string): Promise<string> {
  const config = await db.aiProviderConfig.findFirst({
    where: { isDefault: true },
    orderBy: { createdAt: "asc" },
  });
  const provider = config?.provider ?? "openrouter";

  if (provider === "anthropic") {
    const key = process.env[config?.apiKeyName || "ANTHROPIC_API_KEY"] || process.env.ANTHROPIC_API_KEY;
    if (!key) throw new Error("No Anthropic key configured");
    const client = new Anthropic({ apiKey: key });
    const res = await client.messages.create({
      model: config?.model || "claude-haiku-4-5-20251001",
      max_tokens: 1024,
      system: systemPrompt,
      messages: [{ role: "user", content: userMsg }],
    });
    const c = res.content[0];
    return c.type === "text" ? c.text : "";
  }

  const provConfig = AI_PROVIDER_CONFIG[provider];
  if (!provConfig) throw new Error("No AI provider configured");
  const key = process.env[config?.apiKeyName || provConfig.keyEnvVar] || process.env[provConfig.keyEnvVar];
  if (!key) throw new Error("No API key for " + provConfig.label);

  const res = await fetch(provConfig.baseUrl + "/chat/completions", {
    method: "POST",
    headers: {
      Authorization: "Bearer " + key,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: config?.model || provConfig.defaultModel,
      max_tokens: 1024,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMsg },
      ],
    }),
  });
  if (!res.ok) throw new Error("AI error " + res.status);
  const data = await res.json();
  return data.choices?.[0]?.message?.content ?? "";
}

function buildSystemPrompt(): string {
  const ownerProfile = process.env.OWNER_PROFILE?.trim();
  const profileBlock = ownerProfile ? `Candidate profile:\n${ownerProfile}\n\n` : "";

  return `You are a career analyst. Analyze job descriptions for the candidate and return ONLY a JSON object, no other text.

${profileBlock}Return this exact JSON shape (no markdown, no extra text):
{
  "grade": "A|B|C|D|F",
  "fitNote": "one sentence on overall fit",
  "salary": "extracted salary range or 'Not specified'",
  "location": "remote|hybrid|onsite or city",
  "matched": ["skill or experience the candidate has that matches"],
  "gaps": ["skill or requirement the candidate lacks"],
  "keyReqs": ["top 4-5 must-have requirements from JD"],
  "redFlags": ["concerns: underpay, low match, unclear scope, etc."],
  "practiceRecs": ["specific topic to study to close gaps, with platform suggestion"]
}

Grade scale: A = strong match (80%+ overlap, good pay), B = decent fit (60-79%), C = stretch (40-59%), D = weak (20-39%), F = poor fit or red flags.`;
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const jdText: string = body.jdText || "";

    if (!jdText.trim()) {
      return NextResponse.json({ error: "jdText is required" }, { status: 400 });
    }

    const job = await db.job.findUnique({ where: { id }, select: { id: true, title: true, company: true } });
    if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });
    const defaultResume = await db.resumeVersion.findFirst({
      where: { isDefault: true },
      select: { content: true },
    });
    if (!defaultResume?.content?.trim()) {
      return NextResponse.json(
        { error: "Default resume not found. Add or mark a default resume first." },
        { status: 422 }
      );
    }

    const userMsg = "Job: " + job.company + " — " + job.title + "\n\nJD:\n" + jdText.slice(0, 6000);

    let raw: string;
    try {
      raw = await callAI(buildSystemPrompt(), userMsg);
    } catch (err) {
      return NextResponse.json(
        { error: err instanceof Error ? err.message : "AI call failed" },
        { status: 502 }
      );
    }

    // Strip markdown fences if present
    const cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/, "").trim();
    const analysis = parseJdAnalysis(cleaned);
    if (!analysis) {
      return NextResponse.json(
        { error: "AI returned malformed JSON", raw },
        { status: 502 }
      );
    }
    analysis.atsCheck = computeAtsCheck(analysis.keyReqs ?? [], defaultResume.content);

    // Save to DB
    await db.job.update({
      where: { id },
      data: {
        jdText,
        score: analysis.grade,
        jdAnalysis: JSON.stringify(analysis),
      },
    });

    return NextResponse.json({ analysis });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Analysis failed" },
      { status: 500 }
    );
  }
}
