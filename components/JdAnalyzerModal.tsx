"use client";

import { useState } from "react";
import {
  X, Zap, CheckCircle, XCircle, AlertTriangle, BookOpen, Loader2
} from "lucide-react";
import { parseJdAnalysis, type JdAnalysis } from "@/lib/jd-analysis";

interface Props {
  jobId: string;
  jobTitle: string;
  company: string;
  existingJdText?: string | null;
  existingAnalysis?: string | null;
  onClose: () => void;
  onSaved?: (payload: { analysis: JdAnalysis; jdText: string }) => void;
}

const GRADE_CONFIG: Record<string, { bg: string; text: string; border: string }> = {
  A: { bg: "bg-emerald-100", text: "text-emerald-700", border: "border-emerald-300" },
  B: { bg: "bg-blue-100", text: "text-blue-700", border: "border-blue-300" },
  C: { bg: "bg-amber-100", text: "text-amber-700", border: "border-amber-300" },
  D: { bg: "bg-orange-100", text: "text-orange-700", border: "border-orange-300" },
  F: { bg: "bg-red-100", text: "text-red-700", border: "border-red-300" },
};

function GradeBadge({ grade }: { grade: string }) {
  const cfg = GRADE_CONFIG[grade] ?? { bg: "bg-gray-100", text: "text-gray-600", border: "border-gray-300" };
  return (
    <span className={"inline-flex items-center justify-center w-12 h-12 rounded-xl text-2xl font-bold border-2 " + cfg.bg + " " + cfg.text + " " + cfg.border}>
      {grade}
    </span>
  );
}

function Chip({ label, variant }: { label: string; variant: "match" | "gap" | "req" | "flag" | "rec" }) {
  const styles = {
    match: "bg-emerald-50 text-emerald-700 border border-emerald-200",
    gap: "bg-red-50 text-red-700 border border-red-200",
    req: "bg-gray-50 text-gray-700 border border-gray-200",
    flag: "bg-amber-50 text-amber-700 border border-amber-200",
    rec: "bg-indigo-50 text-indigo-700 border border-indigo-200",
  };
  return (
    <span className={"inline-block px-2.5 py-1 rounded-md text-xs font-medium " + styles[variant]}>
      {label}
    </span>
  );
}

export function JdAnalyzerModal({ jobId, jobTitle, company, existingJdText, existingAnalysis, onClose, onSaved }: Props) {
  const [jdText, setJdText] = useState(existingJdText ?? "");
  const [analysis, setAnalysis] = useState<JdAnalysis | null>(() => parseJdAnalysis(existingAnalysis));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function analyze() {
    if (!jdText.trim()) { setError("Paste the job description first."); return; }
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/jobs/" + jobId + "/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jdText }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        setError(data.error ?? "Analysis failed");
        return;
      }
      setAnalysis(data.analysis as JdAnalysis);
      onSaved?.({ analysis: data.analysis as JdAnalysis, jdText });
    } catch {
      setError("Network error — is the server running?");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 shrink-0">
          <div className="flex items-center gap-2">
            <Zap size={16} className="text-indigo-500" />
            <span className="font-semibold text-gray-900 text-sm">Check a job</span>
            <span className="text-gray-400 text-sm">— {company}: {jobTitle}</span>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors">
            <X size={16} className="text-gray-500" />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 p-5 space-y-5">
          {/* JD Input */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">
              Job Description
            </label>
            <textarea
              value={jdText}
              onChange={(e) => setJdText(e.target.value)}
              placeholder="Paste the full job description here..."
              rows={analysis ? 4 : 10}
              className="w-full px-3 py-2.5 text-sm rounded-lg border border-gray-200 bg-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400 transition-colors resize-none font-mono"
            />
          </div>

          {error && (
            <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              <AlertTriangle size={14} className="shrink-0" />
              {error}
            </div>
          )}

          {/* Results */}
          {analysis && (
            <div className="space-y-4">
              {/* Grade + fitNote */}
              <div className="flex items-start gap-4 p-4 bg-gray-50 rounded-xl border border-gray-200">
                <GradeBadge grade={analysis.grade} />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-gray-900 mb-1">{analysis.fitNote}</div>
                  <div className="flex flex-wrap gap-3 text-xs text-gray-500">
                    {analysis.salary !== "Not specified" && (
                      <span>💰 {analysis.salary}</span>
                    )}
                    <span>📍 {analysis.location}</span>
                  </div>
                </div>
              </div>

              {/* Key Requirements */}
              {analysis.keyReqs?.length > 0 && (
                <div>
                  <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Key Requirements</div>
                  <div className="flex flex-wrap gap-1.5">
                    {analysis.keyReqs.map((r, i) => <Chip key={i} label={r} variant="req" />)}
                  </div>
                </div>
              )}

              {/* Matched + Gaps side by side */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-700 mb-2">
                    <CheckCircle size={12} />
                    You have ({analysis.matched?.length ?? 0})
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {(analysis.matched ?? []).map((m, i) => <Chip key={i} label={m} variant="match" />)}
                    {(!analysis.matched || analysis.matched.length === 0) && (
                      <span className="text-xs text-gray-400">None identified</span>
                    )}
                  </div>
                </div>
                <div>
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-red-700 mb-2">
                    <XCircle size={12} />
                    Gaps ({analysis.gaps?.length ?? 0})
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {(analysis.gaps ?? []).map((g, i) => <Chip key={i} label={g} variant="gap" />)}
                    {(!analysis.gaps || analysis.gaps.length === 0) && (
                      <span className="text-xs text-emerald-600">No gaps — strong match!</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Practice Recs */}
              {analysis.practiceRecs?.length > 0 && (
                <div>
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-indigo-700 mb-2">
                    <BookOpen size={12} />
                    Study to close gaps
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {analysis.practiceRecs.map((r, i) => <Chip key={i} label={r} variant="rec" />)}
                  </div>
                </div>
              )}

              <div>
                <div className="flex items-center gap-1.5 text-xs font-semibold text-sky-700 mb-2">
                  <CheckCircle size={12} />
                  ATS Keyword Match
                </div>
                {analysis.atsCheck.total > 0 ? (
                  <div className="space-y-3 rounded-xl border border-sky-100 bg-sky-50/60 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="text-sm font-medium text-gray-900">
                          Your CV contains {analysis.atsCheck.present.length} of {analysis.atsCheck.total} required keywords
                        </div>
                        <div className="text-xs text-gray-500 mt-1">
                          Match score: {analysis.atsCheck.score}%
                        </div>
                      </div>
                      <div className="text-2xl font-semibold text-sky-700">
                        {analysis.atsCheck.score}%
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <div className="text-[11px] font-semibold uppercase tracking-wider text-emerald-700 mb-2">
                          Present
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {analysis.atsCheck.present.map((keyword, index) => (
                            <Chip key={keyword + index} label={keyword} variant="match" />
                          ))}
                        </div>
                      </div>
                      <div>
                        <div className="text-[11px] font-semibold uppercase tracking-wider text-red-700 mb-2">
                          Missing
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {analysis.atsCheck.missing.map((keyword, index) => (
                            <Chip key={keyword + index} label={keyword} variant="gap" />
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-500">
                    ATS keyword coverage is not available for this analysis yet.
                  </div>
                )}
              </div>

              {/* Red Flags */}
              {analysis.redFlags?.length > 0 && (
                <div>
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-700 mb-2">
                    <AlertTriangle size={12} />
                    Red Flags
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {analysis.redFlags.map((f, i) => <Chip key={i} label={f} variant="flag" />)}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="shrink-0 px-5 py-4 border-t border-gray-100 flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
            Close
          </button>
          <button
            onClick={analyze}
            disabled={loading || !jdText.trim()}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
          >
            {loading ? <Loader2 size={14} className="animate-spin" /> : <Zap size={14} />}
            {loading ? "Analyzing..." : analysis ? "Re-analyze" : "Check a job"}
          </button>
        </div>
      </div>
    </div>
  );
}
