import { Suspense } from "react";
import { db } from "@/lib/db";
import { JOB_STATUSES, type JobStatus } from "@/lib/constants";
import { serializeJob } from "@/lib/serialize";
import { FunnelHeader } from "@/components/FunnelHeader";
import { KanbanBoard } from "@/components/KanbanBoard";

export const dynamic = "force-dynamic";

export default async function JobsPage() {
  const jobs = await db.job.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      sourceContact: true,
      updates: { orderBy: { occurredAt: "desc" }, take: 1 },
    },
  });

  const serialized = jobs.map(serializeJob);
  const counts = JOB_STATUSES.reduce<Record<JobStatus, number>>((acc, status) => {
    acc[status] = jobs.filter((job) => job.status === status).length;
    return acc;
  }, {} as Record<JobStatus, number>);

  return (
    <Suspense>
      <div className="h-screen min-w-0 overflow-hidden">
        <FunnelHeader counts={counts} />
        <KanbanBoard initialJobs={serialized} />
      </div>
    </Suspense>
  );
}
