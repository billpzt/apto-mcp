import { db } from "@/lib/db";
import { serializeDate } from "@/lib/date";
import { serializeJob } from "@/lib/serialize";
import { buildDashboard } from "@/lib/dashboard";
import { buildDailyApplicationQueue } from "@/lib/daily-search";
import { DashboardSummary } from "@/components/dashboard/DashboardSummary";
import { TodayActions } from "@/components/dashboard/TodayActions";
import { HotPipeline } from "@/components/dashboard/HotPipeline";
import { StaleOpportunities } from "@/components/dashboard/StaleOpportunities";
import { PrepQueue } from "@/components/dashboard/PrepQueue";
import { IncomeContextPanel } from "@/components/dashboard/IncomeContextPanel";
import { DailyApplicationProgress } from "@/components/dashboard/DailyApplicationProgress";
import { ApplicationQueue } from "@/components/dashboard/ApplicationQueue";
import { AssistantBridge } from "@/components/dashboard/AssistantBridge";

export const dynamic = "force-dynamic";

function timeAgo(iso: string): string {
  const hours = Math.floor((Date.now() - new Date(iso).getTime()) / 36e5);
  if (hours < 1) return "less than an hour ago";
  if (hours < 24) return hours + (hours === 1 ? " hour ago" : " hours ago");
  const days = Math.floor(hours / 24);
  return days + (days === 1 ? " day ago" : " days ago");
}

export default async function DashboardPage() {
  const [jobs, actions, directoryItems, lastSyncConfig] = await Promise.all([
    db.job.findMany({
      orderBy: { createdAt: "desc" },
      include: { sourceContact: true },
    }),
    db.actionItem.findMany({
      orderBy: [{ status: "asc" }, { dueDate: "asc" }],
      include: {
        job: { select: { id: true, company: true, title: true, status: true, score: true, priority: true } },
        contact: { select: { id: true, name: true, company: true } },
      },
    }),
    db.directoryItem.findMany({ orderBy: { name: "asc" } }),
    db.appConfig.findUnique({ where: { key: "last_workspace_sync" } }),
  ]);

  const serializedJobs = jobs.map(serializeJob);

  const serializedActions = actions.map((a) => ({
    id: a.id,
    title: a.title,
    kind: a.kind,
    status: a.status,
    dueDate: serializeDate(a.dueDate),
    completedAt: serializeDate(a.completedAt),
    jobId: a.jobId,
    contactId: a.contactId,
    notes: a.notes,
    job: a.job,
    contact: a.contact
      ? { id: a.contact.id, name: a.contact.name, company: a.contact.company }
      : null,
    createdAt: a.createdAt.toISOString(),
    updatedAt: a.updatedAt.toISOString(),
  }));

  const serializedDir = directoryItems.map((d) => ({
    id: d.id,
    name: d.name,
    url: d.url,
    category: d.category,
    status: d.status,
    checkFrequencyDays: d.checkFrequencyDays,
    lastCheckedAt: serializeDate(d.lastCheckedAt),
    nextAction: d.nextAction,
    notes: d.notes,
    createdAt: d.createdAt.toISOString(),
    updatedAt: d.updatedAt.toISOString(),
  }));

  const dashboard = buildDashboard({ jobs: serializedJobs, actions: serializedActions, directoryItems: serializedDir });
  const dailyQueue = buildDailyApplicationQueue(serializedJobs);

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-gray-900">Career Command Center</h1>
        {lastSyncConfig && (
          <p className="text-xs text-gray-400 mt-1">
            Workspace last synced: {timeAgo(lastSyncConfig.value)}
          </p>
        )}
      </div>
      <DailyApplicationProgress queue={dailyQueue} />
      <ApplicationQueue queue={dailyQueue} />
      <AssistantBridge />
      <DashboardSummary summary={dashboard.summary} />

      <section>
        <h2 className="text-sm font-semibold text-gray-800 mb-3">Today&apos;s Actions</h2>
        <TodayActions actions={dashboard.todayActions} />
      </section>

      <section>
        <h2 className="text-sm font-semibold text-gray-800 mb-3">Hot Pipeline</h2>
        <HotPipeline jobs={dashboard.hotPipeline} />
      </section>

      <section>
        <h2 className="text-sm font-semibold text-gray-800 mb-3">Stale Opportunities</h2>
        <StaleOpportunities jobs={dashboard.staleOpportunities} />
      </section>

      <section>
        <h2 className="text-sm font-semibold text-gray-800 mb-3">Prep Queue</h2>
        <PrepQueue actions={dashboard.prepQueue} />
      </section>

      <section>
        <h2 className="text-sm font-semibold text-gray-800 mb-3">Income Context</h2>
        <IncomeContextPanel />
      </section>

      {dashboard.directoryDue.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-gray-800 mb-3">Directory Due</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {dashboard.directoryDue.map((item) => (
              <div key={item.id} className="bg-white rounded-xl border border-gray-200 p-4 text-sm text-gray-700">
                <div className="font-medium text-gray-900">{item.name}</div>
                <div className="text-xs text-gray-500 mt-0.5 capitalize">{item.category.replace(/_/g, " ")}</div>
                {item.nextAction && <p className="text-xs text-gray-600 mt-2">{item.nextAction}</p>}
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
