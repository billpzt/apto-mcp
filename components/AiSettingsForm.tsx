"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AI_PROVIDERS } from "@/lib/constants";

type FormData = {
  provider: string;
  model: string;
  apiKeyName: string;
  isDefault: boolean;
};

export function AiSettingsForm() {
  const router = useRouter();
  const [form, setForm] = useState<FormData>({
    provider: "manual",
    model: "",
    apiKeyName: "",
    isDefault: true,
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSaved(false);
    setError(null);
    try {
      const res = await fetch("/api/settings/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Could not save settings");
      setSaved(true);
      router.refresh();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Could not save settings");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Provider */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Provider</label>
        <select
          value={form.provider}
          onChange={(e) => setForm({ ...form, provider: e.target.value })}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
        >
          {AI_PROVIDERS.map((p) => (
            <option key={p} value={p}>
              {p.charAt(0).toUpperCase() + p.slice(1)}
            </option>
          ))}
        </select>
      </div>

      {/* Manual mode guidance */}
      {form.provider === "manual" && (
        <p className="text-sm text-gray-500 bg-gray-50 rounded-lg p-3">
          Manual mode keeps Apto useful with Claude Pro or any external chat assistant.
          Apto will generate prompts you can copy out, then you can paste the response back.
        </p>
      )}

      {/* Model */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Model (optional)</label>
        <input
          type="text"
          value={form.model}
          onChange={(e) => setForm({ ...form, model: e.target.value })}
          placeholder="claude-sonnet-4, gpt-4o, etc."
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
        />
      </div>

      {/* API Key env var name */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">API Key Env Var Name (optional)</label>
        <input
          type="text"
          value={form.apiKeyName}
          onChange={(e) => setForm({ ...form, apiKeyName: e.target.value })}
          placeholder="OPENROUTER_API_KEY"
          className="w-full font-mono rounded-lg border border-gray-300 px-3 py-2 text-sm"
        />
      </div>

      {/* Default checkbox */}
      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id="isDefault"
          checked={form.isDefault}
          onChange={(e) => setForm({ ...form, isDefault: e.target.checked })}
          className="rounded border-gray-300"
        />
        <label htmlFor="isDefault" className="text-sm text-gray-700">
          Set as default provider
        </label>
      </div>

      {/* Submit */}
      <button
        type="submit"
        disabled={saving}
        className="px-4 py-2 text-sm font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
      >
        {saving ? "Saving..." : "Save"}
      </button>

      {saved && <p className="text-sm text-green-600">Saved.</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}
    </form>
  );
}
