import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { AI_PROVIDER_CONFIG, SKILL_CATEGORIES } from "@/lib/constants";
import Anthropic from "@anthropic-ai/sdk";

interface ExtractedSkill {
  name: string;
  category: string;
  level: number;
  yearsExp: number | null;
}

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
      max_tokens: 2048,
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
      max_tokens: 2048,
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

const SYSTEM = `You extract skills from a resume and return ONLY a JSON array, no other text.

For each distinct skill or technology mentioned, infer a proficiency level 1-5 from context (years used, depth of responsibility, recency, how central it is):
1 = Beginner, 2 = Basic, 3 = Intermediate, 4 = Advanced, 5 = Expert.

Categorize each skill into one of: ${SKILL_CATEGORIES.join(", ")}.

Return this exact JSON shape (no markdown, no extra text):
[
  { "name": "Python", "category": "Languages", "level": 4, "yearsExp": 5 }
]

Only include real skills/technologies, not soft traits unless explicitly listed under skills. If years of experience can't be inferred, use null.`;

export async function POST() {
  try {
    const resume = await db.resumeVersion.findFirst({
      where: { isDefault: true },
      orderBy: { createdAt: "asc" },
    });

    if (!resume?.content?.trim()) {
      return NextResponse.json({ error: "No default resume with content found" }, { status: 400 });
    }

    let raw: string;
    try {
      raw = await callAI(SYSTEM, resume.content.slice(0, 12000));
    } catch (err) {
      return NextResponse.json(
        { error: err instanceof Error ? err.message : "AI call failed" },
        { status: 502 }
      );
    }

    const cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/, "").trim();
    let extracted: ExtractedSkill[];
    try {
      extracted = JSON.parse(cleaned) as ExtractedSkill[];
    } catch {
      return NextResponse.json(
        { error: "AI returned malformed JSON", raw },
        { status: 502 }
      );
    }

    const existing = await db.skill.findMany();
    let updatedCount = 0;
    let createdCount = 0;

    for (const s of extracted) {
      if (!s.name?.trim() || !s.level) continue;
      const match = existing.find((e) => e.name.toLowerCase() === s.name.trim().toLowerCase());
      if (match) {
        await db.skill.update({
          where: { id: match.id },
          data: {
            level: s.level,
            category: match.category ?? s.category ?? null,
            yearsExp: match.yearsExp ?? s.yearsExp ?? null,
          },
        });
        updatedCount++;
      } else {
        await db.skill.create({
          data: {
            name: s.name.trim(),
            category: s.category || null,
            level: s.level,
            yearsExp: s.yearsExp ?? null,
          },
        });
        createdCount++;
      }
    }

    return NextResponse.json({ updatedCount, createdCount, syncedAt: new Date().toISOString() });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Sync failed" },
      { status: 500 }
    );
  }
}
