"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Briefcase,
  Globe,
  BarChart3,
  Star,
  Users,
  FileText,
  PenSquare,
  Settings,
  Zap,
  LogOut,
  HelpCircle,
} from "lucide-react";

const nav = [
  { href: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
  { href: "/jobs", icon: Briefcase, label: "Jobs" },
  { href: "/cover-letter", icon: PenSquare, label: "Cover Letter" },
  { href: "/insights", icon: BarChart3, label: "Insights" },
  { href: "/platforms", icon: Globe, label: "Directory" },
  { href: "/skills", icon: Star, label: "Skills" },
  { href: "/contacts", icon: Users, label: "Contacts" },
  { href: "/resume", icon: FileText, label: "Resume" },
  { href: "/help", icon: HelpCircle, label: "Help" },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside
      className="flex flex-col w-56 shrink-0 h-screen sticky top-0"
      style={{ background: "var(--sidebar)", borderRight: "1px solid #21262d" }}
    >
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-5 h-14 border-b border-[#21262d]">
        <div className="w-6 h-6 rounded-md bg-indigo-500 flex items-center justify-center">
          <Zap size={14} className="text-white" />
        </div>
        <span className="font-semibold text-sm tracking-wide text-[var(--sidebar-fg)]">
          Apto
        </span>
        <span className="ml-auto text-[10px] font-medium px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-400">
          beta
        </span>
      </div>

      {/* Nav */}
      <nav className="flex flex-col gap-0.5 p-2 flex-1 mt-2">
        {nav.map(({ href, icon: Icon, label }) => {
          const active =
            href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors ${
                active
                  ? "bg-white/10 text-[var(--sidebar-fg)] font-medium"
                  : "text-[var(--sidebar-muted)] hover:bg-white/5 hover:text-[var(--sidebar-fg)]"
              }`}
            >
              <Icon size={15} />
              {label}
            </Link>
          );
        })}
      </nav>

      {/* Settings + Logout */}
      <div className="p-2 border-t border-[#21262d]">
        <Link
          href="/settings"
          className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors ${
            pathname === "/settings"
              ? "bg-white/10 text-[var(--sidebar-fg)] font-medium"
              : "text-[var(--sidebar-muted)] hover:bg-white/5 hover:text-[var(--sidebar-fg)]"
          }`}
        >
          <Settings size={15} />
          Settings
        </Link>
        <div className="mt-2 mx-1 px-3 py-2.5 rounded-md bg-white/5 text-xs text-[var(--sidebar-muted)]">
          <div className="font-medium text-[var(--sidebar-fg)] mb-0.5">
            {process.env.NEXT_PUBLIC_OWNER_NAME || "Apto"}
          </div>
          <div className="truncate">
            {process.env.NEXT_PUBLIC_OWNER_EMAIL || "Signed in"}
          </div>
          <button
            onClick={async () => {
              await fetch("/api/auth/logout", { method: "POST" });
              window.location.href = new URL("/login", window.location.origin).toString();
            }}
            className="mt-2 flex items-center gap-1.5 text-[var(--sidebar-muted)] hover:text-red-400 transition-colors"
          >
            <LogOut size={11} />
            Log out
          </button>
        </div>
      </div>
    </aside>
  );
}
