"use client";

import { useState, useEffect } from "react";
import { Plus, Star, Pencil, Trash2, BookOpen, Target, Loader2, RefreshCw, FileText } from "lucide-react";
import { SKILL_LEVELS, SKILL_CATEGORIES } from "@/lib/constants";

type Skill = {
  id: string;
  name: string;
  category: string | null;
  level: number;
  yearsExp: number | null;
  notes: string | null;
  featured: boolean;
  atomlearnTopic: string | null;
};

type PracticeSession = {
  id: string;
  date: string;
  platform: string;
  topic: string;
  problems: number | null;
  duration: number | null;
  difficulty: string | null;
  notes: string | null;
  skill: { id: string; name: string } | null;
};

type SyncResult = {
  updatedCount: number;
  skippedCount: number;
  syncedAt: string;
};

type ResumeSyncResult = {
  updatedCount: number;
  createdCount: number;
  syncedAt: string;
};

const PLATFORMS = ["LeetCode", "HackerRank", "Exercism", "Codewars", "AtomLearn", "YouTube", "Docs", "Other"];
const DIFFICULTIES = ["easy", "medium", "hard"];

function LevelDots({ level }: { level: number }) {
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((i) => (
        <div key={i} className={"w-2 h-2 rounded-full " + (i <= level ? "bg-indigo-500" : "bg-gray-200")} />
      ))}
    </div>
  );
}

const inputClass =
  "w-full px-3 py-2 text-sm rounded-lg border border-gray-200 bg-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400 transition-colors";

type Tab = "skills" | "practice" | "gaps";

export default function SkillsPage() {
  const [tab, setTab] = useState<Tab>("skills");
  const [skills, setSkills] = useState<Skill[]>([]);
  const [sessions, setSessions] = useState<PracticeSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [sessionsLoading, setSessionsLoading] = useState(true);

  // Skill form
  const [showForm, setShowForm] = useState(false);
  const [editSkill, setEditSkill] = useState<Skill | null>(null);
  const [form, setForm] = useState({ name: "", category: "", level: 3, yearsExp: "", notes: "", featured: false });

  // Practice form
  const [showPracticeForm, setShowPracticeForm] = useState(false);
  const [practiceForm, setPracticeForm] = useState({
    platform: "LeetCode", topic: "", problems: "", duration: "", difficulty: "", notes: "", skillId: "",
  });
  const [practiceLoading, setPracticeLoading] = useState(false);

  // AtomLearn sync
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<SyncResult | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);

  // Resume sync
  const [resumeSyncing, setResumeSyncing] = useState(false);
  const [resumeSyncResult, setResumeSyncResult] = useState<ResumeSyncResult | null>(null);
  const [resumeSyncError, setResumeSyncError] = useState<string | null>(null);

  async function handleResumeSync() {
    setResumeSyncing(true);
    setResumeSyncError(null);
    setResumeSyncResult(null);
    try {
      const res = await fetch("/api/skills/sync-resume", { method: "POST" });
      const data = await res.json();
      if (!res.ok) { setResumeSyncError(data.error ?? "Sync failed"); return; }
      setResumeSyncResult(data);
      const fresh = await fetch("/api/skills").then((r) => r.json());
      setSkills(fresh);
    } catch (e) {
      setResumeSyncError(e instanceof Error ? e.message : "Sync failed");
    } finally {
      setResumeSyncing(false);
    }
  }

  async function handleAtomLearnSync() {
    setSyncing(true);
    setSyncError(null);
    setSyncResult(null);
    try {
      const res = await fetch("/api/skills/sync-atomlearn");
      const data = await res.json();
      if (!res.ok) { setSyncError(data.error ?? "Sync failed"); return; }
      setSyncResult(data);
      const fresh = await fetch("/api/skills").then((r) => r.json());
      setSkills(fresh);
    } catch (e) {
      setSyncError(e instanceof Error ? e.message : "Sync failed");
    } finally {
      setSyncing(false);
    }
  }

  useEffect(() => {
    fetch("/api/skills")
      .then((r) => r.json())
      .then((data) => { setSkills(data); setLoading(false); });
  }, []);

  useEffect(() => {
    if (tab === "practice" && sessions.length === 0) {
      fetch("/api/practice")
        .then((r) => r.json())
        .then((data) => { setSessions(data); setSessionsLoading(false); });
    }
  }, [tab, sessions.length]);

  // Skill CRUD
  function openAdd() {
    setEditSkill(null);
    setForm({ name: "", category: "", level: 3, yearsExp: "", notes: "", featured: false });
    setShowForm(true);
  }
  function openEdit(skill: Skill) {
    setEditSkill(skill);
    setForm({ name: skill.name, category: skill.category ?? "", level: skill.level, yearsExp: skill.yearsExp?.toString() ?? "", notes: skill.notes ?? "", featured: skill.featured });
    setShowForm(true);
  }
  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    const payload = { ...form, yearsExp: form.yearsExp ? parseFloat(form.yearsExp) : null, category: form.category || null, notes: form.notes || null };
    if (editSkill) {
      const res = await fetch("/api/skills/" + editSkill.id, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const updated = await res.json();
      setSkills((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
    } else {
      const res = await fetch("/api/skills", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const created = await res.json();
      setSkills((prev) => [created, ...prev]);
    }
    setShowForm(false);
  }
  async function handleDelete(id: string) {
    await fetch("/api/skills/" + id, { method: "DELETE" });
    setSkills((prev) => prev.filter((s) => s.id !== id));
  }

  // Practice CRUD
  async function handlePracticeSave(e: React.FormEvent) {
    e.preventDefault();
    setPracticeLoading(true);
    const res = await fetch("/api/practice", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...practiceForm,
        problems: practiceForm.problems ? parseInt(practiceForm.problems) : null,
        duration: practiceForm.duration ? parseInt(practiceForm.duration) : null,
        skillId: practiceForm.skillId || null,
        difficulty: practiceForm.difficulty || null,
        notes: practiceForm.notes || null,
      }),
    });
    const created = await res.json();
    setSessions((prev) => [created, ...prev]);
    setPracticeForm({ platform: "LeetCode", topic: "", problems: "", duration: "", difficulty: "", notes: "", skillId: "" });
    setShowPracticeForm(false);
    setPracticeLoading(false);
  }
  async function handlePracticeDelete(id: string) {
    await fetch("/api/practice/" + id, { method: "DELETE" });
    setSessions((prev) => prev.filter((s) => s.id !== id));
  }

  // Skill gap analysis
  const weakSkills = skills.filter((s) => s.level <= 2).sort((a, b) => a.level - b.level);
  const strongSkills = skills.filter((s) => s.level >= 4).sort((a, b) => b.level - a.level);

  const grouped = SKILL_CATEGORIES.reduce<Record<string, Skill[]>>((acc, cat) => {
    const catSkills = skills.filter((s) => s.category === cat);
    if (catSkills.length) acc[cat] = catSkills;
    return acc;
  }, {});
  const uncategorized = skills.filter((s) => !s.category);
  if (uncategorized.length) grouped["Uncategorized"] = uncategorized;

  const tabClass = (t: Tab) =>
    "px-4 py-2 text-sm font-medium rounded-lg transition-colors " +
    (tab === t ? "bg-white text-gray-900 shadow-sm border border-gray-200" : "text-gray-500 hover:text-gray-700");

  return (
    <div className="max-w-3xl mx-auto px-6 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Skills</h1>
          <p className="text-sm text-gray-500 mt-0.5">{skills.length} tracked</p>
        </div>
        <div className="flex gap-2">
          {tab === "skills" && (
            <>
              <button
                onClick={handleResumeSync}
                disabled={resumeSyncing}
                title="Extract skills and levels from your default resume"
                className="flex items-center gap-2 px-3 py-2 border border-gray-200 hover:border-gray-300 bg-white text-gray-600 hover:text-gray-900 text-sm font-medium rounded-lg transition-colors disabled:opacity-40"
              >
                <FileText size={13} className={resumeSyncing ? "animate-pulse" : ""} />
                {resumeSyncing ? "Syncing..." : "Sync from Resume"}
              </button>
              <button
                onClick={handleAtomLearnSync}
                disabled={syncing}
                title="Sync skill levels from AtomLearn mastery scores"
                className="flex items-center gap-2 px-3 py-2 border border-gray-200 hover:border-gray-300 bg-white text-gray-600 hover:text-gray-900 text-sm font-medium rounded-lg transition-colors disabled:opacity-40"
              >
                <RefreshCw size={13} className={syncing ? "animate-spin" : ""} />
                {syncing ? "Syncing..." : "Sync AtomLearn"}
              </button>
              <button onClick={openAdd} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg transition-colors">
                <Plus size={15} /> Add Skill
              </button>
            </>
          )}
          {tab === "practice" && (
            <button onClick={() => setShowPracticeForm(true)} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg transition-colors">
              <Plus size={15} /> Log Session
            </button>
          )}
        </div>
      </div>

      {/* Sync feedback */}
      {resumeSyncError && (
        <div className="mb-4 px-4 py-2 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
          Resume sync failed: {resumeSyncError}
        </div>
      )}
      {resumeSyncResult && (
        <div className="mb-4 px-4 py-2 rounded-lg bg-emerald-50 border border-emerald-200 text-sm text-emerald-700 flex items-center gap-2">
          <FileText size={13} />
          Synced {new Date(resumeSyncResult.syncedAt).toLocaleTimeString()}: {resumeSyncResult.createdCount} skill{resumeSyncResult.createdCount !== 1 ? "s" : ""} added, {resumeSyncResult.updatedCount} updated.
        </div>
      )}
      {syncError && (
        <div className="mb-4 px-4 py-2 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
          AtomLearn sync failed: {syncError}
        </div>
      )}
      {syncResult && (
        <div className="mb-4 px-4 py-2 rounded-lg bg-emerald-50 border border-emerald-200 text-sm text-emerald-700 flex items-center gap-2">
          <RefreshCw size={13} />
          Synced {new Date(syncResult.syncedAt).toLocaleTimeString()}: {syncResult.updatedCount} skill{syncResult.updatedCount !== 1 ? "s" : ""} updated, {syncResult.skippedCount} unchanged.
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-gray-100 rounded-xl mb-6 w-fit">
        <button className={tabClass("skills")} onClick={() => setTab("skills")}>
          <span className="flex items-center gap-1.5"><Star size={13} /> Skills</span>
        </button>
        <button className={tabClass("practice")} onClick={() => setTab("practice")}>
          <span className="flex items-center gap-1.5"><BookOpen size={13} /> Practice Log</span>
        </button>
        <button className={tabClass("gaps")} onClick={() => setTab("gaps")}>
          <span className="flex items-center gap-1.5"><Target size={13} /> Gap Analysis</span>
        </button>
      </div>

      {/* SKILLS TAB */}
      {tab === "skills" && (
        <>
          {loading && <div className="text-sm text-gray-400 text-center py-16">Loading...</div>}
          {!loading && Object.keys(grouped).length === 0 && (
            <div className="text-center py-16 text-gray-400">
              <Star size={32} className="mx-auto mb-3 opacity-30" />
              <p className="text-sm">No skills yet.</p>
            </div>
          )}
          {Object.entries(grouped).map(([category, catSkills]) => (
            <div key={category} className="mb-8">
              <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">{category}</h2>
              <div className="flex flex-col gap-2">
                {catSkills.sort((a, b) => b.level - a.level).map((skill) => (
                  <div key={skill.id} className="flex items-center gap-4 bg-white border border-gray-200 rounded-lg px-4 py-3 group hover:border-gray-300 transition-colors">
                    {skill.featured && <Star size={13} className="text-amber-400 fill-amber-400 shrink-0" />}
                    <div className="flex-1 min-w-0">
                      <span className="text-sm font-medium text-gray-900">{skill.name}</span>
                      {skill.yearsExp && <span className="ml-2 text-xs text-gray-400">{skill.yearsExp}y exp</span>}
                      {skill.atomlearnTopic && <span className="ml-2 text-xs text-indigo-500">AL: {skill.atomlearnTopic}</span>}
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-gray-400">{SKILL_LEVELS[skill.level]}</span>
                      <LevelDots level={skill.level} />
                    </div>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => openEdit(skill)} className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600"><Pencil size={13} /></button>
                      <button onClick={() => handleDelete(skill.id)} className="p-1.5 rounded hover:bg-red-50 text-gray-400 hover:text-red-500"><Trash2 size={13} /></button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </>
      )}

      {/* PRACTICE LOG TAB */}
      {tab === "practice" && (
        <div>
          {sessionsLoading && (
            <div className="flex justify-center py-16">
              <Loader2 size={20} className="animate-spin text-gray-400" />
            </div>
          )}
          {!sessionsLoading && sessions.length === 0 && (
            <div className="text-center py-16 text-gray-400">
              <BookOpen size={32} className="mx-auto mb-3 opacity-30" />
              <p className="text-sm">No sessions logged yet. Hit &quot;Log Session&quot; to start.</p>
              <p className="text-xs mt-1 text-gray-300">Or tell the AI chat: &quot;I just did 5 LeetCode medium problems on dynamic programming&quot;</p>
            </div>
          )}
          <div className="flex flex-col gap-2">
            {sessions.map((s) => (
              <div key={s.id} className="flex items-start gap-3 bg-white border border-gray-200 rounded-lg px-4 py-3 group hover:border-gray-300 transition-colors">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-semibold px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200">{s.platform}</span>
                    <span className="text-sm font-medium text-gray-900">{s.topic}</span>
                    {s.difficulty && <span className={"text-xs px-1.5 py-0.5 rounded " + (s.difficulty === "hard" ? "bg-red-50 text-red-600" : s.difficulty === "medium" ? "bg-amber-50 text-amber-600" : "bg-green-50 text-green-600")}>{s.difficulty}</span>}
                  </div>
                  <div className="flex items-center gap-3 mt-1 text-xs text-gray-400">
                    <span>{new Date(s.date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>
                    {s.problems && <span>{s.problems} problem{s.problems !== 1 ? "s" : ""}</span>}
                    {s.duration && <span>{s.duration} min</span>}
                    {s.skill && <span className="text-indigo-500">{s.skill.name}</span>}
                  </div>
                  {s.notes && <div className="text-xs text-gray-500 mt-1">{s.notes}</div>}
                </div>
                <button onClick={() => handlePracticeDelete(s.id)} className="opacity-0 group-hover:opacity-100 p-1.5 rounded hover:bg-red-50 text-gray-400 hover:text-red-500 transition-opacity shrink-0">
                  <Trash2 size={13} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* GAP ANALYSIS TAB */}
      {tab === "gaps" && (
        <div className="space-y-6">
          <div>
            <h2 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
              Strengths ({strongSkills.length})
            </h2>
            {strongSkills.length === 0 ? (
              <p className="text-sm text-gray-400">Mark skills as level 4-5 to see your strengths here.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {strongSkills.map((s) => (
                  <span key={s.id} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 text-sm">
                    {s.name}
                    <span className="text-xs opacity-60">L{s.level}</span>
                  </span>
                ))}
              </div>
            )}
          </div>

          <div>
            <h2 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-red-500 inline-block" />
              Knowledge Gaps ({weakSkills.length})
            </h2>
            {weakSkills.length === 0 ? (
              <p className="text-sm text-gray-400">No gaps found (all skills level 3+).</p>
            ) : (
              <div className="flex flex-col gap-2">
                {weakSkills.map((s) => (
                  <div key={s.id} className="flex items-center gap-3 bg-white border border-red-100 rounded-lg px-4 py-3">
                    <div className="flex-1">
                      <div className="text-sm font-medium text-gray-900">{s.name}</div>
                      {s.category && <div className="text-xs text-gray-400">{s.category}</div>}
                    </div>
                    <LevelDots level={s.level} />
                    <span className="text-xs text-red-600 font-medium">{SKILL_LEVELS[s.level]}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-indigo-50 rounded-xl p-4 border border-indigo-100">
            <h2 className="text-sm font-semibold text-indigo-800 mb-2 flex items-center gap-2">
              <BookOpen size={14} />
              Suggested Focus Areas
            </h2>
            <ul className="text-sm text-indigo-700 space-y-1">
              {weakSkills.slice(0, 5).map((s) => (
                <li key={s.id} className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 shrink-0" />
                  <strong>{s.name}</strong> — {
                    s.atomlearnTopic
                      ? "practice on AtomLearn (" + s.atomlearnTopic + ")"
                      : s.category === "Programming" || s.category === "Algorithms"
                      ? "LeetCode / Exercism"
                      : s.category === "Automation" || s.category === "RPA"
                      ? "UiPath Academy / Automation Anywhere"
                      : s.category === "Frontend"
                      ? "Frontend Mentor / Build projects"
                      : "AtomLearn / YouTube / Docs"
                  }
                </li>
              ))}
              {weakSkills.length === 0 && (
                <li className="text-indigo-500">Add skills at level 1-2 to get practice recommendations.</li>
              )}
            </ul>
            <p className="text-xs text-indigo-500 mt-3">
              Tip: tell the AI chat what you studied and it will log a practice session automatically.
            </p>
          </div>
        </div>
      )}

      {/* Skill Form Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowForm(false)} />
          <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
              <h2 className="font-semibold text-gray-900">{editSkill ? "Edit Skill" : "Add Skill"}</h2>
            </div>
            <form onSubmit={handleSave} className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Skill Name *</label>
                  <input className={inputClass} placeholder="e.g. Python" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} required />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Category</label>
                  <select className={inputClass} value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}>
                    <option value="">None</option>
                    {SKILL_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Level (1-5)</label>
                  <div className="flex items-center gap-3">
                    <input type="range" min={1} max={5} value={form.level} onChange={(e) => setForm((f) => ({ ...f, level: parseInt(e.target.value) }))} className="flex-1" />
                    <span className="text-sm font-medium text-indigo-600 w-24 text-right">{SKILL_LEVELS[form.level]}</span>
                  </div>
                  <LevelDots level={form.level} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Years Experience</label>
                  <input className={inputClass} type="number" step="0.5" min="0" placeholder="e.g. 3.5" value={form.yearsExp} onChange={(e) => setForm((f) => ({ ...f, yearsExp: e.target.value }))} />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Notes</label>
                <input className={inputClass} placeholder="Context, certifications, etc." value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} />
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={form.featured} onChange={(e) => setForm((f) => ({ ...f, featured: e.target.checked }))} className="rounded" />
                <span className="text-sm text-gray-600">Featured</span>
              </label>
              <div className="flex justify-end gap-3 pt-1">
                <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">Cancel</button>
                <button type="submit" className="px-4 py-2 text-sm font-medium bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg">{editSkill ? "Save" : "Add Skill"}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Practice Form Modal */}
      {showPracticeForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowPracticeForm(false)} />
          <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
              <h2 className="font-semibold text-gray-900">Log Practice Session</h2>
            </div>
            <form onSubmit={handlePracticeSave} className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Platform *</label>
                  <select className={inputClass} value={practiceForm.platform} onChange={(e) => setPracticeForm((f) => ({ ...f, platform: e.target.value }))}>
                    {PLATFORMS.map((p) => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Topic *</label>
                  <input className={inputClass} placeholder="e.g. Dynamic Programming" value={practiceForm.topic} onChange={(e) => setPracticeForm((f) => ({ ...f, topic: e.target.value }))} required />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Problems</label>
                  <input className={inputClass} type="number" min="0" placeholder="5" value={practiceForm.problems} onChange={(e) => setPracticeForm((f) => ({ ...f, problems: e.target.value }))} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Minutes</label>
                  <input className={inputClass} type="number" min="0" placeholder="60" value={practiceForm.duration} onChange={(e) => setPracticeForm((f) => ({ ...f, duration: e.target.value }))} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Difficulty</label>
                  <select className={inputClass} value={practiceForm.difficulty} onChange={(e) => setPracticeForm((f) => ({ ...f, difficulty: e.target.value }))}>
                    <option value="">-</option>
                    {DIFFICULTIES.map((d) => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Link to Skill</label>
                <select className={inputClass} value={practiceForm.skillId} onChange={(e) => setPracticeForm((f) => ({ ...f, skillId: e.target.value }))}>
                  <option value="">None</option>
                  {skills.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Notes</label>
                <input className={inputClass} placeholder="What you worked on, key insights..." value={practiceForm.notes} onChange={(e) => setPracticeForm((f) => ({ ...f, notes: e.target.value }))} />
              </div>
              <div className="flex justify-end gap-3 pt-1">
                <button type="button" onClick={() => setShowPracticeForm(false)} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">Cancel</button>
                <button type="submit" disabled={practiceLoading} className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white rounded-lg">
                  {practiceLoading && <Loader2 size={13} className="animate-spin" />}
                  Log Session
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
