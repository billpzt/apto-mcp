import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { db } from "@/lib/db";
import { AI_PROVIDER_CONFIG } from "@/lib/constants";
import { extractActions } from "@/lib/chat-utils";
import type { ChatMessage } from "@/lib/chat-utils";

async function callOpenAICompatible(
  baseUrl: string,
  apiKey: string,
  model: string,
  systemPrompt: string,
  messages: ChatMessage[],
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
      messages: [{ role: "system", content: systemPrompt }, ...messages],
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(providerLabel + " error " + res.status + ": " + err);
  }
  const data = await res.json();
  return data.choices?.[0]?.message?.content ?? "";
}

async function callAnthropic(
  apiKey: string,
  model: string,
  systemPrompt: string,
  messages: ChatMessage[]
): Promise<string> {
  const client = new Anthropic({ apiKey });
  const response = await client.messages.create({
    model,
    max_tokens: 1024,
    system: systemPrompt,
    messages,
  });
  const content = response.content[0];
  return content.type === "text" ? content.text : "";
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { apiKey } = body;

    const messages: ChatMessage[] = body.messages
      ? (body.messages as ChatMessage[])
      : [{ role: "user" as const, content: String(body.message ?? "") }];

    const defaultConfig = await db.aiProviderConfig.findFirst({
      where: { isDefault: true },
      orderBy: { createdAt: "asc" },
    });

    const provider = apiKey ? "anthropic" : (defaultConfig?.provider ?? "openrouter");

    if (provider === "manual") {
      return NextResponse.json(
        { error: "Provider is set to manual. Configure a live provider in Settings > AI." },
        { status: 400 }
      );
    }

    const [jobs, contacts, actionItems, skills, resumes] = await Promise.all([
      db.job.findMany({ orderBy: { createdAt: "desc" }, take: 50 }),
      db.contact.findMany({
        orderBy: { createdAt: "desc" },
        take: 30,
        include: { job: { select: { id: true, company: true, status: true } } },
      }),
      db.actionItem.findMany({
        where: { status: "open" },
        orderBy: [{ dueDate: "asc" }, { createdAt: "desc" }],
        take: 20,
        include: { job: { select: { id: true, company: true } } },
      }),
      db.skill.findMany({ orderBy: { level: "desc" } }),
      db.resumeVersion.findMany({ where: { isDefault: true }, take: 1 }),
    ]);

    const jobLines: string[] = [];
    for (const j of jobs) {
      let line = "- [" + j.status + "] id:" + j.id + " | " + j.company + " | " + j.title;
      if (j.score) line = line + " | Score: " + j.score;
      if (j.priority) line = line + " | Priority: " + j.priority;
      if (j.followUpDate) line = line + " | Follow-up: " + j.followUpDate.toISOString().slice(0, 10);
      if (j.nextAction) line = line + " | Next: " + j.nextAction;
      if (j.notes) line = line + " | Notes: " + j.notes;
      jobLines.push(line);
    }
    const jobSummary = jobLines.join("\n") || "No jobs tracked yet.";

    const contactLines: string[] = [];
    for (const c of contacts) {
      let line = "- id:" + c.id + " | " + c.name;
      if (c.title) line = line + ", " + c.title;
      if (c.company) line = line + " @ " + c.company;
      if (c.email) line = line + " | email: " + c.email;
      if (c.linkedin) line = line + " | linkedin: " + c.linkedin;
      if (c.job) line = line + " | linked: " + c.job.company + " id:" + c.job.id;
      contactLines.push(line);
    }
    const contactSummary = contactLines.join("\n") || "No contacts tracked yet.";

    const actionLines: string[] = [];
    for (const a of actionItems) {
      let line = "- id:" + a.id + " | " + a.title;
      if (a.dueDate) line = line + " | Due: " + a.dueDate.toISOString().slice(0, 10);
      if (a.job) line = line + " | job: " + a.job.company + " id:" + a.job.id;
      actionLines.push(line);
    }
    const actionSummary = actionLines.join("\n") || "No open action items.";

    const skillLines: string[] = [];
    for (const s of skills) {
      const exp = s.yearsExp ? ", " + s.yearsExp + "y" : "";
      skillLines.push("- " + s.name + " (Level " + s.level + "/5" + exp + ")");
    }
    const skillSummary = skillLines.join("\n") || "No skills tracked yet.";

    const resumeContext = resumes[0]
      ? "\n== RESUME (" + resumes[0].name + ") ==\n" + resumes[0].content + "\n"
      : "";

    const actionDocs = [
      'Update job:    {"action":"update_job","id":"<job_id>","status":"<STATUS>"}',
      'Add note:      {"action":"add_note","jobId":"<job_id>","summary":"<text>"}',
      'Add task:      {"action":"add_action_item","title":"<text>","kind":"follow_up","jobId":"<job_id>"}',
      'Add job:       {"action":"add_job","data":{"title":"...","company":"...","status":"BACKLOG"}}',
      'Complete task: {"action":"complete_action_item","id":"<action_id>"}',
    ].join("\n");

    const ownerName = process.env.NEXT_PUBLIC_OWNER_NAME?.trim();

    const systemPrompt = [
      `You are Apto, an AI career assistant for ${ownerName || "the user"}.`,
      "You have full context on their job search, skills, contacts, and action items.",
      "",
      resumeContext,
      "== JOB TRACKER (" + jobs.length + " jobs) ==",
      "Format: [STATUS] id:<id> | Company | Title | extras",
      jobSummary,
      "",
      "== CONTACTS (" + contacts.length + ") ==",
      contactSummary,
      "",
      "== OPEN ACTION ITEMS (" + actionItems.length + ") ==",
      actionSummary,
      "",
      "== SKILLS (" + skills.length + ") ==",
      skillSummary,
      "",
      "== WRITE-BACK ACTIONS ==",
      "Embed JSON in your reply to update data. Use IDs from above.",
      actionDocs,
      "",
      "When a JD is pasted, extract: company, title, key requirements, red flags, fit score (A-F).",
      "Keep responses concise and actionable.",
    ].join("\n");

    let rawReply: string;

    if (provider === "anthropic") {
      const keyName = defaultConfig?.apiKeyName || "ANTHROPIC_API_KEY";
      const key = apiKey || process.env[keyName] || process.env.ANTHROPIC_API_KEY;
      if (!key) {
        return NextResponse.json(
          { error: "No Anthropic key. Set " + keyName + " in .env.local." },
          { status: 400 }
        );
      }
      const model = defaultConfig?.model || "claude-haiku-4-5-20251001";
      rawReply = await callAnthropic(key, model, systemPrompt, messages);
    } else {
      const provConfig = AI_PROVIDER_CONFIG[provider];
      if (!provConfig) {
        return NextResponse.json(
          { error: "Unknown provider: " + provider },
          { status: 400 }
        );
      }
      const keyName = defaultConfig?.apiKeyName || provConfig.keyEnvVar;
      const key = process.env[keyName] || process.env[provConfig.keyEnvVar];
      if (!key) {
        return NextResponse.json(
          { error: "No API key for " + provConfig.label + ". Set " + provConfig.keyEnvVar + " in .env.local." },
          { status: 400 }
        );
      }
      const model = defaultConfig?.model || provConfig.defaultModel;
      rawReply = await callOpenAICompatible(
        provConfig.baseUrl,
        key,
        model,
        systemPrompt,
        messages,
        provConfig.label
      );
    }

    const { cleaned: reply, actions } = extractActions(rawReply);
    return NextResponse.json({
      reply,
      actions: actions.length ? actions : undefined,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not process chat request" },
      { status: 500 }
    );
  }
}
