"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { KANBAN_STATUSES, STATUS_CONFIG, SOURCE_TYPES, PRIORITIES, type JobStatus } from "@/lib/constants";
import { formatJobUpdateOccurredAt, getJobUpdateTimelinePreview } from "@/lib/job-update-timeline";
import type { SerializedJobUpdate } from "@/lib/types";

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
  score: string | null;
  followUpDate: string | null;
  nextAction: string | null;
  priority: string | null;
  sourceType: string | null;
  sourceContactId: string | null;
  sourceNotes: string | null;
  jdText: string | null;
  jdAnalysis: string | null;
  resumeSent: string | null;
  closedReason: string | null;
  appliedAt: string | null;
  lastContactDate: string | null;
  createdAt: string;
  latestUpdate: SerializedJobUpdate | null;
  sourceContact: {
    id: string;
    name: string;
    title: string | null;
    company: string | null;
    email: string | null;
    linkedin: string | null;
    notes: string | null;
    createdAt: string;
    updatedAt: string;
  } | null;
};

type Props = {
  job: Job | null;
  defaultStatus: JobStatus;
  onSave: (data: Partial<Job> & { id?: string }) => Promise<void>;
  onJobUpdated: (job: Job) => void;
  onClose: () => void;
};

type JobUpdateForm = {
  occurredAt: string;
  kind: string;
  summary: string;
  details: string;
};

function toDateInputValue(date = new Date()): string {
  const offsetMs = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 10);
}

function createEmptyUpdateForm(): JobUpdateForm {
  return {
    occurredAt: toDateInputValue(),
    kind: "note",
    summary: "",
    details: "",
  };
}

export function AddJobModal({ job, defaultStatus, onSave, onJobUpdated, onClose }: Props) {
  const [saving, setSaving] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [contacts, setContacts] = useState<Array<{ id: string; name: string; company: string | null }>>([]);
  const [jobUpdates, setJobUpdates] = useState<SerializedJobUpdate[]>([]);
  const [updateForm, setUpdateForm] = useState<JobUpdateForm>(createEmptyUpdateForm());

  useEffect(() => {
    fetch("/api/contacts")
      .then((res) => res.json())
      .then(setContacts)
      .catch(() => setContacts([]));
  }, []);

  useEffect(() => {
    if (!job?.id) return;

    let cancelled = false;
    fetch(`/api/jobs/${job.id}/updates`)
      .then((res) => (res.ok ? res.json() : []))
      .then((updates: SerializedJobUpdate[]) => {
        if (!cancelled) {
          setJobUpdates(updates);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setJobUpdates([]);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [job?.id]);

  const [form, setForm] = useState({
    title: job?.title ?? "",
    company: job?.company ?? "",
    url: job?.url ?? "",
    status: (job?.status as JobStatus) ?? defaultStatus,
    location: job?.location ?? "",
    salary: job?.salary ?? "",
    jobType: job?.jobType ?? "",
    notes: job?.notes ?? "",
    score: job?.score ?? "",
    followUpDate: job?.followUpDate
      ? new Date(job.followUpDate).toISOString().slice(0, 10)
      : "",
    nextAction: job?.nextAction ?? "",
    priority: job?.priority ?? "",
    sourceType: job?.sourceType ?? "",
    sourceContactId: job?.sourceContactId ?? "",
    sourceNotes: job?.sourceNotes ?? "",
    jdText: job?.jdText ?? "",
    resumeSent: job?.resumeSent ?? "",
    closedReason: job?.closedReason ?? "",
    appliedAt: job?.appliedAt
      ? new Date(job.appliedAt).toISOString().slice(0, 10)
      : "",
    lastContactDate: job?.lastContactDate
      ? new Date(job.lastContactDate).toISOString().slice(0, 10)
      : "",
  });

  function set(key: string, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title.trim() || !form.company.trim()) return;
    setSaving(true);
    setError(null);
    try {
      await onSave({
        id: job?.id,
        ...form,
        url: form.url || null,
        location: form.location || null,
        salary: form.salary || null,
        jobType: form.jobType || null,
        notes: form.notes || null,
        score: form.score || null,
        followUpDate: form.followUpDate ? new Date(form.followUpDate).toISOString() : null,
        nextAction: form.nextAction || null,
        priority: form.priority || null,
        sourceType: form.sourceType || null,
        sourceContactId: form.sourceContactId || null,
        sourceNotes: form.sourceNotes || null,
        jdText: form.jdText || null,
        resumeSent: form.resumeSent || null,
        closedReason: form.closedReason || null,
        appliedAt: form.appliedAt ? new Date(form.appliedAt).toISOString() : null,
        lastContactDate: form.lastContactDate ? new Date(form.lastContactDate).toISOString() : null,
      });
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Could not save job");
    } finally {
      setSaving(false);
    }
  }

  async function handleAddUpdate() {
    if (!job?.id) return;
    if (!updateForm.summary.trim()) return;

    setUpdating(true);
    setError(null);
    try {
      const res = await fetch(`/api/jobs/${job.id}/updates`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          occurredAt: new Date(updateForm.occurredAt).toISOString(),
          kind: updateForm.kind,
          summary: updateForm.summary,
          details: updateForm.details || null,
        }),
      });

      if (!res.ok) {
        throw new Error((await res.json()).error ?? "Could not add update");
      }

      const { update, job: updatedJob } = await res.json();
      setJobUpdates((prev) => getJobUpdateTimelinePreview([update, ...prev], 50));
      setUpdateForm(createEmptyUpdateForm());
      onJobUpdated(updatedJob);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Could not add update");
    } finally {
      setUpdating(false);
    }
  }

  const inputClass =
    "w-full px-3 py-2 text-sm rounded-lg border border-gray-200 bg-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400 transition-colors";
  const labelClass = "block text-xs font-medium text-gray-600 mb-1";
  const updatePreview = getJobUpdateTimelinePreview(jobUpdates, 5);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 modal-backdrop">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto modal-content">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
          <h2 className="font-semibold text-gray-900">
            {job ? "Edit Job" : "Add Job"}
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>
                Job Title <span className="text-red-400">*</span>
              </label>
              <input
                className={inputClass}
                placeholder="e.g. Senior Python Engineer"
                value={form.title}
                onChange={(e) => set("title", e.target.value)}
                required
              />
            </div>
            <div>
              <label className={labelClass}>
                Company <span className="text-red-400">*</span>
              </label>
              <input
                className={inputClass}
                placeholder="e.g. Stripe"
                value={form.company}
                onChange={(e) => set("company", e.target.value)}
                required
              />
            </div>
          </div>

          <div>
            <label className={labelClass}>Job URL</label>
            <input
              className={inputClass}
              type="url"
              placeholder="https://..."
              value={form.url}
              onChange={(e) => set("url", e.target.value)}
            />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className={labelClass}>Status</label>
              <select
                className={inputClass}
                value={form.status}
                onChange={(e) => set("status", e.target.value)}
              >
                {KANBAN_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {STATUS_CONFIG[s].label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass}>Location</label>
              <input
                className={inputClass}
                placeholder="Remote / Rio"
                value={form.location}
                onChange={(e) => set("location", e.target.value)}
              />
            </div>
            <div>
              <label className={labelClass}>Job Type</label>
              <select
                className={inputClass}
                value={form.jobType}
                onChange={(e) => set("jobType", e.target.value)}
              >
                <option value="">—</option>
                <option value="Remote">Remote</option>
                <option value="Hybrid">Hybrid</option>
                <option value="On-site">On-site</option>
                <option value="Contract">Contract</option>
                <option value="Freelance">Freelance</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Salary / Rate</label>
              <input
                className={inputClass}
                placeholder="e.g. $120k or $80/hr"
                value={form.salary}
                onChange={(e) => set("salary", e.target.value)}
              />
            </div>
            <div>
              <label className={labelClass}>Applied Date</label>
              <input
                className={inputClass}
                type="date"
                value={form.appliedAt}
                onChange={(e) => set("appliedAt", e.target.value)}
              />
            </div>
          </div>

          <div>
            <label className={labelClass}>Last Contact Date</label>
            <input
              className={inputClass}
              type="date"
              value={form.lastContactDate}
              onChange={(e) => set("lastContactDate", e.target.value)}
            />
          </div>

          <div>
            <label className={labelClass}>Notes</label>
            <textarea
              className={`${inputClass} resize-none`}
              rows={3}
              placeholder="Referral contact, interesting things about the role, follow-up needed..."
              value={form.notes}
              onChange={(e) => set("notes", e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-700">Score</label>
              <select
                value={form.score}
                onChange={(e) => set("score", e.target.value)}
                className={inputClass}
              >
                <option value="">—</option>
                <option value="A">A — Strong fit</option>
                <option value="B">B — Good fit</option>
                <option value="C">C — Average</option>
                <option value="D">D — Weak</option>
                <option value="F">F — Poor fit</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700">Priority</label>
              <select
                value={form.priority}
                onChange={(e) => set("priority", e.target.value)}
                className={inputClass}
              >
                <option value="">—</option>
                {PRIORITIES.map((p) => (
                  <option key={p} value={p}>
                    {p.charAt(0).toUpperCase() + p.slice(1)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-700">Follow-up Date</label>
              <input
                type="date"
                value={form.followUpDate}
                onChange={(e) => set("followUpDate", e.target.value)}
                className={inputClass}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700">Next Action</label>
              <input
                type="text"
                value={form.nextAction}
                onChange={(e) => set("nextAction", e.target.value)}
                placeholder="What to do next..."
                className={inputClass}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-700">Source Type</label>
              <select
                value={form.sourceType}
                onChange={(e) => set("sourceType", e.target.value)}
                className={inputClass}
              >
                <option value="">—</option>
                {SOURCE_TYPES.map((s) => (
                  <option key={s} value={s}>
                    {s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700">Source Contact</label>
              <select
                value={form.sourceContactId}
                onChange={(e) => set("sourceContactId", e.target.value)}
                className={inputClass}
              >
                <option value="">—</option>
                {contacts.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}{c.company ? ` (${c.company})` : ""}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700">Source Notes</label>
            <textarea
              value={form.sourceNotes}
              onChange={(e) => set("sourceNotes", e.target.value)}
              rows={2}
              className={inputClass}
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700">JD Text</label>
            <textarea
              value={form.jdText}
              onChange={(e) => set("jdText", e.target.value)}
              rows={5}
              className={inputClass}
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700">Resume Sent</label>
            <input
              type="text"
              value={form.resumeSent}
              onChange={(e) => set("resumeSent", e.target.value)}
              placeholder="Version or filename..."
              className={inputClass}
            />
          </div>

          {["CLOSED", "REJECTED", "WITHDRAWN"].includes(form.status) && (
            <div>
              <label className="block text-xs font-medium text-gray-700">Closed Reason</label>
              <input
                type="text"
                value={form.closedReason}
                onChange={(e) => set("closedReason", e.target.value)}
                placeholder="Why was this closed?"
                className={inputClass}
              />
            </div>
          )}

          <div className="rounded-xl border border-gray-200 bg-slate-50/80 p-4 space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-gray-900">Update timeline</h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  Store dated contact events here. Keep role context in the job notes field.
                </p>
              </div>
              <span className="rounded-full bg-white px-2 py-1 text-[10px] font-medium text-gray-500 border border-gray-200">
                {jobUpdates.length} update{jobUpdates.length === 1 ? "" : "s"}
              </span>
            </div>

            {job?.id ? (
              <>
                <div className="space-y-2 max-h-44 overflow-y-auto pr-1">
                  {updatePreview.length ? (
                    updatePreview.map((update) => (
                      <div key={update.id} className="rounded-lg border border-gray-200 bg-white px-3 py-2">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[11px] font-medium text-gray-900 capitalize">
                            {update.kind.replace(/_/g, " ")}
                          </span>
                          <span className="text-[10px] text-gray-400">
                            {formatJobUpdateOccurredAt(update.occurredAt)}
                          </span>
                        </div>
                        <p className="mt-1 text-[11px] text-gray-600">
                          {update.summary}
                        </p>
                        {update.details && (
                          <p className="mt-1 text-[10px] leading-relaxed text-gray-400">
                            {update.details}
                          </p>
                        )}
                      </div>
                    ))
                  ) : (
                    <p className="text-xs text-gray-500">
                      No updates yet. Add the first dated event below.
                    </p>
                  )}
                </div>

                <div className="space-y-3 rounded-lg border border-gray-200 bg-white p-3">
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className={labelClass}>Date</label>
                      <input
                        type="date"
                        className={inputClass}
                        value={updateForm.occurredAt}
                        onChange={(e) => setUpdateForm((f) => ({ ...f, occurredAt: e.target.value }))}
                      />
                    </div>
                    <div>
                      <label className={labelClass}>Type</label>
                      <select
                        className={inputClass}
                        value={updateForm.kind}
                        onChange={(e) => setUpdateForm((f) => ({ ...f, kind: e.target.value }))}
                      >
                        <option value="note">Note</option>
                        <option value="contact">Contact</option>
                        <option value="status_change">Status change</option>
                        <option value="interview">Interview</option>
                        <option value="assessment">Assessment</option>
                        <option value="offer">Offer</option>
                        <option value="rejection">Rejection</option>
                        <option value="withdrawal">Withdrawal</option>
                      </select>
                    </div>
                    <div className="flex items-end">
                      <button
                        type="button"
                        onClick={() => {
                          void handleAddUpdate();
                        }}
                        disabled={updating}
                        className="w-full rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {updating ? "Saving..." : "Add update"}
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className={labelClass}>Summary</label>
                    <input
                      className={inputClass}
                      placeholder="What happened?"
                      value={updateForm.summary}
                      onChange={(e) => setUpdateForm((f) => ({ ...f, summary: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>Details</label>
                    <textarea
                      className={`${inputClass} resize-none`}
                      rows={2}
                      placeholder="Optional extra context, next steps, or quote."
                      value={updateForm.details}
                      onChange={(e) => setUpdateForm((f) => ({ ...f, details: e.target.value }))}
                    />
                  </div>
                </div>
              </>
            ) : (
              <p className="text-xs text-gray-500">
                Save the job first, then reopen it to add dated updates.
              </p>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 rounded-lg hover:bg-gray-100 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 text-sm font-medium bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-lg transition-colors"
            >
              {saving ? "Saving..." : job ? "Save Changes" : "Add Job"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
