import type { InsightFrequency, InsightsSummary } from "@/lib/jd-analysis";

const BAND_CONFIG: Array<{
  key: keyof InsightsSummary["bands"];
  label: string;
  tone: string;
  bg: string;
}> = [
  { key: "strongFit", label: "Strong fit", tone: "text-emerald-700", bg: "bg-emerald-500" },
  { key: "reachable", label: "Reachable", tone: "text-blue-700", bg: "bg-blue-500" },
  { key: "growth", label: "Growth", tone: "text-amber-700", bg: "bg-amber-500" },
  { key: "aspirational", label: "Aspirational", tone: "text-rose-700", bg: "bg-rose-500" },
];

function PercentBar({
  label,
  count,
  total,
  tone,
  bg,
}: {
  label: string;
  count: number;
  total: number;
  tone: string;
  bg: string;
}) {
  const percent = total > 0 ? Math.round((count / total) * 100) : 0;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3 text-sm">
        <span className={tone}>{label}</span>
        <span className="text-gray-500">{count} jobs, {percent}%</span>
      </div>
      <div className="h-2.5 rounded-full bg-gray-100 overflow-hidden">
        <div className={`h-full rounded-full ${bg}`} style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}

function FrequencyList({
  title,
  items,
  emptyText,
  barTone,
}: {
  title: string;
  items: InsightFrequency[];
  emptyText: string;
  barTone: string;
}) {
  const max = items[0]?.count ?? 0;

  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
      <h2 className="text-base font-semibold text-gray-900">{title}</h2>
      {items.length === 0 ? (
        <p className="mt-4 text-sm text-gray-500">{emptyText}</p>
      ) : (
        <div className="mt-5 space-y-4">
          {items.map((item) => {
            const width = max > 0 ? (item.count / max) * 100 : 0;
            return (
              <div key={item.label} className="space-y-1.5">
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span className="text-gray-700">{item.label}</span>
                  <span className="text-gray-500">{item.count}</span>
                </div>
                <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
                  <div className={`h-full rounded-full ${barTone}`} style={{ width: `${width}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

export function InsightsOverview({ summary }: { summary: InsightsSummary }) {
  return (
    <div className="max-w-6xl mx-auto px-6 py-8 space-y-6">
      <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">Insights</h1>
            <p className="mt-1 text-sm text-gray-500">
              A positioning snapshot from saved JD analysis across your pipeline.
            </p>
          </div>
          <div className="rounded-xl bg-slate-50 px-4 py-3 text-right">
            <div className="text-xs uppercase tracking-wider text-gray-400">Analyzed jobs</div>
            <div className="text-2xl font-semibold text-gray-900">{summary.totalAnalyzedJobs}</div>
          </div>
        </div>

        {summary.totalAnalyzedJobs === 0 ? (
          <div className="mt-6 rounded-xl border border-dashed border-gray-200 bg-gray-50 px-4 py-8 text-center text-sm text-gray-500">
            Analyze a few jobs first. Insights will populate from persisted JD analysis data.
          </div>
        ) : (
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            {BAND_CONFIG.map((band) => (
              <div key={band.key} className="rounded-xl border border-gray-100 bg-slate-50 p-4">
                <PercentBar
                  label={band.label}
                  count={summary.bands[band.key]}
                  total={summary.totalAnalyzedJobs}
                  tone={band.tone}
                  bg={band.bg}
                />
              </div>
            ))}
          </div>
        )}
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <FrequencyList
          title="Your strengths"
          items={summary.strengths}
          emptyText="No matched-skill data yet."
          barTone="bg-emerald-500"
        />
        <FrequencyList
          title="Top skill gaps"
          items={summary.gaps}
          emptyText="No gap data yet."
          barTone="bg-red-500"
        />
      </div>
    </div>
  );
}
