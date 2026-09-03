"use client";

import { useState, useEffect } from "react";
import { Save, Eye, EyeOff } from "lucide-react";

const inputClass =
  "w-full px-3 py-2 text-sm rounded-lg border border-gray-200 bg-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400 transition-colors font-mono";

function formatSyncTime(iso: string | null): string {
  if (!iso) return "Never synced";
  const d = new Date(iso);
  const date = d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
  const time = d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false });
  return `Last synced: ${date} at ${time}`;
}

export function AdzunaSettingsForm() {
  const [appId, setAppId] = useState("");
  const [appKey, setAppKey] = useState("");
  const [keySet, setKeySet] = useState(false);
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [showKey, setShowKey] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch("/api/settings/adzuna")
      .then((r) => r.json())
      .then((data) => {
        if (data.adzuna_app_id) setAppId(data.adzuna_app_id);
        setKeySet(Boolean(data.adzuna_app_key_set));
        setLastSync(data.last_adzuna_sync ?? null);
        setLoading(false);
      });
  }, []);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    await fetch("/api/settings/adzuna", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ adzuna_app_id: appId, adzuna_app_key: appKey }),
    });
    if (appKey.trim()) setKeySet(true);
    setAppKey("");
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  if (loading) return <div className="text-sm text-gray-400 py-4">Loading...</div>;

  return (
    <form onSubmit={handleSave} className="space-y-4">
      <p className="text-xs text-gray-400">
        Get your credentials at{" "}
        <a
          href="https://developer.adzuna.com"
          target="_blank"
          rel="noreferrer"
          className="text-indigo-600 hover:underline"
        >
          developer.adzuna.com
        </a>
      </p>

      {/* App ID */}
      <div>
        <label className="block text-xs font-semibold text-gray-600 mb-1 uppercase tracking-wide">
          App ID
        </label>
        <input
          className={inputClass}
          value={appId}
          onChange={(e) => setAppId(e.target.value)}
          placeholder="12345678"
        />
      </div>

      {/* App Key */}
      <div>
        <label className="block text-xs font-semibold text-gray-600 mb-1 uppercase tracking-wide">
          App Key
        </label>
        <div className="flex gap-2">
          <input
            className={inputClass}
            type={showKey ? "text" : "password"}
            value={appKey}
            onChange={(e) => setAppKey(e.target.value)}
            placeholder={keySet ? "•••••••• (saved — leave blank to keep)" : "Your Adzuna app_key"}
          />
          <button
            type="button"
            onClick={() => setShowKey((s) => !s)}
            className="flex items-center justify-center px-3 py-2 border border-gray-200 hover:border-gray-300 rounded-lg bg-white text-gray-500 hover:text-gray-700 transition-colors"
            aria-label={showKey ? "Hide key" : "Show key"}
          >
            {showKey ? <EyeOff size={14} /> : <Eye size={14} />}
          </button>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <button
          type="submit"
          disabled={saving}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white rounded-lg transition-colors"
        >
          <Save size={13} />
          {saved ? "Saved!" : saving ? "Saving..." : "Save"}
        </button>
        <span className="text-xs text-gray-400">{formatSyncTime(lastSync)}</span>
      </div>
    </form>
  );
}
