import type { JobStatus, SourceType } from "./constants";

type SearchParamsLike = {
  get(name: string): string | null;
};

export type ImportedJobDraft = {
  title: string;
  company: string;
  url: string | null;
  status: JobStatus;
  sourceType: SourceType;
};

export function createImportedJobDraftFromParams(
  searchParams: SearchParamsLike
): ImportedJobDraft | null {
  if (searchParams.get("import") !== "1") return null;

  const title = searchParams.get("title")?.trim() ?? "";
  const company = searchParams.get("company")?.trim() ?? "";
  const url = searchParams.get("url")?.trim() ?? "";

  if (!title && !company) return null;

  return {
    title,
    company,
    url: url || null,
    status: "BACKLOG",
    sourceType: "linkedin",
  };
}
