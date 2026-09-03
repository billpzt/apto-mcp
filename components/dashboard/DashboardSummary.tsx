export function DashboardSummary({
  summary,
}: {
  summary: {
    activeJobs: number;
    highPriorityJobs: number;
    openActions: number;
    dueToday: number;
    staleJobs: number;
  };
}) {
  const items = [
    { label: "Active jobs", value: summary.activeJobs, color: "text-blue-600", bg: "bg-blue-50" },
    { label: "High priority", value: summary.highPriorityJobs, color: "text-amber-600", bg: "bg-amber-50" },
    { label: "Open actions", value: summary.openActions, color: "text-violet-600", bg: "bg-violet-50" },
    { label: "Due today", value: summary.dueToday, color: "text-rose-600", bg: "bg-rose-50" },
    { label: "Stale", value: summary.staleJobs, color: "text-red-500", bg: "bg-red-50" },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
      {items.map((item) => (
        <div key={item.label} className="rounded-xl border border-gray-200 bg-white p-4">
          <div className="text-2xl font-bold text-gray-900">{item.value}</div>
          <div className="text-xs text-gray-500 mt-1">{item.label}</div>
        </div>
      ))}
    </div>
  );
}
