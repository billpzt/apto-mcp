import type { SerializedJob } from "@/lib/types";
import { JobSignalCard } from "./JobSignalCard";

export function HotPipeline({ jobs }: { jobs: SerializedJob[] }) {
  if (jobs.length === 0) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-gray-900 mb-3">Hot Pipeline</h2>
        <p className="text-sm text-gray-400">No hot opportunities yet.</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      <h2 className="text-sm font-semibold text-gray-900 mb-3">Hot Pipeline</h2>
      <div className="space-y-2">
        {jobs.map((job) => (
          <JobSignalCard key={job.id} job={job} />
        ))}
      </div>
    </div>
  );
}
