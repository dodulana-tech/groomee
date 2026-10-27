"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import AssistantText from "@/components/assistant/AssistantText";
import { useAssistantChat } from "@/components/assistant/useAssistantChat";
import { isSafeCustomerLink } from "@/lib/assistant/links";
import { trackedWhatsAppHref } from "@/lib/whatsapp-channel";

const STARTERS = [
  "Braids in Lekki tomorrow",
  "Bridal makeup quote",
  "Barber near me now",
  "Book in Abuja",
];

// Pages where a floating chat would get in the way of a live flow.
const HIDDEN_PREFIXES = ["/auth", "/booking/"];

export default function ConciergeWidget({ enabled }: { enabled: boolean }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const { messages, busy, error, send, conversationId } = useAssistantChat("/api/assistant");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages, open]);

  if (HIDDEN_PREFIXES.some((p) => pathname?.startsWith(p))) return null;

  function trackClick(href: string) {
    if (!conversationId.current) return;
    const body = JSON.stringify({ conversationId: conversationId.current, href });
    navigator.sendBeacon?.("/api/assistant/click", new Blob([body], { type: "application/json" }));
  }

  function renderLink(label: string, href: string, key: string) {
    const isWhatsApp = href.startsWith("/api/wa") || href.includes("wa.me");
    const className = `my-1 inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition-all hover:-translate-y-0.5 ${
      isWhatsApp ? "bg-[#25D366] text-gray-950" : "bg-[#53eb64] text-gray-950"
    }`;
    // /api/wa is a redirect endpoint, not a page — use a plain anchor.
    if (isWhatsApp) {
      return (
        <a key={key} href={href} target="_blank" rel="noopener noreferrer" onClick={() => trackClick(href)} className={className}>
          💬 {label}
        </a>
      );
    }
    return (
      <Link key={key} href={href} onClick={() => { trackClick(href); setOpen(false); }} className={className}>
        {label} →
      </Link>
    );
  }

  function submit(text: string) {
    setDraft("");
    void send(text);
  }

  return (
    <>
      {!open && (
        <button
          onClick={() => setOpen(true)}
          aria-label="Chat with the Groomee concierge"
          className="fixed bottom-20 right-4 z-40 flex items-center gap-2 rounded-full border border-white/15 bg-gray-950/85 py-3 pl-3 pr-4 text-sm font-bold text-white shadow-[0_8px_30px_rgba(0,0,0,0.35)] backdrop-blur-xl transition-all hover:-translate-y-0.5 lg:bottom-6 lg:right-6"
        >
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#53eb64] text-gray-950">✦</span>
          Find a pro
        </button>
      )}

      {open && (
        <div
          role="dialog"
          aria-label="Groomee concierge"
          className="fixed inset-x-3 bottom-20 z-50 flex max-h-[min(640px,calc(100dvh-7rem))] flex-col overflow-hidden rounded-2xl border border-white/10 bg-gray-950/90 text-white shadow-[0_20px_60px_rgba(0,0,0,0.45)] backdrop-blur-xl sm:inset-x-auto sm:right-6 sm:w-[400px] lg:bottom-6"
        >
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_70%_50%_at_20%_0%,rgba(83,235,100,0.14),transparent_60%)]" />

          <div className="relative flex items-center justify-between border-b border-white/10 px-4 py-3">
            <div>
              <p className="font-display text-sm font-black">
                Groomee concierge<span className="text-[#53eb64]">.</span>
              </p>
              <p className="text-[11px] text-white/40">Real pros, real prices — ask me anything</p>
            </div>
            <button
              onClick={() => setOpen(false)}
              aria-label="Close"
              className="flex h-8 w-8 items-center justify-center rounded-lg text-white/50 hover:bg-white/10 hover:text-white"
            >
              ✕
            </button>
          </div>

          {!enabled ? (
            <div className="relative space-y-3 p-5 text-sm text-white/70">
              <p>Tell us what you need and we&apos;ll match you with a vetted beauty pro.</p>
              <Link
                href="/search"
                onClick={() => setOpen(false)}
                className="flex w-full items-center justify-center rounded-xl bg-[#53eb64] py-3 text-sm font-bold text-gray-950"
              >
                Browse pros →
              </Link>
              <a
                href={trackedWhatsAppHref("assistant-fallback")}
                target="_blank"
                rel="noopener noreferrer"
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#25D366] py-3 text-sm font-bold text-gray-950"
              >
                💬 Chat with us on WhatsApp
              </a>
            </div>
          ) : (
            <>
              <div ref={scrollRef} className="relative flex-1 space-y-3 overflow-y-auto px-4 py-4 text-sm">
                {messages.length === 0 && (
                  <div className="space-y-3">
                    <p className="rounded-2xl rounded-tl-sm bg-white/[0.06] px-3.5 py-2.5 leading-relaxed text-white/85">
                      Hi! 👋 What are you looking for? Tell me the service, your area and when — I&apos;ll find pros who can come to you.
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {STARTERS.map((s) => (
                        <button
                          key={s}
                          onClick={() => submit(s)}
                          className="rounded-full border border-white/12 bg-white/[0.04] px-3 py-1.5 text-xs font-semibold text-white/75 transition hover:border-[#53eb64]/50 hover:text-white"
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {messages.map((m, i) =>
                  m.role === "user" ? (
                    <p key={i} className="ml-auto w-fit max-w-[85%] rounded-2xl rounded-tr-sm bg-[#53eb64] px-3.5 py-2 font-medium text-gray-950">
                      {m.content}
                    </p>
                  ) : (
                    <div key={i} className="max-w-[92%] rounded-2xl rounded-tl-sm bg-white/[0.06] px-3.5 py-2.5 leading-relaxed text-white/85">
                      {m.content ? (
                        <AssistantText text={m.content} isSafeLink={isSafeCustomerLink} renderLink={renderLink} />
                      ) : (
                        <span className="inline-flex gap-1 py-1" aria-label="Typing">
                          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-white/50" />
                          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-white/50 [animation-delay:120ms]" />
                          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-white/50 [animation-delay:240ms]" />
                        </span>
                      )}
                    </div>
                  ),
                )}

                {error && (
                  <div className="rounded-xl border border-amber-400/20 bg-amber-400/10 px-3 py-2 text-xs text-amber-100">
                    {error}{" "}
                    <a href={trackedWhatsAppHref("assistant-error")} target="_blank" rel="noopener noreferrer" className="font-bold underline">
                      WhatsApp us
                    </a>
                  </div>
                )}
              </div>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  submit(draft);
                }}
                className="relative flex items-center gap-2 border-t border-white/10 p-3"
              >
                <input
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  maxLength={2000}
                  placeholder="e.g. Knotless braids in Ikeja on Saturday"
                  className="min-w-0 flex-1 rounded-xl border border-white/12 bg-white/[0.06] px-3.5 py-2.5 text-base text-white placeholder:text-white/30 outline-none focus:border-[#53eb64]/60 sm:text-sm"
                />
                <button
                  type="submit"
                  disabled={busy || !draft.trim()}
                  className="rounded-xl bg-[#53eb64] px-4 py-2.5 text-sm font-bold text-gray-950 transition disabled:opacity-40"
                >
                  {busy ? "…" : "Send"}
                </button>
              </form>
            </>
          )}
        </div>
      )}
    </>
  );
}
