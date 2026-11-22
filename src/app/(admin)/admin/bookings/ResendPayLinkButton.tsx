"use client";

import { useState } from "react";
import PayLinkPanel from "@/components/admin/PayLinkPanel";

type Result = { payUrl: string; message: string; whatsappUrl: string; fallbackSent: boolean; reused: boolean };

/** "Resend payment link" for an unpaid booking in the admin list. */
export default function ResendPayLinkButton({ bookingId }: { bookingId: string }) {
  const [state, setState] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState("");

  async function resend() {
    setState("loading");
    setError("");
    try {
      const res = await fetch(`/api/admin/bookings/${bookingId}/payment-link`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ send: true }),
      });
      const d = await res.json();
      if (!d.success) {
        setError(d.error ?? "Couldn't get a pay link.");
        setState("error");
        return;
      }
      setResult(d.data);
      setState("done");
    } catch {
      setError("Network error.");
      setState("error");
    }
  }

  if (state === "done" && result) {
    return (
      <div className="mt-3 w-full" onClick={(e) => e.stopPropagation()}>
        <PayLinkPanel compact payUrl={result.payUrl} message={result.message} whatsappUrl={result.whatsappUrl} fallbackSent={result.fallbackSent} />
      </div>
    );
  }

  return (
    <div onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        onClick={resend}
        disabled={state === "loading"}
        className="rounded-lg bg-[#25D366]/10 px-3 py-1.5 text-xs font-bold text-[#128C7E] hover:bg-[#25D366]/20 disabled:opacity-50"
      >
        {state === "loading" ? "Getting link…" : "Resend payment link"}
      </button>
      {state === "error" && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}
