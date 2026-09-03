"use client";

import { useState } from "react";
import { Plus, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { DIRECTORY_CATEGORIES, DIRECTORY_STATUSES } from "@/lib/constants";
import { sortDirectoryItems } from "@/lib/directory";
import type { SerializedDirectoryItem } from "@/lib/types";
import { DirectoryItemCard } from "./DirectoryItemCard";

type DirectoryForm = {
  name: string;
  url: string;
  category: string;
  status: string;
  checkFrequencyDays: string;
  nextAction: string;
  notes: string;
};

function createEmptyForm(): DirectoryForm {
  return {
    name: "",
    url: "",
    category: "platform",
    status: "active",
    checkFrequencyDays: "",
    nextAction: "",
    notes: "",
  };
}

function formFromItem(item: SerializedDirectoryItem): DirectoryForm {
  return {
    name: item.name,
    url: item.url ?? "",
    category: item.category,
    status: item.status,
    checkFrequencyDays: item.checkFrequencyDays?.toString() ?? "",
    nextAction: item.nextAction ?? "",
    notes: item.notes ?? "",
  };
}

export function DirectoryBoard({ initialItems }: { initialItems: SerializedDirectoryItem[] }) {
  const router = useRouter();
  const [items, setItems] = useState(() => sortDirectoryItems(initialItems));
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<SerializedDirectoryItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<SerializedDirectoryItem | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<DirectoryForm>(createEmptyForm());

  function openCreate() {
    setError(null);
    setEditingItem(null);
    setForm(createEmptyForm());
    setEditorOpen(true);
  }

  function openEdit(item: SerializedDirectoryItem) {
    setError(null);
    setEditingItem(item);
    setForm(formFromItem(item));
    setEditorOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) return;

    setSaving(true);
    setError(null);
    try {
      const isEditing = editingItem !== null;
      const res = await fetch(isEditing ? `/api/directory/${editingItem.id}` : "/api/directory", {
        method: isEditing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          url: form.url || null,
          category: form.category,
          status: form.status,
          checkFrequencyDays: form.checkFrequencyDays ? Number(form.checkFrequencyDays) : null,
          nextAction: form.nextAction || null,
          notes: form.notes || null,
        }),
      });

      if (!res.ok) {
        throw new Error((await res.json()).error ?? "Could not save directory item");
      }

      const saved: SerializedDirectoryItem = await res.json();
      setItems((prev) =>
        sortDirectoryItems(
          isEditing ? prev.map((item) => (item.id === saved.id ? saved : item)) : [saved, ...prev]
        )
      );
      setEditorOpen(false);
      setEditingItem(null);
      setForm(createEmptyForm());
      router.refresh();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Could not save directory item");
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteConfirmed() {
    if (!deleteTarget) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/directory/${deleteTarget.id}`, { method: "DELETE" });
      if (!res.ok) {
        throw new Error((await res.json()).error ?? "Could not delete directory item");
      }
      setItems((prev) => prev.filter((item) => item.id !== deleteTarget.id));
      setDeleteTarget(null);
      router.refresh();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Could not delete directory item");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-lg font-semibold text-gray-900">Directory</h1>
          <p className="mt-1 text-sm text-gray-500">
            Job boards, passive profiles, recruiter portals, saved searches, and assessment sites.
          </p>
        </div>
        <button
          onClick={openCreate}
          className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-slate-800"
        >
          <Plus size={15} />
          Add card
        </button>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      {items.length === 0 ? (
        <button
          onClick={openCreate}
          className="flex w-full flex-col items-center justify-center rounded-2xl border border-dashed border-gray-300 bg-white/80 px-6 py-16 text-center text-sm text-gray-500 transition-colors hover:border-gray-400 hover:bg-white"
        >
          <span className="text-base font-medium text-gray-900">No directory items yet</span>
          <span className="mt-1 max-w-sm">
            Add your first platform, saved search, or recruiter portal to keep check-ins in one place.
          </span>
        </button>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => (
            <DirectoryItemCard
              key={item.id}
              item={item}
              onEdit={() => openEdit(item)}
              onDelete={() => setDeleteTarget(item)}
              onChange={(updated) => {
                setItems((prev) =>
                  sortDirectoryItems(prev.map((entry) => (entry.id === updated.id ? updated : entry)))
                );
              }}
            />
          ))}
        </div>
      )}

      {editorOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setEditorOpen(false)} />
          <div className="relative w-full max-w-xl rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4">
              <div>
                <h2 className="text-base font-semibold text-gray-900">
                  {editingItem ? "Edit directory card" : "Add directory card"}
                </h2>
                <p className="text-xs text-gray-500">
                  {editingItem ? "Update the platform details and check cadence." : "Create a new platform, saved search, or portal."}
                </p>
              </div>
              <button
                onClick={() => setEditorOpen(false)}
                className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 px-5 py-5">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-600">Name</label>
                  <input
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none transition-colors focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/30"
                    value={form.name}
                    onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                    placeholder="Wellfound"
                    required
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-600">URL</label>
                  <input
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none transition-colors focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/30"
                    value={form.url}
                    onChange={(e) => setForm((f) => ({ ...f, url: e.target.value }))}
                    placeholder="https://..."
                    type="url"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-600">Category</label>
                  <select
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none transition-colors focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/30"
                    value={form.category}
                    onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                  >
                    {DIRECTORY_CATEGORIES.map((category) => (
                      <option key={category} value={category}>
                        {category.replace(/_/g, " ")}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-600">Status</label>
                  <select
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none transition-colors focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/30"
                    value={form.status}
                    onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
                  >
                    {DIRECTORY_STATUSES.map((status) => (
                      <option key={status} value={status}>
                        {status.charAt(0).toUpperCase() + status.slice(1)}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-600">Check every</label>
                  <input
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none transition-colors focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/30"
                    value={form.checkFrequencyDays}
                    onChange={(e) => setForm((f) => ({ ...f, checkFrequencyDays: e.target.value }))}
                    placeholder="14"
                    inputMode="numeric"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">Next action</label>
                <input
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none transition-colors focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/30"
                  value={form.nextAction}
                  onChange={(e) => setForm((f) => ({ ...f, nextAction: e.target.value }))}
                  placeholder="Check in on new matches"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">Notes</label>
                <textarea
                  className="min-h-24 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none transition-colors focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/30"
                  value={form.notes}
                  onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                  placeholder="Why this belongs here, what to check, any caveats."
                />
              </div>

              <div className="flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setEditorOpen(false)}
                  className="rounded-lg px-4 py-2 text-sm text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-900"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {saving ? "Saving..." : editingItem ? "Save changes" : "Add card"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setDeleteTarget(null)} />
          <div className="relative w-full max-w-md rounded-2xl bg-white shadow-2xl">
            <div className="border-b border-gray-200 px-5 py-4">
              <h2 className="text-base font-semibold text-gray-900">Delete directory card</h2>
              <p className="mt-1 text-sm text-gray-500">
                Remove <span className="font-medium text-gray-900">{deleteTarget.name}</span> from the directory.
              </p>
            </div>
            <div className="flex items-center justify-end gap-3 px-5 py-4">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="rounded-lg px-4 py-2 text-sm text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-900"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  void handleDeleteConfirmed();
                }}
                disabled={saving}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {saving ? "Deleting..." : "Delete card"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
