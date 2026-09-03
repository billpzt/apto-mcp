"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { CheckCircle, ExternalLink, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import type { SerializedDirectoryItem } from "@/lib/types";
import { safeUrl } from "@/lib/url";

function formatDate(iso: string | null) {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function DirectoryItemCard({
  item,
  onEdit,
  onDelete,
  onChange,
}: {
  item: SerializedDirectoryItem;
  onEdit: () => void;
  onDelete: () => void;
  onChange: (item: SerializedDirectoryItem) => void;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  const markChecked = async () => {
    setError(null);
    const res = await fetch(`/api/directory/${item.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lastCheckedAt: new Date().toISOString() }),
    });
    if (!res.ok) {
      setError((await res.json()).error ?? "Could not mark checked");
      return;
    }
    onChange(await res.json());
    router.refresh();
  };

  const statusColors: Record<string, { bg: string; text: string; label: string }> = {
    active: { bg: "#ecfdf5", text: "#059669", label: "Active" },
    passive: { bg: "#f5f3ff", text: "#7c3aed", label: "Passive" },
    paused: { bg: "#fffbeb", text: "#d97706", label: "Paused" },
    skip: { bg: "#f1f5f9", text: "#64748b", label: "Skip" },
  };
  const sc = statusColors[item.status] ?? { bg: "#f1f5f9", text: "#64748b", label: item.status };

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 hover:shadow-sm transition-all">
      {/* Header */}
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="min-w-0 flex-1">
          <div className="font-semibold text-sm text-gray-900">{item.name}</div>
          <div className="text-xs text-gray-500 mt-0.5 capitalize">{item.category.replace(/_/g, " ")}</div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {safeUrl(item.url) && (
            <a
              href={safeUrl(item.url)}
              target="_blank"
              rel="noopener noreferrer"
              className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
              aria-label="Open link"
            >
              <ExternalLink size={14} />
            </a>
          )}
          <div className="relative">
            <button
              onClick={() => setMenuOpen((open) => !open)}
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
          <span
            className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium"
            style={{ backgroundColor: sc.bg, color: sc.text }}
          >
            {sc.label}
          </span>
        </div>
      </div>

      {/* Next action */}
      {item.nextAction && (
        <p className="text-xs text-gray-600 mb-3">{item.nextAction}</p>
      )}
      {error && (
        <p className="mb-3 rounded-md border border-red-200 bg-red-50 px-2 py-1.5 text-xs text-red-700">
          {error}
        </p>
      )}

      {/* Mark checked button + last checked */}
      <div className="flex items-center justify-between border-t border-gray-100 pt-3">
        <button
          onClick={markChecked}
          className="inline-flex items-center gap-1 text-xs font-medium text-teal-600 hover:text-teal-700 transition-colors"
        >
          <CheckCircle size={12} />
          Mark checked
        </button>
        <div className="text-[11px] text-gray-400">
          {item.lastCheckedAt
            ? `Last checked ${formatDate(item.lastCheckedAt)}`
            : `Added ${formatDate(item.createdAt) ?? ""}`}
          {item.checkFrequencyDays && (
            <span className="ml-1">· Every {item.checkFrequencyDays}d</span>
          )}
        </div>
      </div>

      {/* Notes */}
      {item.notes && (
        <p className="mt-2 text-[11px] text-gray-500 line-clamp-2 pt-2 border-t border-gray-50">
          {item.notes}
        </p>
      )}
    </div>
  );
}
