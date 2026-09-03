import { db } from "@/lib/db";
import { parseJdAnalysis, summarizeInsights, type JdAnalysis } from "@/lib/jd-analysis";
import { InsightsOverview } from "@/components/InsightsOverview";

export const dynamic = "force-dynamic";

export default async function InsightsPage() {
  const jobs = await db.job.findMany({
    where: { jdAnalysis: { not: null } },
    select: { jdAnalysis: true },
  });

  const analyses = jobs
    .map((job) => parseJdAnalysis(job.jdAnalysis))
    .filter((analysis): analysis is JdAnalysis => analysis !== null);

  return <InsightsOverview summary={summarizeInsights(analyses)} />;
}
