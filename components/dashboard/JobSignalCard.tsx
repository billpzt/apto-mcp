"use client";

import { STATUS_CONFIG } from "@/lib/constants";
import type { SerializedJob } from "@/lib/types";

// ponytail: hex map mirrors Tailwind's status palette, one source if colors drift
const statusColors: Record<string, { bg: string; text: string }> = {
  BACKLOG: { bg: "#f1f5f9", text: "#64748b" },
  PROFILE_LIVE: { bg: "#f0fdf4", text: "#059669" },
  APPLIED: { bg: "#eff6ff", text: "#2563eb" },
  ASSESSMENT: { bg: "#f5f3ff", text: "#7c3aed" },
  STANDBY: { bg: "#fffbeb", text: "#d97706" },
  CLOSED: { bg: "#ecfdf5", text: "#059669" },
  STALLED: { bg: "#fff7ed", text: "#f97316" },
  REJECTED: { bg: "#fef2f2", text: "#ef4444" },
  WITHDRAWN: { bg: "#f8fafc", text: "#94a3b8" },
};

export function JobSignalCard({ job }: { job: SerializedJob }) {
  const cfg = STATUS_CONFIG[job.status as keyof typeof STATUS_CONFIG];
  const sc = statusColors[job.status] ?? { bg: "#f8fafc", text: "#94a3b8" };

  return (
    <div className="rounded-lg border border-gray-100 bg-white p-3 hover:border-gray-200 transition-colors">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="text-sm font-medium text-gray-900 truncate">{job.company}</div>
          <div className="text-xs text-gray-500 truncate">{job.title}</div>
        </div>
        <span
          className="shrink-0 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium"
          style={{ backgroundColor: sc.bg, color: sc.text }}
        >
          {cfg?.label ?? job.status}
        </span>
      </div>

      <div className="mt-2 flex flex-wrap gap-1.5">
        {job.score && (
          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-blue-50 text-blue-600">
            {job.score}
          </span>
        )}
        {job.priority && (
          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-50 text-amber-600 capitalize">
            {job.priority}
          </span>
        )}
        {job.sourceType && (
          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-purple-50 text-purple-600">
            {job.sourceType.replace(/_/g, " ")}
          </span>
        )}
      </div>

      {job.nextAction && (
        <p className="mt-1.5 text-[11px] text-gray-600 line-clamp-2">{job.nextAction}</p>
      )}

      {job.followUpDate && (
        <p className="mt-1 text-[10px] text-gray-400">
          Follow up: {new Date(job.followUpDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
        </p>
      )}
    </div>
  );
}
