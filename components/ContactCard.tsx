"use client";

import { useState } from "react";
import {
  Mail,
  Linkedin,
  Briefcase,
  CheckSquare,
  MoreHorizontal,
  Pencil,
  Trash2,
  ExternalLink,
} from "lucide-react";
import type { SerializedContact } from "@/lib/types";

interface ContactCardProps {
  contact: SerializedContact;
  onEdit: () => void;
  onDelete: () => void;
}

export function ContactCard({ contact, onEdit, onDelete }: ContactCardProps) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 hover:shadow-sm transition-all">
      {/* Header */}
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="min-w-0 flex-1">
          <div className="font-semibold text-sm text-gray-900">{contact.name}</div>
        </div>
        <div className="relative shrink-0">
          <button
            onClick={() => setMenuOpen((o) => !o)}
            className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
            aria-label="More actions"
          >
            <MoreHorizontal size={14} />
          </button>
          {menuOpen && (
            <div
              className="absolute right-0 top-7 z-20 w-40 rounded-lg border border-gray-200 bg-white py-1 text-sm shadow-lg"
              onMouseLeave={() => setMenuOpen(false)}
            >
              <button
                onClick={() => {
                  onEdit();
                  setMenuOpen(false);
                }}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-gray-700 hover:bg-gray-50"
              >
                <Pencil size={13} />
                Edit
              </button>
              <button
                onClick={() => {
                  onDelete();
                  setMenuOpen(false);
                }}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-red-600 hover:bg-red-50"
              >
                <Trash2 size={13} />
                Delete
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Title & Company */}
      {contact.title && (
        <p className="text-sm text-gray-500">{contact.title}</p>
      )}
      {contact.company && (
        <p className="text-sm text-gray-500">{contact.company}</p>
      )}

      {/* Email */}
      {contact.email && (
        <a
          href="https://mail.google.com/"
          target="_blank"
          rel="noopener noreferrer"
          className="mt-2 flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700"
        >
          <Mail size={14} className="shrink-0" />
          <span className="truncate">{contact.email}</span>
        </a>
      )}

      {/* LinkedIn */}
      {contact.linkedin && (
        <a
          href={contact.linkedin.startsWith("http") ? contact.linkedin : "#"}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-1 flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700"
        >
          <Linkedin size={14} className="shrink-0" />
          <span className="truncate">{contact.linkedin}</span>
          {contact.linkedin.startsWith("http") && (
            <ExternalLink size={12} className="shrink-0 text-gray-400" />
          )}
        </a>
      )}

      {/* Notes */}
      {contact.notes && (
        <p className="mt-2 text-sm text-gray-600 line-clamp-2">{contact.notes}</p>
      )}

      {/* Linked Jobs */}
      {(contact.linkedJobs?.length ?? 0) > 0 && (
        <div className="mt-3 space-y-1">
          {contact.linkedJobs.map((job) => (
            <div key={job.id} className="flex items-center gap-1.5 text-sm text-gray-500">
              <Briefcase size={14} className="shrink-0" />
              <span className="truncate">
                {job.title} @ {job.company}
              </span>
              <span className="inline-flex items-center rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-medium text-indigo-700 shrink-0">
                {job.role}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Open Actions Badge */}
      {(contact.openActionItemsCount ?? 0) > 0 && (
        <div className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
          <CheckSquare size={13} />
          {contact.openActionItemsCount} open {contact.openActionItemsCount === 1 ? "action" : "actions"}
        </div>
      )}
    </div>
  );
}
