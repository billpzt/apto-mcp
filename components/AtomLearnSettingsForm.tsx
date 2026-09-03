"use client";

import { useState, useEffect } from "react";
import { RefreshCw, Copy, Check, Save } from "lucide-react";

const inputClass =
  "w-full px-3 py-2 text-sm rounded-lg border border-gray-200 bg-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400 transition-colors font-mono";

export function AtomLearnSettingsForm() {
  const [apiUrl, setApiUrl] = useState("https://atomlearn.dev");
  const [userId, setUserId] = useState("");
  const [syncKey, setSyncKey] = useState("");
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch("/api/settings/atomlearn")
      .then((r) => r.json())
      .then((data) => {
        if (data.atomlearn_api_url) setApiUrl(data.atomlearn_api_url);
        if (data.atomlearn_user_id) setUserId(data.atomlearn_user_id);
        if (data.atomlearn_sync_key) setSyncKey(data.atomlearn_sync_key);
        setLoading(false);
      });
  }, []);

  async function handleGenerate() {
    setGenerating(true);
    const res = await fetch("/api/settings/atomlearn", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "generate" }),
    });
    const data = await res.json();
    setSyncKey(data.atomlearn_sync_key);
    setGenerating(false);
  }

  async function handleCopy() {
    await navigator.clipboard.writeText(syncKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    await fetch("/api/settings/atomlearn", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ atomlearn_api_url: apiUrl, atomlearn_user_id: userId }),
    });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  if (loading) return <div className="text-sm text-gray-400 py-4">Loading...</div>;

  return (
    <form onSubmit={handleSave} className="space-y-4">
      {/* Sync Key */}
      <div>
        <label className="block text-xs font-semibold text-gray-600 mb-1 uppercase tracking-wide">
          Sync Key
        </label>
        <p className="text-xs text-gray-400 mb-2">
          Generate a key here, then paste it into AtomLearn&apos;s Vercel environment as{" "}
          <code className="bg-gray-100 px-1 rounded text-gray-600">ATOMLEARN_SYNC_KEY</code>.
        </p>
        <div className="flex gap-2">
          <input
            className={inputClass + " text-xs"}
            value={syncKey}
            onChange={(e) => setSyncKey(e.target.value)}
            placeholder="No key yet — click Generate"
            readOnly={!!syncKey}
          />
          <button
            type="button"
            onClick={handleGenerate}
            disabled={generating}
            className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium border border-gray-200 hover:border-gray-300 rounded-lg bg-white text-gray-600 hover:text-gray-900 transition-colors whitespace-nowrap disabled:opacity-40"
          >
            <RefreshCw size={13} className={generating ? "animate-spin" : ""} />
            {generating ? "Generating..." : "Generate"}
          </button>
          {syncKey && (
            <button
              type="button"
              onClick={handleCopy}
              className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium border border-gray-200 hover:border-gray-300 rounded-lg bg-white text-gray-600 hover:text-emerald-700 transition-colors"
            >
              {copied ? <Check size={13} className="text-emerald-600" /> : <Copy size={13} />}
              {copied ? "Copied!" : "Copy"}
            </button>
          )}
        </div>
      </div>

      {/* AtomLearn URL */}
      <div>
        <label className="block text-xs font-semibold text-gray-600 mb-1 uppercase tracking-wide">
          AtomLearn URL
        </label>
        <input
          className={inputClass}
          value={apiUrl}
          onChange={(e) => setApiUrl(e.target.value)}
          placeholder="https://atomlearn.dev"
        />
      </div>

      {/* User ID */}
      <div>
        <label className="block text-xs font-semibold text-gray-600 mb-1 uppercase tracking-wide">
          AtomLearn User ID
        </label>
        <p className="text-xs text-gray-400 mb-2">
          Your Supabase UUID from AtomLearn — Supabase dashboard → Authentication → Users.
        </p>
        <input
          className={inputClass}
          value={userId}
          onChange={(e) => setUserId(e.target.value)}
          placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
        />
      </div>

      <button
        type="submit"
        disabled={saving}
        className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white rounded-lg transition-colors"
      >
        <Save size={13} />
        {saved ? "Saved!" : saving ? "Saving..." : "Save"}
      </button>
    </form>
  );
}
