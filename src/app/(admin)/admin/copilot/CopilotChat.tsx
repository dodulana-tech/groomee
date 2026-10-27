"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import AssistantText from "@/components/assistant/AssistantText";
import { useAssistantChat } from "@/components/assistant/useAssistantChat";
import { isSafeAdminLink } from "@/lib/assistant/links";

const STARTERS = [
  "How did last week compare to the week before?",
  "Which bookings found no pro in the last 7 days, and where?",
  "List open disputes, oldest first",
  "Look up booking GRM-",
  "Draft a WhatsApp apology for a late pro on booking GRM-",
];

export default function CopilotChat() {
  const { messages, busy, error, send, reset } = useAssistantChat("/api/admin/assistant");
  const [draft, setDraft] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages]);

  function submit(text: string) {
    setDraft("");
    void send(text);
  }

  function renderLink(label: string, href: string, key: string) {
    return (
      <Link key={key} href={href} className="font-semibold text-green-700 underline decoration-green-300 underline-offset-2 hover:text-green-800">
        {label}
      </Link>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col rounded-2xl border border-gray-100 bg-white shadow-sm">
      <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto p-5 text-sm">
        {messages.length === 0 && (
          <div className="space-y-3">
            <p className="text-gray-500">Try one of these:</p>
            <div className="flex flex-wrap gap-2">
              {STARTERS.map((s) => (
                <button
                  key={s}
                  onClick={() => {
                    // Prompts ending in a reference prefix need the admin to finish them.
                    if (s.endsWith("GRM-")) {
                      setDraft(s);
                      inputRef.current?.focus();
                    } else submit(s);
                  }}
                  className="rounded-full border border-gray-200 bg-gray-50 px-3 py-1.5 text-xs font-medium text-gray-700 hover:border-green-300 hover:bg-green-50"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m, i) =>
          m.role === "user" ? (
            <p key={i} className="ml-auto w-fit max-w-[80%] whitespace-pre-wrap rounded-2xl rounded-tr-sm bg-gray-900 px-4 py-2.5 text-white">
              {m.content}
            </p>
          ) : (
            <div key={i} className="max-w-[90%] rounded-2xl rounded-tl-sm border border-gray-100 bg-gray-50 px-4 py-3 leading-relaxed text-gray-800">
              {m.content ? (
                <AssistantText text={m.content} isSafeLink={isSafeAdminLink} renderLink={renderLink} />
              ) : (
                <span className="text-gray-400">Looking that up…</span>
              )}
            </div>
          ),
        )}

        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{error}</div>
        )}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit(draft);
        }}
        className="flex items-end gap-2 border-t border-gray-100 p-3"
      >
        <textarea
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              submit(draft);
            }
          }}
          rows={1}
          maxLength={2000}
          placeholder="Ask the copilot…"
          className="max-h-40 min-h-[44px] flex-1 resize-y rounded-xl border border-gray-200 px-3.5 py-2.5 text-sm outline-none focus:border-green-400 focus:ring-2 focus:ring-green-100"
        />
        {messages.length > 0 && (
          <button
            type="button"
            onClick={reset}
            className="rounded-xl border border-gray-200 px-3 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50"
          >
            New
          </button>
        )}
        <button
          type="submit"
          disabled={busy || !draft.trim()}
          className="rounded-xl bg-gray-900 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-40"
        >
          {busy ? "…" : "Ask"}
        </button>
      </form>
    </div>
  );
}
