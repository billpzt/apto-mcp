"use client";

import {
  X, ExternalLink, Pencil, Trash2, Zap,
  MapPin, DollarSign, Calendar, MessageSquare,
  ArrowRight, User,
} from "lucide-react";
import { KANBAN_STATUSES, STATUS_CONFIG, type JobStatus } from "@/lib/constants";
import { parseJdAnalysis } from "@/lib/jd-analysis";
import { safeUrl } from "@/lib/url";

type Job = {
  id: string;
  title: string;
  company: string;
  url: string | null;
  status: string;
  location: string | null;
  salary: string | null;
  jobType: string | null;
  notes: string | null;
  appliedAt: string | null;
  lastContactDate: string | null;
  createdAt: string;
  score: string | null;
  followUpDate: string | null;
  nextAction: string | null;
  priority: string | null;
  sourceType: string | null;
  sourceContactId: string | null;
  sourceNotes: string | null;
  closedReason: string | null;
  jdText: string | null;
  jdAnalysis: string | null;
  resumeSent: string | null;
  sourceContact: {
    id: string;
    name: string;
    title: string | null;
    company: string | null;
  } | null;
};

type Props = {
  job: Job;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onAnalyze: () => void;
  onStatusChange: (status: JobStatus) => void;
};

function fmt(dateStr: string | null | undefined) {
  if (!dateStr) return null;
  return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-5">
      <h3 className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 mb-2">{title}</h3>
      {children}
    </div>
  );
}

function Field({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <div className="mb-2">
      <span className="text-[11px] text-gray-400">{label}</span>
      <p className="text-sm text-gray-800 mt-0.5">{value}</p>
    </div>
  );
}

export function JobDetailDrawer({ job, onClose, onEdit, onDelete, onAnalyze, onStatusChange }: Props) {
  const cfg = STATUS_CONFIG[job.status as JobStatus] ?? STATUS_CONFIG["BACKLOG"];
  const currentIndex = KANBAN_STATUSES.indexOf(job.status as JobStatus);
  const nextStatus = currentIndex >= 0 && currentIndex < KANBAN_STATUSES.length - 1
    ? KANBAN_STATUSES[currentIndex + 1] : null;

  const jdAnalysis = parseJdAnalysis(job.jdAnalysis);

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-30 bg-black/20 backdrop-blur-[1px]"
        onClick={onClose}
      />

      {/* Drawer */}
      <div className="fixed right-0 top-0 bottom-0 z-40 w-[420px] max-w-full bg-white shadow-xl flex flex-col">
        {/* Header */}
        <div className="flex items-start justify-between px-5 py-4 border-b border-gray-100">
          <div className="flex-1 min-w-0 pr-4">
            <div className="text-base font-semibold text-gray-900 leading-tight">{job.company}</div>
            <div className="text-sm text-gray-500 mt-0.5">{job.title}</div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors shrink-0">
            <X size={16} />
          </button>
        </div>

        {/* Action bar */}
        <div className="flex items-center gap-2 px-5 py-3 border-b border-gray-100 bg-gray-50">
          <button
            onClick={onEdit}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:border-gray-300 transition-colors"
          >
            <Pencil size={13} /> Edit
          </button>
          <button
            onClick={onAnalyze}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-indigo-600 bg-white border border-indigo-200 rounded-lg hover:border-indigo-300 transition-colors"
          >
            <Zap size={13} /> Check a job
          </button>
          {safeUrl(job.url) && (
            <a
              href={safeUrl(job.url)!}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:border-gray-300 transition-colors"
            >
              <ExternalLink size={13} /> Posting
            </a>
          )}
          <button
            onClick={onDelete}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-red-500 bg-white border border-red-200 rounded-lg hover:border-red-300 transition-colors ml-auto"
          >
            <Trash2 size={13} /> Delete
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-5 py-4">

          {/* Status + quick move */}
          <Section title="Status">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${cfg.color} ${cfg.bg}`}>
                {cfg.label}
              </span>
              {nextStatus && (
                <button
                  onClick={() => onStatusChange(nextStatus)}
                  className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-700 font-medium"
                >
                  <ArrowRight size={12} /> Move to {STATUS_CONFIG[nextStatus].label}
                </button>
              )}
            </div>
            {/* All statuses */}
            <div className="flex flex-wrap gap-1.5 mt-2">
              {KANBAN_STATUSES.filter(s => s !== job.status).map(s => (
                <button
                  key={s}
                  onClick={() => onStatusChange(s)}
                  className="flex items-center gap-1 text-[11px] text-gray-500 hover:text-gray-800 px-2 py-1 rounded-md hover:bg-gray-100 border border-gray-200 transition-colors"
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${STATUS_CONFIG[s].dot}`} />
                  {STATUS_CONFIG[s].label}
                </button>
              ))}
            </div>
          </Section>

          {/* Key details */}
          <Section title="Details">
            <div className="grid grid-cols-2 gap-x-4">
              {job.location && (
                <div className="flex items-center gap-1.5 mb-2 text-sm text-gray-700">
                  <MapPin size={13} className="text-gray-400 shrink-0" />
                  {job.location}
                </div>
              )}
              {job.salary && (
                <div className="flex items-center gap-1.5 mb-2 text-sm text-gray-700">
                  <DollarSign size={13} className="text-gray-400 shrink-0" />
                  {job.salary}
                </div>
              )}
              {job.jobType && (
                <div className="mb-2">
                  <span className="text-xs px-2 py-0.5 rounded-md bg-gray-100 text-gray-600">{job.jobType}</span>
                </div>
              )}
              {job.score && (
                <div className="mb-2">
                  <span className="text-xs px-2 py-0.5 rounded-md bg-blue-50 text-blue-600 font-medium">Score: {job.score}</span>
                </div>
              )}
              {job.priority && (
                <div className="mb-2">
                  <span className="text-xs px-2 py-0.5 rounded-md bg-amber-50 text-amber-600 capitalize font-medium">{job.priority} priority</span>
                </div>
              )}
            </div>

            {/* Dates */}
            <div className="space-y-1.5 mt-1">
              {job.appliedAt && (
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <Calendar size={13} className="text-gray-400 shrink-0" />
                  Applied {fmt(job.appliedAt)}
                </div>
              )}
              {job.lastContactDate && (
                <div className="flex items-center gap-2 text-sm text-amber-700 font-medium">
                  <MessageSquare size={13} className="text-amber-400 shrink-0" />
                  Last contact {fmt(job.lastContactDate)}
                </div>
              )}
              {job.followUpDate && (
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <Calendar size={13} className="text-gray-400 shrink-0" />
                  Follow up {fmt(job.followUpDate)}
                </div>
              )}
            </div>
          </Section>

          {/* Source */}
          {(job.sourceType || job.sourceContact || job.sourceNotes) && (
            <Section title="Source">
              {job.sourceType && (
                <span className="inline-block text-xs px-2 py-0.5 rounded-md bg-purple-50 text-purple-600 mb-2 capitalize">
                  {job.sourceType.replace(/_/g, " ")}
                </span>
              )}
              {job.sourceContact && (
                <div className="flex items-center gap-1.5 text-sm text-gray-700 mb-1">
                  <User size={13} className="text-gray-400" />
                  {job.sourceContact.name}
                  {job.sourceContact.title && <span className="text-gray-400">— {job.sourceContact.title}</span>}
                </div>
              )}
              {job.sourceNotes && <p className="text-sm text-gray-600">{job.sourceNotes}</p>}
            </Section>
          )}

          {/* Next action */}
          {job.nextAction && (
            <Section title="Next Action">
              <p className="text-sm text-gray-800">{job.nextAction}</p>
            </Section>
          )}

          {/* Notes */}
          {job.notes && (
            <Section title="Notes">
              <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{job.notes}</p>
            </Section>
          )}

          {/* JD Analysis */}
          {jdAnalysis && (
            <Section title="JD Analysis">
              {jdAnalysis.keyReqs && jdAnalysis.keyReqs.length > 0 && (
                <div className="mb-3">
                  <p className="text-[11px] text-gray-400 mb-1.5">Key requirements</p>
                  <div className="flex flex-wrap gap-1.5">
                    {jdAnalysis.keyReqs.map(r => (
                      <span key={r} className="text-xs px-2 py-0.5 rounded-md bg-gray-100 text-gray-600">{r}</span>
                    ))}
                  </div>
                </div>
              )}
              {jdAnalysis.matched && jdAnalysis.matched.length > 0 && (
                <div className="mb-3">
                  <p className="text-[11px] text-gray-400 mb-1.5">Matched skills</p>
                  <div className="flex flex-wrap gap-1.5">
                    {jdAnalysis.matched.map(r => (
                      <span key={r} className="text-xs px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200">{r}</span>
                    ))}
                  </div>
                </div>
              )}
              {jdAnalysis.gaps && jdAnalysis.gaps.length > 0 && (
                <div>
                  <p className="text-[11px] text-gray-400 mb-1.5">Gaps</p>
                  <div className="flex flex-wrap gap-1.5">
                    {jdAnalysis.gaps.map(r => (
                      <span key={r} className="text-xs px-2 py-0.5 rounded-md bg-red-50 text-red-600 border border-red-200">{r}</span>
                    ))}
                  </div>
                </div>
              )}
              <div className="mt-3">
                <p className="text-[11px] text-gray-400 mb-1.5">ATS keyword match</p>
                {jdAnalysis.atsCheck.total > 0 ? (
                  <div className="rounded-lg border border-sky-100 bg-sky-50/60 p-3">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm text-gray-700">
                        {jdAnalysis.atsCheck.present.length} of {jdAnalysis.atsCheck.total} required keywords present
                      </p>
                      <span className="text-sm font-semibold text-sky-700">{jdAnalysis.atsCheck.score}%</span>
                    </div>
                    <div className="mt-3">
                      <p className="text-[11px] text-emerald-700 mb-1.5">Present</p>
                      <div className="flex flex-wrap gap-1.5">
                        {jdAnalysis.atsCheck.present.map((keyword, index) => (
                          <span key={keyword + index} className="text-xs px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200">
                            {keyword}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div className="mt-3">
                      <p className="text-[11px] text-red-700 mb-1.5">Missing</p>
                      <div className="flex flex-wrap gap-1.5">
                        {jdAnalysis.atsCheck.missing.map((keyword, index) => (
                          <span key={keyword + index} className="text-xs px-2 py-0.5 rounded-md bg-red-50 text-red-600 border border-red-200">
                            {keyword}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-gray-500">ATS keyword coverage is not available for this analysis yet.</p>
                )}
              </div>
            </Section>
          )}

          {/* Resume sent */}
          <Field label="Resume version sent" value={job.resumeSent} />
          {/* Closed reason */}
          <Field label="Closed reason" value={job.closedReason} />

          {/* Added date */}
          <p className="text-[11px] text-gray-400 mt-4">Added {fmt(job.createdAt)}</p>
        </div>
      </div>
    </>
  );
}
