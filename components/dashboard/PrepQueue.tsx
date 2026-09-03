import type { SerializedActionItem } from "@/lib/types";

export function PrepQueue({ actions }: { actions: SerializedActionItem[] }) {
  if (actions.length === 0) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-gray-900 mb-3">Prep Queue</h2>
        <p className="text-sm text-gray-400">No prep actions queued.</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      <h2 className="text-sm font-semibold text-gray-900 mb-3">Prep Queue</h2>
      <div className="space-y-2">
        {actions.map((action) => (
          <div key={action.id} className="flex items-start justify-between gap-2 py-1.5">
            <div className="min-w-0 flex-1">
              <div className="text-sm text-gray-900">{action.title}</div>
              <div className="text-xs text-gray-500">
                {action.job?.company && `${action.job.company}`}
                {action.dueDate && (
                  <span className="ml-2">
                    Due: {new Date(action.dueDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                  </span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
