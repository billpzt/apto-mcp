"use client";

import { useState, useEffect } from "react";
import { RefreshCw, Copy, Check } from "lucide-react";

const inputClass =
  "w-full px-3 py-2 text-sm rounded-lg border border-gray-200 bg-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400 transition-colors font-mono";

function formatLastSync(iso: string | null): string {
  if (!iso) return "Never synced";
  return "Last synced: " + new Date(iso).toLocaleString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function WorkspaceSyncSettingsForm() {
  const [syncKey, setSyncKey] = useState("");
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetch("/api/settings/workspace-sync")
      .then((r) => r.json())
      .then((data) => {
        if (data.workspace_sync_key) setSyncKey(data.workspace_sync_key);
        if (data.last_workspace_sync) setLastSync(data.last_workspace_sync);
        setLoading(false);
      });
  }, []);

  async function handleGenerate() {
    setGenerating(true);
    const res = await fetch("/api/settings/workspace-sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "generate" }),
    });
    const data = await res.json();
    setSyncKey(data.workspace_sync_key);
    setGenerating(false);
  }

  async function handleCopy() {
    await navigator.clipboard.writeText(syncKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (loading) return <div className="text-sm text-gray-400 py-4">Loading...</div>;

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-xs font-semibold text-gray-600 mb-1 uppercase tracking-wide">
          Sync Key
        </label>
        <p className="text-xs text-gray-400 mb-2">
          Share this key with Claude in Cowork to authorize syncs.
        </p>
        <div className="flex gap-2">
          <input
            className={inputClass + " text-xs"}
            value={syncKey}
            readOnly
            placeholder="No key yet — click Generate"
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

      <p className="text-xs text-gray-500">{formatLastSync(lastSync)}</p>
    </div>
  );
}
