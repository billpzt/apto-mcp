"use client";

import { useState } from "react";
import {
  ExternalLink, MoreHorizontal, Pencil, Trash2, ArrowRight,
  MapPin, DollarSign, MessageSquare, Zap,
} from "lucide-react";
import { KANBAN_STATUSES, STATUS_CONFIG, type JobStatus } from "@/lib/constants";
import { parseJdAnalysis } from "@/lib/jd-analysis";
import { formatJobUpdateOccurredAt } from "@/lib/job-update-timeline";
import { formatCalendarDate } from "@/lib/date";
import { safeUrl } from "@/lib/url";
import type { SkillRecord } from "./KanbanBoard";

type Job = {
  id: string;
  title: string;
  company: string;
  url: string | null;
  status: string;
  location: string | null;
  salary: string | null;
  jobType: string | null;
  notes: string | null;
  appliedAt: string | null;
  lastContactDate: string | null;
  createdAt: string;
  score?: string | null;
  followUpDate?: string | null;
  nextAction?: string | null;
  priority?: string | null;
  sourceType?: string | null;
  jdAnalysis?: string | null;
  latestUpdate?: {
    id: string;
    jobId: string;
    occurredAt: string;
    kind: string;
    summary: string;
    details: string | null;
    createdAt: string;
    updatedAt: string;
  } | null;
};

type Props = {
  job: Job;
  skills: SkillRecord[];
  onEdit: () => void;
  onDelete: () => void;
  onStatusChange: (status: JobStatus) => void;
  onAnalyze: () => void;
  onOpen: () => void;
  selectMode: boolean;
  selected: boolean;
  onSelect: () => void;
};

type JdAnalysis = {
  matched?: string[];
  gaps?: string[];
};

type SkillPill = { label: string; color: "green" | "yellow" | "red" };

function normalize(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function buildSkillPills(jdAnalysis: string | null | undefined, skills: SkillRecord[]): SkillPill[] {
  const analysis = parseJdAnalysis(jdAnalysis) as JdAnalysis | null;
  if (!analysis) return [];

  const matched = analysis.matched ?? [];
  const gaps = analysis.gaps ?? [];
  if (matched.length === 0 && gaps.length === 0) return [];

  // Build normalized skill lookup: name → level
  const skillMap: Record<string, number> = {};
  for (const s of skills) {
    skillMap[normalize(s.name)] = s.level;
  }

  function findLevel(label: string): number | null {
    const n = normalize(label);
    // exact match
    if (skillMap[n] !== undefined) return skillMap[n];
    // substring match
    for (const [key, level] of Object.entries(skillMap)) {
      if (n.includes(key) || key.includes(n)) return level;
    }
    return null;
  }

  const pills: SkillPill[] = [];
  const seen = new Set<string>();

  for (const label of matched.slice(0, 4)) {
    const k = normalize(label);
    if (seen.has(k)) continue;
    seen.add(k);
    pills.push({ label, color: "green" });
  }

  for (const label of gaps.slice(0, 4)) {
    const k = normalize(label);
    if (seen.has(k)) continue;
    seen.add(k);
    const level = findLevel(label);
    // yellow = you have it but needs work (level 1-2 in your skills, or AI flagged as gap but you know it somewhat)
    // red = you don't have it at all or very weak
    pills.push({ label, color: level !== null && level >= 3 ? "yellow" : "red" });
  }

  return pills.slice(0, 6);
}

function formatDate(dateStr: string) {
  return formatCalendarDate(dateStr);
}

export function JobCard({ job, skills, onEdit, onDelete, onStatusChange, onAnalyze, onOpen, selectMode, selected, onSelect }: Props) {
  const [menuOpen, setMenuOpen] = useState(false);
  const cfg = STATUS_CONFIG[job.status as JobStatus];
  const currentIndex = KANBAN_STATUSES.indexOf(job.status as JobStatus);
  const nextStatus = currentIndex >= 0 && currentIndex < KANBAN_STATUSES.length - 1
    ? KANBAN_STATUSES[currentIndex + 1] : null;

  const skillPills = buildSkillPills(job.jdAnalysis, skills);

  const pillClass = (color: SkillPill["color"]) => {
    if (color === "green") return "bg-emerald-50 text-emerald-700 border border-emerald-200";
    if (color === "yellow") return "bg-amber-50 text-amber-700 border border-amber-200";
    return "bg-red-50 text-red-700 border border-red-200";
  };

  function handleCardClick(e: React.MouseEvent) {
    // Don't open drawer if clicking a button/link/menu inside the card
    if ((e.target as HTMLElement).closest("button,a,[data-no-open]")) return;
    if (selectMode) { onSelect(); return; }
    onOpen();
  }

  return (
    <div
      onClick={handleCardClick}
      className={[
        "bg-white rounded-lg border p-3.5 group hover:shadow-sm transition-all relative cursor-pointer",
        selected ? "border-indigo-400 ring-2 ring-indigo-100" : "border-gray-200 hover:border-gray-300",
      ].join(" ")}
    >
      {/* Select mode checkbox */}
      {selectMode && (
        <div data-no-open className="absolute top-3 left-3 z-10">
          <input
            type="checkbox"
            checked={selected}
            onChange={onSelect}
            onClick={e => e.stopPropagation()}
            className="w-4 h-4 accent-indigo-600 cursor-pointer"
          />
        </div>
      )}

      {/* Company + menu */}
      <div className={["flex items-start justify-between gap-2 mb-1", selectMode ? "pl-6" : ""].join(" ")}>
        <div className="flex-1 min-w-0">
          <div className="font-medium text-sm text-gray-900 truncate">{job.company}</div>
          <div className="text-xs text-gray-500 truncate mt-0.5">{job.title}</div>
        </div>
        <div className="relative">
          <button
            onClick={() => setMenuOpen((v) => !v)}
            className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600 opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <MoreHorizontal size={14} />
          </button>
          {menuOpen && (
            <div
              className="absolute right-0 top-6 z-20 w-44 bg-white rounded-lg shadow-lg border border-gray-200 py-1 text-sm"
              onMouseLeave={() => setMenuOpen(false)}
            >
              <button onClick={() => { onEdit(); setMenuOpen(false); }} className="flex items-center gap-2 w-full px-3 py-2 hover:bg-gray-50 text-gray-700">
                <Pencil size={13} /> Edit
              </button>
              <button onClick={() => { onAnalyze(); setMenuOpen(false); }} className="flex items-center gap-2 w-full px-3 py-2 hover:bg-gray-50 text-indigo-600">
                <Zap size={13} /> Check a job
              </button>
              {safeUrl(job.url) && (
                <a href={safeUrl(job.url)!} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-2 w-full px-3 py-2 hover:bg-gray-50 text-gray-700"
                  onClick={() => setMenuOpen(false)}>
                  <ExternalLink size={13} /> View Posting
                </a>
              )}
              <div className="border-t border-gray-100 my-1" />
              {nextStatus && (
                <button onClick={() => { onStatusChange(nextStatus); setMenuOpen(false); }} className="flex items-center gap-2 w-full px-3 py-2 hover:bg-gray-50 text-indigo-600">
                  <ArrowRight size={13} /> Move to {STATUS_CONFIG[nextStatus].label}
                </button>
              )}
              <div className="border-t border-gray-100 my-1" />
              {KANBAN_STATUSES.filter((s) => s !== job.status).map((s) => (
                <button key={s} onClick={() => { onStatusChange(s); setMenuOpen(false); }} className="flex items-center gap-2 w-full px-3 py-2 hover:bg-gray-50 text-gray-600">
                  <span className={"w-1.5 h-1.5 rounded-full " + STATUS_CONFIG[s].dot} />
                  {STATUS_CONFIG[s].label}
                </button>
              ))}
              <div className="border-t border-gray-100 my-1" />
              <button onClick={() => { onDelete(); setMenuOpen(false); }} className="flex items-center gap-2 w-full px-3 py-2 hover:bg-red-50 text-red-500">
                <Trash2 size={13} /> Delete
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Score / priority / source badges */}
      <div className="flex flex-wrap gap-1.5 mb-2">
        {job.score && (
          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-blue-50 text-blue-600">{job.score}</span>
        )}
        {job.priority && (
          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-50 text-amber-600 capitalize">{job.priority}</span>
        )}
        {job.sourceType && (
          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-purple-50 text-purple-600">{job.sourceType.replace(/_/g, " ")}</span>
        )}
      </div>

      {/* Skill pills from JD analysis */}
      {skillPills.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-2">
          {skillPills.map((pill) => (
            <span key={pill.label} className={"text-[10px] font-medium px-1.5 py-0.5 rounded " + pillClass(pill.color)}>
              {pill.label}
            </span>
          ))}
        </div>
      )}

      {job.nextAction && (
        <p className="text-[11px] text-gray-500 mb-1.5 line-clamp-2">{job.nextAction}</p>
      )}

      {job.latestUpdate && (
        <div className="mb-1.5 rounded-md border border-gray-100 bg-gray-50 px-2 py-1.5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[10px] font-medium uppercase tracking-wide text-gray-400">Latest update</span>
            <span className="text-[10px] text-gray-400">{formatJobUpdateOccurredAt(job.latestUpdate.occurredAt)}</span>
          </div>
          <p className="mt-1 text-[11px] text-gray-600 line-clamp-2">{job.latestUpdate.summary}</p>
        </div>
      )}

      {job.followUpDate && (
        <p className="text-[10px] text-gray-400 mb-1">
          Follow up: {formatCalendarDate(job.followUpDate)}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2 mt-2">
        {job.location && <span className="flex items-center gap-1 text-[11px] text-gray-400"><MapPin size={10} />{job.location}</span>}
        {job.salary && <span className="flex items-center gap-1 text-[11px] text-gray-400"><DollarSign size={10} />{job.salary}</span>}
        {job.jobType && <span className="text-[11px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-500">{job.jobType}</span>}
      </div>

      <div className="mt-2.5 pt-2.5 border-t border-gray-100 space-y-1.5">
        {job.lastContactDate && (
          <div className="flex items-center gap-1.5">
            <MessageSquare size={10} className="text-amber-400 shrink-0" />
            <span className="text-[11px] text-amber-600 font-medium">Contacted {formatDate(job.lastContactDate)}</span>
          </div>
        )}
        <div className="flex items-center justify-between">
          <span className="text-[11px] text-gray-400">
            {job.appliedAt ? "Applied " + formatDate(job.appliedAt) : "Added " + formatDate(job.createdAt)}
          </span>
          <span className={"text-[11px] font-medium px-2 py-0.5 rounded-full " + cfg.color + " " + cfg.bg}>
            {cfg.label}
          </span>
        </div>
      </div>
    </div>
  );
}
