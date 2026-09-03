import { db } from "@/lib/db";
import { CoverLetterBuilder } from "@/components/CoverLetterBuilder";

export const dynamic = "force-dynamic";

export default async function CoverLetterPage({
  searchParams,
}: {
  searchParams: Promise<{ jobId?: string }>;
}) {
  const { jobId } = await searchParams;
  const jobs = await db.job.findMany({
    orderBy: [{ company: "asc" }, { title: "asc" }],
    select: {
      id: true,
      title: true,
      company: true,
    },
  });

  const initialJobId = jobs.some((job) => job.id === jobId) ? jobId ?? null : null;

  return (
    <div className="min-w-0 flex-1 overflow-y-auto bg-[#0b1020] p-6 text-white">
      <div className="mb-8 max-w-3xl">
        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.24em] text-cyan-300/80">
          Application Writing
        </p>
        <h1 className="text-3xl font-semibold tracking-tight">Cover Letter</h1>
        <p className="mt-3 text-sm leading-6 text-slate-300">
          Generate a tailored letter from your tracked job, your default resume, and the job context already stored in Apto.
        </p>
      </div>

      <CoverLetterBuilder jobs={jobs} initialJobId={initialJobId} />
    </div>
  );
}
