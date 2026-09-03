import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import type { SerializedJobUpdate } from "./types";
import { getJobUpdateTimelinePreview } from "./job-update-timeline";

type MarkdownJobMeta = {
  id: string;
  company: string;
  title: string;
  status: string;
  lastContactDate: string | null;
  followUpDate: string | null;
  nextAction: string | null;
  closedReason: string | null;
};

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function getJobUpdatesMarkdownPath(company: string, title: string): string {
  return `data/job-updates/${slugify(`${company}-${title}`)}.md`;
}

export function getJobUpdatesMarkdownAbsolutePath(company: string, title: string): string {
  return path.join(process.cwd(), getJobUpdatesMarkdownPath(company, title));
}

function formatIsoDate(iso: string | null): string | null {
  if (!iso) return null;
  return new Date(iso).toISOString().slice(0, 10);
}

export function buildJobUpdatesMarkdown(
  job: MarkdownJobMeta,
  updates: SerializedJobUpdate[]
): string {
  const timeline = getJobUpdateTimelinePreview(updates, updates.length);
  const lines = [
    `# ${job.company} - ${job.title}`,
    "",
    `Status: ${job.status}`,
    job.lastContactDate ? `Last contact: ${formatIsoDate(job.lastContactDate)}` : null,
    job.followUpDate ? `Follow up: ${formatIsoDate(job.followUpDate)}` : null,
    job.nextAction ? `Next action: ${job.nextAction}` : null,
    job.closedReason ? `Closed reason: ${job.closedReason}` : null,
    "",
    "## Updates",
    "",
    ...timeline.flatMap((update) => [
      `- ${formatIsoDate(update.occurredAt)} | ${update.kind} | ${update.summary}`,
      update.details ? `  ${update.details}` : null,
    ]),
    "",
  ];

  return lines.filter((line): line is string => line !== null).join("\n");
}

export async function writeJobUpdatesMarkdown(
  job: MarkdownJobMeta,
  updates: SerializedJobUpdate[]
): Promise<void> {
  const relativePath = getJobUpdatesMarkdownPath(job.company, job.title);
  const absolutePath = path.join(process.cwd(), relativePath);
  await mkdir(path.dirname(absolutePath), { recursive: true });
  await writeFile(absolutePath, buildJobUpdatesMarkdown(job, updates), "utf8");
}

export async function removeJobUpdatesMarkdown(company: string, title: string): Promise<void> {
  const absolutePath = getJobUpdatesMarkdownAbsolutePath(company, title);
  await rm(absolutePath, { force: true });
}
