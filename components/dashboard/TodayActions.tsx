"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { buildActionCreatePayload, type DashboardAction } from "@/lib/dashboard";

export function TodayActions({ actions }: { actions: DashboardAction[] }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  const updateStatus = async (id: string, status: string) => {
    setError(null);
    const res = await fetch(`/api/actions/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (!res.ok) {
      setError((await res.json()).error ?? "Could not update action");
      return;
    }
    router.refresh();
  };

  const trackAction = async (action: DashboardAction) => {
    setError(null);
    const res = await fetch("/api/actions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(buildActionCreatePayload(action)),
    });
    if (!res.ok) {
      setError((await res.json()).error ?? "Could not track action");
      return;
    }
    router.refresh();
  };

  if (actions.length === 0) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-gray-900 mb-3">Today&apos;s Actions</h2>
        <p className="text-sm text-gray-400">No actions due today.</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      <h2 className="text-sm font-semibold text-gray-900 mb-3">
        Today&apos;s Actions ({actions.length})
      </h2>
      {error && (
        <div className="mb-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          {error}
        </div>
      )}
      <div className="space-y-1">
        {actions.map((action) => (
          <div
            key={action.id}
            className="flex items-center justify-between gap-3 py-2 border-b border-gray-50 last:border-b-0"
          >
            <div className="min-w-0 flex-1">
              <div className="text-sm text-gray-900">{action.title}</div>
              <div className="text-xs text-gray-500">
                {action.job?.company ?? action.directoryItem?.name ?? action.reason}
                {action.kind && (
                  <span className="ml-2 capitalize text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-500">
                    {action.kind.replace(/_/g, " ")}
                  </span>
                )}
                {action.source !== "action_item" && (
                  <span className="ml-1 text-[10px] text-indigo-500">
                    derived
                  </span>
                )}
              </div>
            </div>
            <div className="flex gap-1.5 shrink-0">
              {action.canComplete && action.actionItemId ? (
                <>
                  <button
                    onClick={() => updateStatus(action.actionItemId as string, "done")}
                    className="px-2 py-1 text-xs font-medium text-teal-700 bg-teal-50 rounded-md hover:bg-teal-100 transition-colors"
                  >
                    Done
                  </button>
                  <button
                    onClick={() => updateStatus(action.actionItemId as string, "skipped")}
                    className="px-2 py-1 text-xs font-medium text-gray-500 bg-gray-50 rounded-md hover:bg-gray-100 transition-colors"
                  >
                    Skip
                  </button>
                </>
              ) : (
                <>
                  {action.canTrack && (
                    <button
                      onClick={() => trackAction(action)}
                      className="px-2 py-1 text-xs font-medium text-teal-700 bg-teal-50 rounded-md hover:bg-teal-100 transition-colors"
                    >
                      Track
                    </button>
                  )}
                  <Link
                    href={action.directoryItem ? "/platforms" : "/jobs"}
                    className="px-2 py-1 text-xs font-medium text-indigo-600 bg-indigo-50 rounded-md hover:bg-indigo-100 transition-colors"
                  >
                    Review
                  </Link>
                </>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
