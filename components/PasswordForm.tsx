"use client";

import { useState } from "react";
import { Lock, CheckCircle } from "lucide-react";

export function PasswordForm() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess(false);

    if (next !== confirm) {
      setError("New passwords don't match.");
      return;
    }
    if (next.length < 6) {
      setError("New password must be at least 6 characters.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword: current, newPassword: next }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Something went wrong.");
      } else {
        setSuccess(true);
        setCurrent("");
        setNext("");
        setConfirm("");
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mt-10">
      <div className="flex items-center gap-2 mb-4">
        <Lock size={15} className="text-gray-500" />
        <h2 className="text-sm font-semibold text-gray-800">Change Password</h2>
      </div>

      <form onSubmit={submit} className="space-y-3 max-w-sm">
        <div>
          <label className="block text-xs text-gray-500 mb-1">Current password</label>
          <input
            type="password"
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
            className="w-full px-3 py-2 text-sm rounded-lg border border-gray-200 focus:outline-none focus:border-indigo-400 transition-colors"
            required
          />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">New password</label>
          <input
            type="password"
            value={next}
            onChange={(e) => setNext(e.target.value)}
            className="w-full px-3 py-2 text-sm rounded-lg border border-gray-200 focus:outline-none focus:border-indigo-400 transition-colors"
            required
            minLength={6}
          />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Confirm new password</label>
          <input
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            className="w-full px-3 py-2 text-sm rounded-lg border border-gray-200 focus:outline-none focus:border-indigo-400 transition-colors"
            required
          />
        </div>

        {error && <p className="text-red-500 text-xs">{error}</p>}

        {success && (
          <div className="flex items-center gap-1.5 text-green-600 text-xs">
            <CheckCircle size={13} />
            Password updated. You'll use this next time you log in.
          </div>
        )}

        <button
          type="submit"
          disabled={!current || !next || !confirm || loading}
          className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? "Saving…" : "Update password"}
        </button>
      </form>
    </div>
  );
}
