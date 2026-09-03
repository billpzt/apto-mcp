"use client";

import { usePathname } from "next/navigation";
import { Sidebar } from "@/components/Sidebar";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  if (pathname === "/login") {
    return <>{children}</>;
  }

  return (
    <div className="flex h-full">
      <Sidebar />
      <main className="flex-1 min-h-screen min-w-0 overflow-y-auto">
        {children}
      </main>
    </div>
  );
}
