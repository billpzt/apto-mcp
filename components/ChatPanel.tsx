"use client";

import { useState, useRef, useEffect } from "react";
import { MessageSquare, ChevronRight, Send, Loader2, CheckCircle, XCircle } from "lucide-react";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface ActionResult {
  action: string;
  success: boolean;
  message: string;
}

interface SystemNotice {
  role: "system";
  results: ActionResult[];
}

type ChatEntry = Message | SystemNotice;

function isSystemNotice(entry: ChatEntry): entry is SystemNotice {
  return (entry as SystemNotice).role === "system";
}

export function ChatToggleButton({
  open,
  onClick,
}: {
  open: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      title="AI Assistant"
      className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors w-full ${
        open
          ? "bg-white/10 text-[var(--sidebar-fg)] font-medium"
          : "text-[var(--sidebar-muted)] hover:bg-white/5 hover:text-[var(--sidebar-fg)]"
      }`}
    >
      <MessageSquare size={15} />
      AI Assistant
    </button>
  );
}

const GREETING: Message = {
  role: "assistant",
  content:
    "Hi Bill! I have your full pipeline, contacts, and action items loaded. Ask me to draft a follow-up, score a JD, update a job status, or tell you what's stale.",
};

export function ChatPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [entries, setEntries] = useState<ChatEntry[]>([GREETING]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Derive clean Message[] to send as history (exclude system notices)
  const messageHistory = (): Message[] =>
    entries.filter((e): e is Message => !isSystemNotice(e));

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [entries]);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 150);
  }, [open]);

  async function executeActions(
    actions: Array<{ action: string; [key: string]: unknown }>
  ): Promise<ActionResult[]> {
    try {
      const res = await fetch("/api/assistant/actions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(actions),
      });
      const data = await res.json();
      return data.results ?? [];
    } catch {
      return actions.map((a) => ({
        action: a.action,
        success: false,
        message: "Network error executing action",
      }));
    }
  }

  async function sendMessage() {
    const text = input.trim();
    if (!text || loading) return;

    const userMsg: Message = { role: "user", content: text };
    const nextEntries: ChatEntry[] = [...entries, userMsg];
    setEntries(nextEntries);
    setInput("");
    setLoading(true);

    try {
      // Build message history (user + assistant turns only, no system notices)
      const history: Message[] = [
        ...messageHistory(),
        userMsg,
      ];

      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: history }),
      });
      const data = await res.json();

      if (data.error) {
        setEntries([...nextEntries, { role: "assistant", content: `Error: ${data.error}` }]);
        return;
      }

      const assistantMsg: Message = { role: "assistant", content: data.reply };
      const withReply: ChatEntry[] = [...nextEntries, assistantMsg];

      // If the AI returned write-back actions, execute them and show a notice
      if (data.actions?.length) {
        setEntries(withReply); // show reply first
        const results = await executeActions(data.actions);
        setEntries([...withReply, { role: "system", results }]);
      } else {
        setEntries(withReply);
      }
    } catch {
      setEntries([
        ...nextEntries,
        { role: "assistant", content: "Network error — is the dev server running?" },
      ]);
    } finally {
      setLoading(false);
    }
  }

  function onKey(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  function reset() {
    setEntries([GREETING]);
  }

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 z-30 bg-black/20 lg:hidden"
          onClick={onClose}
        />
      )}

      <div
        className={`fixed top-0 right-0 h-full z-40 flex flex-col transition-transform duration-200 ease-in-out ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
        style={{
          width: "360px",
          background: "var(--sidebar)",
          borderLeft: "1px solid #21262d",
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-4 h-14 shrink-0 border-b"
          style={{ borderColor: "#21262d" }}
        >
          <div className="flex items-center gap-2">
            <MessageSquare size={15} className="text-indigo-400" />
            <span className="text-sm font-medium text-[var(--sidebar-fg)]">AI Assistant</span>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={reset}
              className="text-xs px-2 py-1 rounded text-[var(--sidebar-muted)] hover:text-[var(--sidebar-fg)] hover:bg-white/5 transition-colors"
            >
              Clear
            </button>
            <button
              onClick={onClose}
              className="p-1 rounded text-[var(--sidebar-muted)] hover:text-[var(--sidebar-fg)] hover:bg-white/5 transition-colors"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
          {entries.map((entry, i) => {
            if (isSystemNotice(entry)) {
              return (
                <div key={i} className="space-y-1">
                  {entry.results.map((r, j) => (
                    <div
                      key={j}
                      className={`flex items-start gap-2 text-xs px-3 py-2 rounded-md border ${
                        r.success
                          ? "bg-emerald-950/40 border-emerald-800/40 text-emerald-300"
                          : "bg-red-950/40 border-red-800/40 text-red-300"
                      }`}
                    >
                      {r.success ? (
                        <CheckCircle size={12} className="shrink-0 mt-0.5" />
                      ) : (
                        <XCircle size={12} className="shrink-0 mt-0.5" />
                      )}
                      <span>{r.message}</span>
                    </div>
                  ))}
                </div>
              );
            }

            return (
              <div
                key={i}
                className={`flex ${entry.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[85%] rounded-lg px-3 py-2 text-sm whitespace-pre-wrap leading-relaxed ${
                    entry.role === "user"
                      ? "bg-indigo-600 text-white"
                      : "bg-white/5 text-[var(--sidebar-fg)] border border-white/10"
                  }`}
                >
                  {entry.content}
                </div>
              </div>
            );
          })}

          {loading && (
            <div className="flex justify-start">
              <div className="bg-white/5 border border-white/10 rounded-lg px-3 py-2">
                <Loader2 size={14} className="text-[var(--sidebar-muted)] animate-spin" />
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div className="shrink-0 p-3 border-t" style={{ borderColor: "#21262d" }}>
          <div className="flex gap-2 items-end">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={onKey}
              placeholder="Ask about your pipeline..."
              rows={2}
              className="flex-1 resize-none rounded-md px-3 py-2 text-sm bg-white/5 border border-white/10 text-[var(--sidebar-fg)] placeholder:text-[var(--sidebar-muted)] focus:outline-none focus:border-indigo-500 transition-colors"
            />
            <button
              onClick={sendMessage}
              disabled={!input.trim() || loading}
              className="p-2 rounded-md bg-indigo-600 text-white hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shrink-0"
            >
              <Send size={15} />
            </button>
          </div>
          <p className="text-[10px] text-[var(--sidebar-muted)] mt-1.5 text-center">
            Enter to send · Shift+Enter for newline
          </p>
        </div>
      </div>

      {!open && (
        <button
          onClick={onClose}
          className="fixed right-0 top-1/2 -translate-y-1/2 z-30 flex items-center gap-1.5 px-2 py-3 rounded-l-md text-xs font-medium text-[var(--sidebar-muted)] hover:text-[var(--sidebar-fg)] transition-colors"
          style={{ background: "var(--sidebar)", border: "1px solid #21262d", borderRight: "none" }}
        >
          <MessageSquare size={13} />
        </button>
      )}
    </>
  );
}
