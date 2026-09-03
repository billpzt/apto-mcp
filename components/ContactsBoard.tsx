"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, X, Loader2, AlertCircle } from "lucide-react";
import { ContactCard } from "./ContactCard";
import type { SerializedContact } from "@/lib/types";

type ContactForm = {
  name: string;
  title: string;
  company: string;
  email: string;
  linkedin: string;
  notes: string;
};

function createEmptyForm(): ContactForm {
  return {
    name: "",
    title: "",
    company: "",
    email: "",
    linkedin: "",
    notes: "",
  };
}

function formFromContact(contact: SerializedContact): ContactForm {
  return {
    name: contact.name,
    title: contact.title ?? "",
    company: contact.company ?? "",
    email: contact.email ?? "",
    linkedin: contact.linkedin ?? "",
    notes: contact.notes ?? "",
  };
}

interface ContactsBoardProps {
  initialContacts: SerializedContact[];
}

export default function ContactsBoard({ initialContacts }: ContactsBoardProps) {
  const router = useRouter();
  const [contacts, setContacts] = useState(initialContacts);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<SerializedContact | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<SerializedContact | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<ContactForm>(createEmptyForm());

  function openCreate() {
    setError(null);
    setEditingContact(null);
    setForm(createEmptyForm());
    setEditorOpen(true);
  }

  function openEdit(contact: SerializedContact) {
    setError(null);
    setEditingContact(contact);
    setForm(formFromContact(contact));
    setEditorOpen(true);
  }

  function closeEditor() {
    setEditorOpen(false);
    setEditingContact(null);
    setForm(createEmptyForm());
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) return;

    setSaving(true);
    setError(null);
    try {
      const isEditing = editingContact !== null;
      const url = isEditing ? `/api/contacts/${editingContact.id}` : "/api/contacts";
      const res = await fetch(url, {
        method: isEditing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          title: form.title || null,
          company: form.company || null,
          email: form.email || null,
          linkedin: form.linkedin || null,
          notes: form.notes || null,
        }),
      });

      if (!res.ok) {
        throw new Error((await res.json()).error ?? "Could not save contact");
      }

      const saved: SerializedContact = await res.json();
      setContacts((prev) =>
        isEditing
          ? prev.map((c) =>
              c.id === saved.id
                ? { ...saved, linkedJobs: c.linkedJobs, openActionItemsCount: c.openActionItemsCount }
                : c
            )
          : [{ ...saved, linkedJobs: [], openActionItemsCount: 0 }, ...prev]
      );
      closeEditor();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save contact");
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteConfirmed() {
    if (!deleteTarget) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/contacts/${deleteTarget.id}`, { method: "DELETE" });
      if (!res.ok) {
        throw new Error((await res.json()).error ?? "Could not delete contact");
      }
      setContacts((prev) => prev.filter((c) => c.id !== deleteTarget.id));
      setDeleteTarget(null);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete contact");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex-1 overflow-y-auto p-6">
      {/* Header */}
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-lg font-semibold text-gray-900">Contacts</h1>
          <p className="mt-1 text-sm text-gray-500">
            Recruiters, hiring managers, and professional connections.
          </p>
        </div>
        <button
          onClick={openCreate}
          className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-slate-800"
        >
          <Plus size={15} />
          Add contact
        </button>
      </div>

      {/* Error banner */}
      {error && (
        <div className="mb-4 flex items-center justify-between rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
          <span className="flex items-center gap-2">
            <AlertCircle size={15} />
            {error}
          </span>
          <button
            onClick={() => setError(null)}
            className="rounded p-0.5 text-red-500 transition-colors hover:text-red-700"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* Empty state */}
      {contacts.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-gray-300 bg-white/80 px-6 py-16 text-center">
          <span className="text-base font-medium text-gray-900">
            No contacts yet
          </span>
          <p className="mt-1 max-w-sm text-sm text-gray-500">
            Add your first contact to start building your network.
          </p>
          <button
            onClick={openCreate}
            className="mt-4 inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-slate-800"
          >
            <Plus size={15} />
            Add contact
          </button>
        </div>
      ) : (
        /* Card grid */
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {contacts.map((contact) => (
            <ContactCard
              key={contact.id}
              contact={contact}
              onEdit={() => openEdit(contact)}
              onDelete={() => setDeleteTarget(contact)}
            />
          ))}
        </div>
      )}

      {/* Editor modal */}
      {editorOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={closeEditor} />
          <div className="relative w-full max-w-xl rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4">
              <div>
                <h2 className="text-base font-semibold text-gray-900">
                  {editingContact ? "Edit contact" : "Add contact"}
                </h2>
                <p className="text-xs text-gray-500">
                  {editingContact
                    ? "Update contact details."
                    : "Add a recruiter, hiring manager, or connection."}
                </p>
              </div>
              <button
                onClick={closeEditor}
                className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 px-5 py-5">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-600">
                    Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none transition-colors focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/30"
                    value={form.name}
                    onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                    placeholder="Jane Smith"
                    required
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-600">Title</label>
                  <input
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none transition-colors focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/30"
                    value={form.title}
                    onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                    placeholder="Senior Recruiter"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-600">Company</label>
                  <input
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none transition-colors focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/30"
                    value={form.company}
                    onChange={(e) => setForm((f) => ({ ...f, company: e.target.value }))}
                    placeholder="Acme Corp"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-600">Email</label>
                  <input
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none transition-colors focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/30"
                    value={form.email}
                    onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                    placeholder="jane@acme.com"
                    type="email"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">LinkedIn</label>
                <input
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none transition-colors focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/30"
                  value={form.linkedin}
                  onChange={(e) => setForm((f) => ({ ...f, linkedin: e.target.value }))}
                  placeholder="https://linkedin.com/in/janesmith"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">Notes</label>
                <textarea
                  className="min-h-24 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none transition-colors focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/30"
                  value={form.notes}
                  onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                  placeholder="Context about this connection, how you met, follow-up reminders."
                />
              </div>

              <div className="flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={closeEditor}
                  className="rounded-lg px-4 py-2 text-sm text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-900"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {saving && <Loader2 size={14} className="animate-spin" />}
                  {saving ? "Saving..." : editingContact ? "Save changes" : "Add contact"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete confirmation modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setDeleteTarget(null)} />
          <div className="relative w-full max-w-md rounded-2xl bg-white shadow-2xl">
            <div className="border-b border-gray-200 px-5 py-4">
              <h2 className="text-base font-semibold text-gray-900">Delete contact?</h2>
              <p className="mt-1 text-sm text-gray-500">
                Are you sure you want to delete{" "}
                <span className="font-medium text-gray-900">{deleteTarget.name}</span>?
                This cannot be undone.
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
                {saving ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
