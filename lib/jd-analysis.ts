export type AtsCheck = {
  present: string[];
  missing: string[];
  score: number;
  total: number;
};

export type JdAnalysis = {
  grade: string;
  fitNote: string;
  salary: string;
  location: string;
  matched: string[];
  gaps: string[];
  keyReqs: string[];
  redFlags: string[];
  practiceRecs: string[];
  atsCheck: AtsCheck;
};

export type InsightsBand = "strongFit" | "reachable" | "growth" | "aspirational";

export type InsightFrequency = {
  label: string;
  count: number;
};

export type InsightsSummary = {
  totalAnalyzedJobs: number;
  bands: Record<InsightsBand, number>;
  strengths: InsightFrequency[];
  gaps: InsightFrequency[];
};

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function normalizeItems(items: string[] | undefined): string[] {
  if (!items) return [];
  return items.map((item) => item.trim()).filter(Boolean);
}

function normalizeKeyword(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

function buildFrequency(items: string[][], limit = 10): InsightFrequency[] {
  const counts = new Map<string, { label: string; count: number }>();

  for (const group of items) {
    const seen = new Set<string>();
    for (const item of group) {
      const normalized = normalizeKeyword(item);
      if (!normalized || seen.has(normalized)) continue;
      seen.add(normalized);

      const existing = counts.get(normalized);
      if (existing) {
        existing.count += 1;
      } else {
        counts.set(normalized, { label: item.trim(), count: 1 });
      }
    }
  }

  return [...counts.values()]
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
    .slice(0, limit);
}

export function parseJdAnalysis(raw: string | null | undefined): JdAnalysis | null {
  if (!raw) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }

  if (!parsed || typeof parsed !== "object") return null;
  const value = parsed as Record<string, unknown>;

  if (
    typeof value.grade !== "string" ||
    typeof value.fitNote !== "string" ||
    typeof value.salary !== "string" ||
    typeof value.location !== "string" ||
    !isStringArray(value.matched) ||
    !isStringArray(value.gaps) ||
    !isStringArray(value.keyReqs) ||
    !isStringArray(value.redFlags) ||
    !isStringArray(value.practiceRecs)
  ) {
    return null;
  }

  const rawAtsCheck = value.atsCheck;
  const atsCheck =
    rawAtsCheck &&
    typeof rawAtsCheck === "object" &&
    isStringArray((rawAtsCheck as Record<string, unknown>).present) &&
    isStringArray((rawAtsCheck as Record<string, unknown>).missing) &&
    typeof (rawAtsCheck as Record<string, unknown>).score === "number" &&
    typeof (rawAtsCheck as Record<string, unknown>).total === "number"
      ? {
          present: normalizeItems((rawAtsCheck as Record<string, string[]>).present),
          missing: normalizeItems((rawAtsCheck as Record<string, string[]>).missing),
          score: (rawAtsCheck as Record<string, number>).score,
          total: (rawAtsCheck as Record<string, number>).total,
        }
      : { present: [], missing: [], score: 0, total: 0 };

  return {
    grade: value.grade.toUpperCase(),
    fitNote: value.fitNote,
    salary: value.salary,
    location: value.location,
    matched: normalizeItems(value.matched),
    gaps: normalizeItems(value.gaps),
    keyReqs: normalizeItems(value.keyReqs),
    redFlags: normalizeItems(value.redFlags),
    practiceRecs: normalizeItems(value.practiceRecs),
    atsCheck,
  };
}

export function computeAtsCheck(keyReqs: string[], resumeText: string): AtsCheck {
  const normalizedResume = resumeText.toLowerCase();
  const uniqueKeywords = normalizeItems(keyReqs).filter((value, index, items) => {
    const normalized = normalizeKeyword(value);
    return items.findIndex((item) => normalizeKeyword(item) === normalized) === index;
  });

  if (uniqueKeywords.length === 0) {
    return { present: [], missing: [], score: 0, total: 0 };
  }

  const present: string[] = [];
  const missing: string[] = [];

  for (const keyword of uniqueKeywords) {
    if (normalizedResume.includes(normalizeKeyword(keyword))) {
      present.push(keyword);
    } else {
      missing.push(keyword);
    }
  }

  const score = Math.round((present.length / uniqueKeywords.length) * 100);
  return { present, missing, score, total: uniqueKeywords.length };
}

export function getInsightBand(grade: string): InsightsBand {
  switch (grade.toUpperCase()) {
    case "A":
      return "strongFit";
    case "B":
      return "reachable";
    case "C":
      return "growth";
    default:
      return "aspirational";
  }
}

export function summarizeInsights(analyses: JdAnalysis[]): InsightsSummary {
  const bands: Record<InsightsBand, number> = {
    strongFit: 0,
    reachable: 0,
    growth: 0,
    aspirational: 0,
  };

  for (const analysis of analyses) {
    bands[getInsightBand(analysis.grade)] += 1;
  }

  return {
    totalAnalyzedJobs: analyses.length,
    bands,
    strengths: buildFrequency(analyses.map((analysis) => analysis.matched)),
    gaps: buildFrequency(analyses.map((analysis) => analysis.gaps)),
  };
}
