"use client";

import { useState } from "react";

const SITE = typeof window !== "undefined" ? window.location.origin : "https://groomeeapp.com";

export default function ReviewForm({
  token,
  alreadyRated,
  canReview,
  proName,
  googleReviewUrl,
  referralCode,
}: {
  token: string;
  alreadyRated: number | null;
  canReview: boolean;
  proName: string | null;
  googleReviewUrl: string | null;
  referralCode: string;
}) {
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [state, setState] = useState<"idle" | "saving" | "done" | "error">(alreadyRated ? "done" : "idle");
  const [error, setError] = useState("");
  const [given, setGiven] = useState<number | null>(alreadyRated);

  const shareText = `I book my beauty pros at home with Groomee. Try it: ${SITE}/?ref=${referralCode}&utm_source=referral`;

  async function submit() {
    if (!rating) { setError("Tap a star to rate."); return; }
    setState("saving"); setError("");
    try {
      const res = await fetch(`/api/reviews/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rating, comment: comment.trim() || undefined }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok && j.code !== "ALREADY") throw new Error(j.error ?? "Couldn't save your review.");
      setGiven(j.data?.rating ?? rating);
      setState("done");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Couldn't save your review.");
      setState("error");
    }
  }

  if (!canReview && !alreadyRated) {
    return <p className="mt-6 text-white/70">You can rate this booking once the job is confirmed. Thank you!</p>;
  }

  if (state === "done") {
    return (
      <div className="mt-8 space-y-4">
        <p className="text-lg text-white">Thank you{given ? ` for the ${given}-star rating` : ""}! 💚</p>
        {given && given >= 4 && googleReviewUrl && (
          <a href={googleReviewUrl} target="_blank" rel="noopener noreferrer"
            className="block rounded-xl bg-white px-5 py-4 text-center font-bold text-gray-950">
            Share it on Google too
          </a>
        )}
        {given && given >= 4 && (
          <a href={`https://wa.me/?text=${encodeURIComponent(shareText)}`} target="_blank" rel="noopener noreferrer"
            className="block rounded-xl bg-[#25D366] px-5 py-4 text-center font-bold text-gray-950">
            Tell a friend on WhatsApp
          </a>
        )}
      </div>
    );
  }

  return (
    <div className="mt-8 space-y-5">
      <div className="flex gap-2" role="radiogroup" aria-label="Rating">
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} type="button" role="radio" aria-checked={rating === n} aria-label={`${n} star${n > 1 ? "s" : ""}`}
            onClick={() => setRating(n)}
            className={`h-14 w-14 rounded-xl text-3xl transition ${n <= rating ? "bg-[#fffea1]" : "bg-white/10"}`}>
            {n <= rating ? "★" : "☆"}
          </button>
        ))}
      </div>
      <label className="block">
        <span className="text-sm text-white/70">Anything to add? (optional)</span>
        <textarea value={comment} onChange={(e) => setComment(e.target.value)} maxLength={1000} rows={3}
          className="mt-2 w-full rounded-xl border border-white/15 bg-white/5 p-3 text-white placeholder-white/30"
          placeholder={proName ? `What did ${proName} do well?` : "What went well?"} />
      </label>
      {error && <p className="text-sm text-red-300">{error}</p>}
      <button type="button" onClick={submit} disabled={state === "saving"}
        className="w-full rounded-xl bg-[#25D366] px-5 py-4 font-bold text-gray-950 disabled:opacity-60">
        {state === "saving" ? "Saving…" : "Send rating"}
      </button>
    </div>
  );
}
