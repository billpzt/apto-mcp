"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type ImportResult = { results: Array<{ status: string; message: string }> };

export function AssistantBridge() {
  const router = useRouter();
  const [value, setValue] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function importCandidates() {
    setMessage(null);
    setLoading(true);
    try {
      const parsed = JSON.parse(value);
      const body = Array.isArray(parsed) ? { candidates: parsed } : parsed;
      const response = await fetch("/api/assistant/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await response.json() as ImportResult & { error?: string };
      if (!response.ok) throw new Error(data.error ?? "Import failed");
      const count = (status: string) => data.results.filter((item) => item.status === status).length;
      setMessage(`Created ${count("created")}, merged ${count("merged")}, failed ${count("failed")}.`);
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Import failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="rounded-xl border border-gray-200 bg-white p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-gray-900">Desktop assistant bridge</h2>
          <p className="mt-1 text-xs text-gray-500">Use MCP when available, or exchange structured JSON here.</p>
        </div>
        <a href="/api/assistant/export" className="text-xs font-medium text-indigo-600">
          Download context for desktop assistant
        </a>
      </div>
      <textarea
        value={value}
        onChange={(event) => setValue(event.target.value)}
        rows={5}
        className="mt-4 w-full rounded-lg border border-gray-200 p-3 font-mono text-xs"
        placeholder='{"candidates":[{"title":"Python Engineer","company":"Example","url":"https://example.com/jobs/1","eligibleFromBrazil":"eligible","score":"A"}]}'
      />
      <div className="mt-3 flex items-center gap-3">
        <button disabled={loading || !value.trim()} onClick={importCandidates} className="rounded-md bg-indigo-600 px-3 py-2 text-xs font-medium text-white disabled:opacity-40">
          {loading ? "Importing..." : "Import candidates"}
        </button>
        {message && <span className="text-xs text-gray-600">{message}</span>}
      </div>
    </section>
  );
}
