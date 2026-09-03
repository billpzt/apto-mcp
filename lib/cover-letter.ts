import { parseJdAnalysis } from "./jd-analysis";

export type CoverLetterTone = "professional" | "conversational" | "enthusiastic" | "formal";
export type CoverLetterLength = "brief" | "standard" | "detailed";
export type CoverLetterLanguage = "english" | "portuguese" | "auto";

export type CoverLetterRequestInput = {
  jobId: string;
  tone: CoverLetterTone;
  length: CoverLetterLength;
  language: CoverLetterLanguage;
  emphasis: string;
  avoid: string;
  writingSample: string;
};

export type CoverLetterJobContext = {
  id: string;
  title: string;
  company: string;
  location: string | null;
  salary: string | null;
  jobType: string | null;
  notes: string | null;
  jdText: string | null;
  jdAnalysis: string | null;
};

const TONES: CoverLetterTone[] = ["professional", "conversational", "enthusiastic", "formal"];
const LENGTHS: CoverLetterLength[] = ["brief", "standard", "detailed"];
const LANGUAGES: CoverLetterLanguage[] = ["english", "portuguese", "auto"];

const DEFAULT_INPUT: Omit<CoverLetterRequestInput, "jobId"> = {
  tone: "professional",
  length: "standard",
  language: "english",
  emphasis: "",
  avoid: "",
  writingSample: "",
};

function isCoverLetterTone(value: unknown): value is CoverLetterTone {
  return value === "professional" || value === "conversational" || value === "enthusiastic" || value === "formal";
}

function isCoverLetterLength(value: unknown): value is CoverLetterLength {
  return value === "brief" || value === "standard" || value === "detailed";
}

function isCoverLetterLanguage(value: unknown): value is CoverLetterLanguage {
  return value === "english" || value === "portuguese" || value === "auto";
}

export function normalizeCoverLetterInput(
  input: Partial<CoverLetterRequestInput>
): CoverLetterRequestInput {
  return {
    jobId: String(input.jobId ?? "").trim(),
    tone: isCoverLetterTone(input.tone) ? input.tone : DEFAULT_INPUT.tone,
    length: isCoverLetterLength(input.length) ? input.length : DEFAULT_INPUT.length,
    language: isCoverLetterLanguage(input.language) ? input.language : DEFAULT_INPUT.language,
    emphasis: String(input.emphasis ?? "").trim(),
    avoid: String(input.avoid ?? "").trim(),
    writingSample: String(input.writingSample ?? "").trim(),
  };
}

export function validateCoverLetterInput(input: CoverLetterRequestInput): CoverLetterRequestInput {
  if (!input.jobId) throw new Error("jobId is required");
  if (!TONES.includes(input.tone)) throw new Error("Invalid tone");
  if (!LENGTHS.includes(input.length)) throw new Error("Invalid length");
  if (!LANGUAGES.includes(input.language)) throw new Error("Invalid language");
  return input;
}

function getLengthInstruction(length: CoverLetterLength): string {
  if (length === "brief") return "Keep it to one compact paragraph.";
  if (length === "detailed") return "Write a fuller letter of about five paragraphs.";
  return "Write a standard letter of about three paragraphs.";
}

export function buildCoverLetterPrompts(args: {
  input: CoverLetterRequestInput;
  job: CoverLetterJobContext;
  resumeContent: string;
}): { systemPrompt: string; userPrompt: string } {
  const { input, job, resumeContent } = args;
  const parsedAnalysis = job.jdAnalysis ? parseJdAnalysis(job.jdAnalysis) : null;
  const candidateName = process.env.NEXT_PUBLIC_OWNER_NAME?.trim() || "the candidate";

  const systemPrompt = [
    `You are a professional cover letter writer for ${candidateName}.`,
    "Write a truthful cover letter grounded only in the candidate's real experience.",
    "Do not invent experience, tools, achievements, metrics, or certifications.",
    `Tone: ${input.tone}.`,
    `Language: ${input.language}.`,
    getLengthInstruction(input.length),
  ].join("\n");

  const userSections = [
    `Candidate: ${candidateName}`,
    `Target role: ${job.title} at ${job.company}`,
    `Location: ${job.location ?? "Not specified"}`,
    `Compensation: ${job.salary ?? "Not specified"}`,
    `Job type: ${job.jobType ?? "Not specified"}`,
    job.notes ? `Job notes: ${job.notes}` : "",
    job.jdText
      ? `JD text:\n${job.jdText}`
      : "JD text is not available. Use the job metadata and analysis that follow.",
    parsedAnalysis ? `Parsed JD analysis:\n${JSON.stringify(parsedAnalysis, null, 2)}` : "",
    `Resume:\n${resumeContent}`,
    input.emphasis ? `Emphasis: ${input.emphasis}` : "",
    input.avoid ? `Avoid: ${input.avoid}` : "",
    input.writingSample ? `Writing sample:\n${input.writingSample}` : "",
    "Return only the cover letter body as plain text.",
  ].filter(Boolean);

  return {
    systemPrompt,
    userPrompt: userSections.join("\n\n"),
  };
}

export function countWords(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).length;
}
