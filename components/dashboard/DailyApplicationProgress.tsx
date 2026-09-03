// components/dashboard/DailyApplicationProgress.tsx
import type { DailyApplicationQueue } from "@/lib/daily-search";

export function DailyApplicationProgress({ queue }: { queue: DailyApplicationQueue }) {
  const percent = Math.min(100, Math.round((queue.submittedToday / queue.dailyFloor) * 100));
  return (
    <section className="rounded-xl border border-gray-200 bg-white p-5">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h2 className="text-sm font-semibold text-gray-900">Applications today</h2>
          <p className="mt-1 text-sm text-gray-500">
            {queue.minimumComplete
              ? `Minimum complete. Keep going while strong matches remain.`
              : `${queue.remainingToFloor} more to reach today's minimum.`}
          </p>
        </div>
        <div className="text-right">
          <div className="text-3xl font-bold text-gray-900">{queue.submittedToday}</div>
          <div className="text-xs text-gray-500">{queue.submittedThisWeek} this week</div>
        </div>
      </div>
      <div className="mt-4 h-2 overflow-hidden rounded-full bg-gray-100">
        <div className="h-full rounded-full bg-indigo-500" style={{ width: `${percent}%` }} />
      </div>
      <p className="mt-2 text-xs text-gray-400">Three is the floor, not the cap.</p>
    </section>
  );
}
