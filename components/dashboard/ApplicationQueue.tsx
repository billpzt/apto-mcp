import Link from "next/link";
import type { DailyApplicationQueue, RankedApplicationJob } from "@/lib/daily-search";

function QueueRows({ items, empty }: { items: RankedApplicationJob[]; empty: string }) {
  if (items.length === 0) return <p className="text-sm text-gray-400">{empty}</p>;
  return (
    <div className="divide-y divide-gray-100">
      {items.map(({ job, reasons }) => {
        const href = job.canonicalUrl ?? job.url;
        return (
          <div key={job.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <div className="text-sm font-medium text-gray-900">{job.company}: {job.title}</div>
              <div className="mt-1 text-xs text-gray-500">
                {job.score ? `Grade ${job.score}` : "Unscored"} · {job.eligibleFromBrazil ?? "eligibility unknown"}
              </div>
              <div className="mt-1 text-xs text-gray-400">{reasons.slice(0, 2).join(" · ")}</div>
            </div>
            <div className="flex shrink-0 gap-2">
              {href && <a href={href} target="_blank" rel="noreferrer" className="text-xs font-medium text-indigo-600">Open posting</a>}
              <Link href="/jobs" className="text-xs font-medium text-gray-600">Review</Link>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function ApplicationQueue({ queue }: { queue: DailyApplicationQueue }) {
  return (
    <section className="rounded-xl border border-gray-200 bg-white p-5 space-y-6">
      <div>
        <h2 className="text-sm font-semibold text-gray-900">Today&apos;s Three</h2>
        <QueueRows items={queue.todayThree} empty="No application-ready jobs yet. Ask your desktop assistant to replenish the queue." />
      </div>
      <div>
        <h2 className="text-sm font-semibold text-gray-900">More strong matches</h2>
        <QueueRows items={queue.moreStrongMatches} empty="No additional strong matches right now." />
      </div>
      <div>
        <h2 className="text-sm font-semibold text-gray-900">Needs a quick decision</h2>
        <QueueRows items={queue.needsDecision.slice(0, 10)} empty="No uncertain candidates waiting for review." />
      </div>
    </section>
  );
}
