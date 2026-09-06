"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Plus, RefreshCw, CheckSquare, Trash2, ChevronDown } from "lucide-react";
import { STATUS_CONFIG, KANBAN_STATUSES, type JobStatus } from "@/lib/constants";
import { createImportedJobDraftFromParams } from "@/lib/job-import";
import type { JdAnalysis } from "@/lib/jd-analysis";
import { JobCard } from "./JobCard";
import { AddJobModal } from "./AddJobModal";
import { JdAnalyzerModal } from "./JdAnalyzerModal";
import { JobDetailDrawer } from "./JobDetailDrawer";

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
  latestUpdate: {
    id: string;
    jobId: string;
    occurredAt: string;
    kind: string;
    summary: string;
    details: string | null;
    createdAt: string;
    updatedAt: string;
  } | null;
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

export type SkillRecord = {
  id: string;
  name: string;
  level: number;
};

export function KanbanBoard({ initialJobs }: { initialJobs: Job[] }) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [jobs, setJobs] = useState<Job[]>(
    initialJobs.filter((j) => j.status !== "PROFILE_LIVE")
  );
  const [skills, setSkills] = useState<SkillRecord[]>([]);
  const [userModalOpen, setUserModalOpen] = useState(false);
  const [userEditJob, setUserEditJob] = useState<Job | null>(null);
  const [analyzeJob, setAnalyzeJob] = useState<Job | null>(null);
  const [detailJob, setDetailJob] = useState<Job | null>(null);
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkMoving, setBulkMoving] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [defaultStatus, setDefaultStatus] = useState<JobStatus>("BACKLOG");
  const [error, setError] = useState<string | null>(null);
  const [adzunaConfigured, setAdzunaConfigured] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState<string | null>(null);
  const [importedJob, setImportedJob] = useState<Job | null>(() => {
    const draft = createImportedJobDraftFromParams(searchParams);
    if (!draft) return null;
    return {
      id: "",
      title: draft.title,
      company: draft.company,
      url: draft.url,
      status: draft.status,
      location: null,
      salary: null,
      jobType: null,
      notes: null,
      appliedAt: null,
      lastContactDate: null,
      createdAt: new Date().toISOString(),
      score: null,
      followUpDate: null,
      nextAction: null,
      priority: null,
      sourceType: draft.sourceType,
      sourceContactId: null,
      sourceNotes: null,
      closedReason: null,
      jdText: null,
      jdAnalysis: null,
      resumeSent: null,
      latestUpdate: null,
      sourceContact: null,
    };
  });

  useEffect(() => {
    if (importedJob) router.replace("/jobs", { scroll: false });
  }, [importedJob, router]);

  // Fetch skills for pill coloring
  useEffect(() => {
    fetch("/api/skills")
      .then((r) => r.json())
      .then((data: SkillRecord[]) => setSkills(data));
  }, []);

  // Check whether Adzuna sync is configured (to enable the Sync button)
  useEffect(() => {
    fetch("/api/settings/adzuna")
      .then((r) => r.json())
      .then((data) => setAdzunaConfigured(Boolean(data.adzuna_app_id)))
      .catch(() => {});
  }, []);

  async function handleAdzunaSync() {
    setSyncMsg(null);
    setSyncing(true);
    try {
      const res = await fetch("/api/jobs/adzuna-sync", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setSyncMsg(
          res.status === 400
            ? "Add Adzuna credentials in Settings first"
            : data.error ?? "Adzuna sync failed"
        );
        return;
      }
      const { created, updated, stalled } = data.jobs;
      setSyncMsg(`Synced: ${created} new, ${updated} updated, ${stalled} stalled`);
      // Refresh the board with the latest jobs from the DB.
      const fresh: Job[] = await fetch("/api/jobs").then((r) => r.json());
      setJobs(fresh.filter((j) => j.status !== "PROFILE_LIVE"));
    } catch {
      setSyncMsg("Adzuna sync failed");
    } finally {
      setSyncing(false);
    }
  }

  const modalOpen = userModalOpen || importedJob !== null;
  const editJob = importedJob ?? userEditJob;
  const byStatus = (status: JobStatus) => jobs.filter((j) => j.status === status);

  async function handleSave(data: Partial<Job> & { id?: string }) {
    setError(null);
    if (data.id) {
      const res = await fetch("/api/jobs/" + data.id, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Could not update job");
      const updated = await res.json();
      setJobs((prev) => prev.map((j) => (j.id === updated.id ? updated : j)));
    } else {
      const res = await fetch("/api/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Could not create job");
      const created = await res.json();
      setJobs((prev) => [created, ...prev]);
    }
    setUserModalOpen(false);
    setUserEditJob(null);
    setImportedJob(null);
  }

  async function handleDelete(id: string) {
    setError(null);
    const res = await fetch("/api/jobs/" + id, { method: "DELETE" });
    if (!res.ok) { setError((await res.json()).error ?? "Could not delete job"); return; }
    setJobs((prev) => prev.filter((j) => j.id !== id));
  }

  async function handleStatusChange(id: string, newStatus: JobStatus) {
    setError(null);
    const res = await fetch("/api/jobs/" + id, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    });
    if (!res.ok) { setError((await res.json()).error ?? "Could not update status"); return; }
    const updated = await res.json();
    setJobs((prev) => prev.map((j) => (j.id === updated.id ? updated : j)));
  }

  function toggleSelect(id: string) {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function exitSelectMode() {
    setSelectMode(false);
    setSelectedIds(new Set());
  }

  async function handleBulkDelete() {
    if (selectedIds.size === 0) return;
    setBulkDeleting(true);
    try {
      const res = await fetch("/api/jobs", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: [...selectedIds] }),
      });
      if (!res.ok) throw new Error("Bulk delete failed");
      setJobs(prev => prev.filter(j => !selectedIds.has(j.id)));
      exitSelectMode();
    } catch { setError("Bulk delete failed"); }
    finally { setBulkDeleting(false); }
  }

  async function handleBulkMove(status: JobStatus) {
    if (selectedIds.size === 0) return;
    setBulkMoving(true);
    setError(null);
    try {
      const ids = [...selectedIds];
      const results = await Promise.all(
        ids.map(async (id) => {
          const res = await fetch("/api/jobs/" + id, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ status }),
          });
          if (!res.ok) return { id, ok: false as const };
          const updated: Job = await res.json();
          return { id, ok: true as const, updated };
        })
      );

      // Only apply the optimistic update for jobs whose PATCH actually
      // succeeded, using the server's own copy of the record so the board
      // reflects true server state rather than a guessed status.
      const succeeded = results.filter(
        (r): r is { id: string; ok: true; updated: Job } => r.ok
      );
      if (succeeded.length > 0) {
        const updatedById = new Map(succeeded.map((r) => [r.id, r.updated]));
        setJobs((prev) => prev.map((j) => updatedById.get(j.id) ?? j));
      }

      const failedIds = results.filter((r) => !r.ok).map((r) => r.id);
      if (failedIds.length > 0) {
        setError(
          `${succeeded.length} job${succeeded.length === 1 ? "" : "s"} moved, ` +
          `${failedIds.length} failed to move`
        );
        // Keep select mode open with only the failed jobs still selected,
        // so the user can see and retry what did not go through.
        setSelectedIds(new Set(failedIds));
      } else {
        exitSelectMode();
      }
    } catch {
      setError("Bulk move failed");
    } finally {
      setBulkMoving(false);
    }
  }

  function openAddInColumn(status: JobStatus) {
    setDefaultStatus(status);
    setUserEditJob(null);
    setUserModalOpen(true);
  }

  function openEdit(job: Job) {
    setUserEditJob(job);
    setUserModalOpen(true);
  }

  return (
    <div className="flex h-full min-w-0 flex-col overflow-hidden">
      <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border)] bg-[var(--surface)]">
        <div>
          <h1 className="text-lg font-semibold text-[var(--foreground)]">Job Tracker</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {jobs.length} job{jobs.length !== 1 ? "s" : ""} tracked
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleAdzunaSync}
            disabled={syncing || !adzunaConfigured}
            title={adzunaConfigured ? undefined : "Configure in Settings"}
            className="flex items-center gap-2 px-4 py-2 border border-gray-200 hover:border-gray-300 bg-white text-gray-600 hover:text-gray-900 text-sm font-medium rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <RefreshCw size={15} className={syncing ? "animate-spin" : ""} />
            {syncing ? "Syncing..." : "Sync Adzuna"}
          </button>
          <button
            onClick={() => { setSelectMode(v => !v); setSelectedIds(new Set()); }}
            className={[
              "flex items-center gap-2 px-4 py-2 border text-sm font-medium rounded-lg transition-colors",
              selectMode
                ? "bg-indigo-50 border-indigo-300 text-indigo-700"
                : "border-gray-200 hover:border-gray-300 bg-white text-gray-600 hover:text-gray-900",
            ].join(" ")}
          >
            <CheckSquare size={15} /> {selectMode ? "Cancel" : "Select"}
          </button>
          <button
            onClick={() => { setDefaultStatus("BACKLOG"); setUserEditJob(null); setUserModalOpen(true); }}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg transition-colors"
          >
            <Plus size={15} /> Add Job
          </button>
        </div>
      </div>

      {error && (
        <div className="mx-6 mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">{error}</div>
      )}

      {syncMsg && (
        <div className="mx-6 mt-4 rounded-lg border border-indigo-200 bg-indigo-50 px-4 py-2 text-sm text-indigo-700">{syncMsg}</div>
      )}

      <div className="min-h-0 flex-1 overflow-auto">
        <div className="flex min-w-max gap-4 p-6">
          {KANBAN_STATUSES.map((status) => {
            const cfg = STATUS_CONFIG[status];
            const colJobs = byStatus(status);
            return (
              <div key={status} className="flex flex-col w-72 shrink-0">
                <div className="flex items-center gap-2 mb-3 px-1">
                  <span className={"w-2 h-2 rounded-full " + cfg.dot} />
                  <span className="text-sm font-medium text-gray-700">{cfg.label}</span>
                  <span className="ml-auto text-xs text-gray-400 font-medium tabular-nums">{colJobs.length}</span>
                </div>
                <div className="flex flex-col gap-2 flex-1">
                  {colJobs.map((job) => (
                    <JobCard
                      key={job.id}
                      job={job}
                      skills={skills}
                      onEdit={() => openEdit(job)}
                      onDelete={() => handleDelete(job.id)}
                      onStatusChange={(s) => handleStatusChange(job.id, s)}
                      onAnalyze={() => setAnalyzeJob(job)}
                      onOpen={() => setDetailJob(job)}
                      selectMode={selectMode}
                      selected={selectedIds.has(job.id)}
                      onSelect={() => toggleSelect(job.id)}
                    />
                  ))}
                  <button
                    onClick={() => openAddInColumn(status)}
                    className="flex items-center gap-2 px-3 py-2 text-sm text-gray-400 hover:text-gray-600 hover:bg-white rounded-lg transition-colors border-2 border-dashed border-gray-200 hover:border-gray-300 mt-1"
                  >
                    <Plus size={14} /> Add here
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Job detail drawer */}
      {detailJob && (
        <JobDetailDrawer
          job={detailJob}
          onClose={() => setDetailJob(null)}
          onEdit={() => { openEdit(detailJob); setDetailJob(null); }}
          onDelete={() => { handleDelete(detailJob.id); setDetailJob(null); }}
          onAnalyze={() => { setAnalyzeJob(detailJob); setDetailJob(null); }}
          onStatusChange={(s) => { handleStatusChange(detailJob.id, s); setDetailJob(prev => prev ? { ...prev, status: s } : null); }}
        />
      )}

      {/* Floating bulk action bar */}
      {selectMode && selectedIds.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-5 py-3 bg-gray-900 text-white rounded-xl shadow-2xl">
          <span className="text-sm font-medium">{selectedIds.size} selected</span>
          <div className="w-px h-4 bg-gray-600" />
          {/* Move to status */}
          <div className="relative group">
            <button className="flex items-center gap-1.5 text-sm font-medium text-gray-200 hover:text-white transition-colors">
              Move to <ChevronDown size={13} />
            </button>
            <div className="absolute bottom-full mb-2 left-0 hidden group-hover:block bg-white rounded-lg shadow-xl border border-gray-200 py-1 min-w-[140px]">
              {KANBAN_STATUSES.map(s => (
                <button
                  key={s}
                  onClick={() => handleBulkMove(s)}
                  disabled={bulkMoving}
                  className="flex items-center gap-2 w-full px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                >
                  <span className={`w-2 h-2 rounded-full ${STATUS_CONFIG[s].dot}`} />
                  {STATUS_CONFIG[s].label}
                </button>
              ))}
            </div>
          </div>
          <button
            onClick={handleBulkDelete}
            disabled={bulkDeleting}
            className="flex items-center gap-1.5 text-sm font-medium text-red-400 hover:text-red-300 transition-colors disabled:opacity-50"
          >
            <Trash2 size={14} /> {bulkDeleting ? "Deleting..." : "Delete"}
          </button>
          <div className="w-px h-4 bg-gray-600" />
          <button onClick={exitSelectMode} className="text-sm text-gray-400 hover:text-white transition-colors">
            Cancel
          </button>
        </div>
      )}

      {analyzeJob && (
        <JdAnalyzerModal
          jobId={analyzeJob.id}
          jobTitle={analyzeJob.title}
          company={analyzeJob.company}
          existingJdText={analyzeJob.jdText}
          existingAnalysis={analyzeJob.jdAnalysis}
          onClose={() => setAnalyzeJob(null)}
          onSaved={({ analysis, jdText }: { analysis: JdAnalysis; jdText: string }) => {
            const serializedAnalysis = JSON.stringify(analysis);
            setJobs((prev) =>
              prev.map((j) =>
                j.id === analyzeJob.id
                  ? { ...j, score: analysis.grade, jdText, jdAnalysis: serializedAnalysis }
                  : j
              )
            );
            setDetailJob((prev) =>
              prev && prev.id === analyzeJob.id
                ? { ...prev, score: analysis.grade, jdText, jdAnalysis: serializedAnalysis }
                : prev
            );
          }}
        />
      )}

      {modalOpen && (
        <AddJobModal
          key={editJob?.id ?? "new-" + defaultStatus}
          job={editJob}
          defaultStatus={defaultStatus}
          onSave={handleSave}
          onJobUpdated={(updatedJob) => {
            setJobs((prev) => prev.map((job) => (job.id === updatedJob.id ? updatedJob : job)));
          }}
          onClose={() => { setUserModalOpen(false); setUserEditJob(null); setImportedJob(null); }}
        />
      )}
    </div>
  );
}
