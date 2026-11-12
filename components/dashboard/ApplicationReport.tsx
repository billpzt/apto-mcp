"use client";

import { useState } from "react";

export function ApplicationReport({ reports }: { reports: Record<number, string> }) {
  const [days, setDays] = useState(30);
  const [visible, setVisible] = useState(false);
  const [feedback, setFeedback] = useState("");

  async function copyReport() {
    try {
      await navigator.clipboard.writeText(reports[days]);
      setFeedback("Report copied.");
    } catch {
      setFeedback("Copy is unavailable. Select the report text to copy it.");
    }
  }

  return (
    <section aria-label="Application report" className="space-y-3 rounded-lg border border-gray-200 bg-white p-4">
      <div className="flex flex-wrap items-center gap-3">
        <label className="text-sm text-gray-700">
          Reporting period
          <select className="ml-2 rounded border border-gray-300 px-2 py-1" value={days}
            onChange={(event) => { setDays(Number(event.target.value)); setFeedback(""); }}>
            <option value={7}>Last 7 days</option>
            <option value={30}>Last 30 days</option>
            <option value={90}>Last 90 days</option>
          </select>
        </label>
        <button type="button" aria-expanded={visible} aria-controls="application-report"
          className="rounded bg-gray-900 px-3 py-2 text-sm font-medium text-white"
          onClick={() => { setVisible(!visible); setFeedback(""); }}>
          {visible ? "Hide report" : "Generate report"}
        </button>
        {visible && (
          <button type="button" className="rounded border border-gray-300 px-3 py-2 text-sm" onClick={copyReport}>
            Copy Markdown
          </button>
        )}
        <span role="status" className="text-sm text-gray-600">{feedback}</span>
      </div>
      {visible && <pre id="application-report" className="max-h-96 overflow-auto whitespace-pre-wrap break-words rounded bg-gray-50 p-3 text-sm">{reports[days]}</pre>}
    </section>
  );
}
