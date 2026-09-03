import { STATUS_CONFIG, type JobStatus } from "@/lib/constants";

type StatusCount = {
  status: JobStatus;
  count: number;
};

const DISPLAY_STATUSES: JobStatus[] = [
  "BACKLOG",
  "APPLIED",
  "ASSESSMENT",
  "STANDBY",
  "CLOSED",
  "STALLED",
  "REJECTED",
  "WITHDRAWN",
];

export function FunnelHeader({ counts }: { counts: Record<JobStatus, number> }) {
  const appliedCount = counts.APPLIED;
  const respondedCount = counts.ASSESSMENT + counts.STANDBY + counts.CLOSED;
  const responseRate = appliedCount > 0 ? Math.round((respondedCount / appliedCount) * 100) : null;

  const items: StatusCount[] = DISPLAY_STATUSES.map((status) => ({
    status,
    count: counts[status],
  }));

  return (
    <div className="border-b border-[var(--border)] bg-[var(--surface)] px-6 py-3">
      <div className="flex flex-wrap items-center gap-2">
        {items.map(({ status, count }) => {
          const config = STATUS_CONFIG[status];
          return (
            <div
              key={status}
              className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white px-3 py-1.5 text-xs"
            >
              <span className={`h-2 w-2 rounded-full ${config.dot}`} />
              <span className="text-gray-500">{config.label}</span>
              <span className="font-semibold text-gray-900 tabular-nums">{count}</span>
            </div>
          );
        })}
        <div className="ml-auto inline-flex items-center gap-2 rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs">
          <span className="text-indigo-700">Response rate</span>
          <span className="font-semibold text-indigo-900 tabular-nums">
            {responseRate === null ? "N/A" : `${responseRate}%`}
          </span>
        </div>
      </div>
    </div>
  );
}
