"use client";

import { useMemo, useState } from "react";
import { Copy, RefreshCw, Sparkles } from "lucide-react";
import { countWords } from "@/lib/cover-letter";

type JobOption = {
  id: string;
  title: string;
  company: string;
};

type Props = {
  jobs: JobOption[];
  initialJobId: string | null;
};

type FormState = {
  jobId: string;
  tone: "professional" | "conversational" | "enthusiastic" | "formal";
  length: "brief" | "standard" | "detailed";
  language: "english" | "portuguese" | "auto";
  emphasis: string;
  avoid: string;
  writingSample: string;
};

function createInitialForm(jobId: string | null): FormState {
  return {
    jobId: jobId ?? "",
    tone: "professional",
    length: "standard",
    language: "english",
    emphasis: "",
    avoid: "",
    writingSample: "",
  };
}

export function CoverLetterBuilder({ jobs, initialJobId }: Props) {
  const [form, setForm] = useState<FormState>(() => createInitialForm(initialJobId));
  const [letter, setLetter] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const wordCount = useMemo(() => countWords(letter), [letter]);

  async function generate() {
    setLoading(true);
    setError("");
    setCopied(false);

    try {
      const res = await fetch("/api/cover-letter/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = (await res.json()) as { letter?: string; error?: string };
      if (!res.ok || !data.letter) {
        throw new Error(data.error || "Could not generate cover letter");
      }
      setLetter(data.letter);
    } catch (generationError) {
      setError(
        generationError instanceof Error
          ? generationError.message
          : "Could not generate cover letter"
      );
    } finally {
      setLoading(false);
    }
  }

  async function copyLetter() {
    if (!letter) return;

    try {
      await navigator.clipboard.writeText(letter);
      setCopied(true);
      setError("");
    } catch {
      setError("Could not copy the generated letter.");
    }
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(22rem,28rem)_1fr]">
      <section className="rounded-[1.75rem] border border-white/10 bg-white/6 p-5 shadow-[0_24px_60px_rgba(6,10,24,0.45)] backdrop-blur">
        <div className="mb-5 flex items-center gap-2 text-sm font-medium text-slate-100">
          <Sparkles size={16} className="text-cyan-300" />
          Letter settings
        </div>

        <div className="space-y-4">
          <label className="block text-sm text-slate-200">
            <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
              Job
            </span>
            <select
              value={form.jobId}
              onChange={(e) =>
                setForm((current) => ({ ...current, jobId: e.target.value }))
              }
              className="w-full rounded-2xl border border-white/10 bg-slate-950/80 px-3 py-3 text-sm text-white outline-none transition focus:border-cyan-400/40"
            >
              <option value="">Select a job</option>
              {jobs.map((job) => (
                <option key={job.id} value={job.id}>
                  {job.company} - {job.title}
                </option>
              ))}
            </select>
          </label>

          <div className="grid gap-4 md:grid-cols-3">
            <label className="block text-sm text-slate-200">
              <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                Tone
              </span>
              <select
                value={form.tone}
                onChange={(e) =>
                  setForm((current) => ({
                    ...current,
                    tone: e.target.value as FormState["tone"],
                  }))
                }
                className="w-full rounded-2xl border border-white/10 bg-slate-950/80 px-3 py-3 text-sm text-white outline-none transition focus:border-cyan-400/40"
              >
                <option value="professional">Professional</option>
                <option value="conversational">Conversational</option>
                <option value="enthusiastic">Enthusiastic</option>
                <option value="formal">Formal</option>
              </select>
            </label>

            <label className="block text-sm text-slate-200">
              <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                Length
              </span>
              <select
                value={form.length}
                onChange={(e) =>
                  setForm((current) => ({
                    ...current,
                    length: e.target.value as FormState["length"],
                  }))
                }
                className="w-full rounded-2xl border border-white/10 bg-slate-950/80 px-3 py-3 text-sm text-white outline-none transition focus:border-cyan-400/40"
              >
                <option value="brief">Brief</option>
                <option value="standard">Standard</option>
                <option value="detailed">Detailed</option>
              </select>
            </label>

            <label className="block text-sm text-slate-200">
              <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                Language
              </span>
              <select
                value={form.language}
                onChange={(e) =>
                  setForm((current) => ({
                    ...current,
                    language: e.target.value as FormState["language"],
                  }))
                }
                className="w-full rounded-2xl border border-white/10 bg-slate-950/80 px-3 py-3 text-sm text-white outline-none transition focus:border-cyan-400/40"
              >
                <option value="english">English</option>
                <option value="portuguese">Portuguese</option>
                <option value="auto">Auto</option>
              </select>
            </label>
          </div>

          <label className="block text-sm text-slate-200">
            <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
              Emphasis
            </span>
            <input
              value={form.emphasis}
              onChange={(e) =>
                setForm((current) => ({ ...current, emphasis: e.target.value }))
              }
              placeholder="What to highlight"
              className="w-full rounded-2xl border border-white/10 bg-slate-950/80 px-3 py-3 text-sm text-white outline-none transition focus:border-cyan-400/40"
            />
          </label>

          <label className="block text-sm text-slate-200">
            <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
              Avoid
            </span>
            <input
              value={form.avoid}
              onChange={(e) =>
                setForm((current) => ({ ...current, avoid: e.target.value }))
              }
              placeholder="What to downplay or exclude"
              className="w-full rounded-2xl border border-white/10 bg-slate-950/80 px-3 py-3 text-sm text-white outline-none transition focus:border-cyan-400/40"
            />
          </label>

          <label className="block text-sm text-slate-200">
            <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
              Writing sample
            </span>
            <textarea
              value={form.writingSample}
              onChange={(e) =>
                setForm((current) => ({
                  ...current,
                  writingSample: e.target.value,
                }))
              }
              placeholder="Optional writing sample"
              rows={8}
              className="w-full rounded-2xl border border-white/10 bg-slate-950/80 px-3 py-3 text-sm text-white outline-none transition focus:border-cyan-400/40"
            />
          </label>

          <button
            onClick={generate}
            disabled={!form.jobId || loading}
            className="inline-flex w-full items-center justify-center rounded-2xl bg-cyan-400 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
          >
            {loading ? "Generating..." : "Generate cover letter"}
          </button>
        </div>
      </section>

      <section className="rounded-[1.75rem] border border-cyan-400/15 bg-[radial-gradient(circle_at_top,_rgba(56,189,248,0.14),_transparent_42%),linear-gradient(180deg,rgba(15,23,42,0.88),rgba(2,6,23,0.96))] p-6 shadow-[0_28px_70px_rgba(2,6,23,0.6)]">
        <div className="mb-5 flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-300/80">
              Preview
            </p>
            <h2 className="mt-1 text-xl font-semibold text-white">
              {letter ? "Generated draft" : "Ready when you are"}
            </h2>
            <p className="mt-2 text-sm text-slate-300">
              {letter
                ? `${wordCount} words`
                : "Your generated letter will appear here after the first run."}
            </p>
          </div>

          {letter ? (
            <div className="flex flex-wrap gap-2">
              <button
                onClick={copyLetter}
                className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-100 transition hover:bg-white/10"
              >
                <Copy size={14} />
                {copied ? "Copied" : "Copy"}
              </button>
              <button
                onClick={generate}
                disabled={loading}
                className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-100 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <RefreshCw size={14} />
                Regenerate
              </button>
            </div>
          ) : null}
        </div>

        {error ? (
          <div className="mb-4 rounded-2xl border border-rose-400/35 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
            {error}
          </div>
        ) : null}

        {letter ? (
          <div className="rounded-[1.5rem] border border-white/10 bg-slate-950/55 p-6 text-sm leading-7 text-slate-100 whitespace-pre-wrap">
            {letter}
          </div>
        ) : (
          <div className="rounded-[1.5rem] border border-dashed border-white/10 bg-white/[0.03] px-6 py-20 text-center text-sm leading-6 text-slate-400">
            Select a job, set the tone you want, and generate a tailored draft.
          </div>
        )}
      </section>
    </div>
  );
}
