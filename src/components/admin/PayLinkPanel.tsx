"use client";

import { useState } from "react";

/**
 * Pay link with one-tap Copy and Send on WhatsApp. "Send on WhatsApp" opens
 * the ops person's own WhatsApp on the customer's chat with the message
 * prefilled, so the conversation carries on in the same thread.
 */
export default function PayLinkPanel({
  payUrl,
  message,
  whatsappUrl,
  fallbackSent,
  compact = false,
}: {
  payUrl: string;
  message: string;
  whatsappUrl: string;
  fallbackSent?: boolean;
  compact?: boolean;
}) {
  const [copied, setCopied] = useState<"link" | "message" | null>(null);

  async function copy(text: string, what: "link" | "message") {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // Older mobile browsers: fall back to a hidden textarea.
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
    }
    setCopied(what);
    setTimeout(() => setCopied(null), 2000);
  }

  return (
    <div className={compact ? "space-y-2" : "space-y-3"}>
      <div className="rounded-xl bg-gray-50 border border-gray-200 px-3 py-2">
        <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Pay link</p>
        <p className="mt-0.5 break-all font-mono text-xs text-gray-700">{payUrl}</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <a
          href={whatsappUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center rounded-xl bg-[#25D366] px-4 py-3 text-sm font-bold text-white active:scale-[0.98]"
        >
          Send on WhatsApp
        </a>
        <button
          type="button"
          onClick={() => copy(payUrl, "link")}
          className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-bold text-gray-800 active:scale-[0.98]"
        >
          {copied === "link" ? "Copied ✓" : "Copy link"}
        </button>
      </div>
      {!compact && (
        <button
          type="button"
          onClick={() => copy(message, "message")}
          className="w-full rounded-xl px-4 py-2 text-xs font-semibold text-gray-500 hover:bg-gray-100"
        >
          {copied === "message" ? "Message copied ✓" : "Copy full message"}
        </button>
      )}
      {fallbackSent !== undefined && (
        <p className="text-xs text-gray-400">
          {fallbackSent
            ? "Also sent to the customer from the Groomee WhatsApp number."
            : "Backup message from the Groomee number didn't go through, so send it from your WhatsApp."}
        </p>
      )}
    </div>
  );
}
