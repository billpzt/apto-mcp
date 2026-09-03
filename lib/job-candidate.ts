import { PRIORITIES, SOURCE_TYPES, type SourceType } from "./constants";
import { optionalString, requireString, validateChoice } from "./validation";
import {
  ELIGIBILITY_VALUES,
  type AssistantJobCandidateInput,
  type EligibilityValue,
  type NormalizedAssistantCandidate,
} from "./assistant-contracts";

const TRACKING_PARAMS = new Set(["ref", "source", "trk", "trackingId"]);

export function normalizeJobUrl(value: unknown): string | null {
  const raw = optionalString(value);
  if (!raw) return null;
  const parsed = new URL(raw);
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("url must use http or https");
  }
  parsed.hash = "";
  for (const key of [...parsed.searchParams.keys()]) {
    if (key.toLowerCase().startsWith("utm_") || TRACKING_PARAMS.has(key)) {
      parsed.searchParams.delete(key);
    }
  }
  parsed.hostname = parsed.hostname.toLowerCase();
  parsed.pathname = parsed.pathname.replace(/\/+$/, "") || "/";
  return parsed.toString().replace(/\?$/, "").replace(/\/$/, parsed.pathname === "/" ? "/" : "");
}

function parseDate(value: unknown, field: string): Date | null {
  if (value === undefined || value === null || value === "") return null;
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) throw new Error(`${field} must be a valid ISO date`);
  return date;
}

export function candidateFingerprint(company: string, title: string): string {
  // Trim each field before joining so trailing whitespace cannot place a space next to "::".
  return `${company.trim()}::${title.trim()}`.toLowerCase().trim().replace(/\s+/g, " ");
}

export function normalizeCandidate(
  input: AssistantJobCandidateInput,
  now = new Date()
): NormalizedAssistantCandidate {
  const title = requireString(input.title, "title");
  const company = requireString(input.company, "company");
  const url = normalizeJobUrl(input.url);
  const canonicalUrl = normalizeJobUrl(input.canonicalUrl) ?? url;
  const sourceType = input.sourceType
    ? validateChoice(input.sourceType, SOURCE_TYPES, "sourceType") as SourceType
    : null;
  const eligibility = input.eligibleFromBrazil
    ? validateChoice(input.eligibleFromBrazil, ELIGIBILITY_VALUES, "eligibleFromBrazil") as EligibilityValue
    : "uncertain";
  const priority = input.priority
    ? validateChoice(input.priority, PRIORITIES, "priority")
    : null;
  const score = optionalString(input.score)?.toUpperCase() ?? null;
  if (score && !["A", "B", "C", "D", "F"].includes(score)) {
    throw new Error("score must be one of: A, B, C, D, F");
  }
  return {
    title,
    company,
    url,
    canonicalUrl,
    sourceType,
    location: optionalString(input.location),
    salary: optionalString(input.salary),
    jobType: optionalString(input.jobType),
    notes: optionalString(input.notes),
    jdText: optionalString(input.jdText),
    score,
    priority,
    titleFamily: optionalString(input.titleFamily),
    remoteScope: optionalString(input.remoteScope),
    eligibleFromBrazil: eligibility,
    eligibilityEvidence: optionalString(input.eligibilityEvidence),
    postedAt: parseDate(input.postedAt, "postedAt"),
    lastVerifiedAt: parseDate(input.lastVerifiedAt, "lastVerifiedAt") ?? now,
  };
}
