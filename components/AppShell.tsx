"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { Sidebar } from "@/components/Sidebar";
import { ChatPanel } from "@/components/ChatPanel";

export function AppShell({ children }: { children: React.ReactNode }) {
  const [chatOpen, setChatOpen] = useState(false);
  const pathname = usePathname();

  if (pathname === "/login") {
    return <>{children}</>;
  }

  return (
    <div className="flex h-full">
      <Sidebar chatOpen={chatOpen} onChatToggle={() => setChatOpen((v) => !v)} />
      <main
        className="flex-1 min-h-screen min-w-0 overflow-y-auto transition-all duration-200"
        style={{ marginRight: chatOpen ? "360px" : "0" }}
      >
        {children}
      </main>
      <ChatPanel open={chatOpen} onClose={() => setChatOpen((v) => !v)} />
    </div>
  );
}
