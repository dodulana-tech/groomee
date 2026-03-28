"use client";

import { useState } from "react";

interface Props {
  bookingId: string;
  proName: string;
  onClose: () => void;
}

const REVIEW_TAGS = [
  { label: "On time", emoji: "⏰" },
  { label: "Professional", emoji: "💼" },
  { label: "Great results", emoji: "✨" },
  { label: "Friendly", emoji: "😊" },
  { label: "Clean & tidy", emoji: "🧹" },
  { label: "Good value", emoji: "💰" },
];

const STAR_LABELS = ["", "Poor", "Fair", "Good", "Great", "Excellent"];

export default function ReviewModal({
  bookingId,
  proName,
  onClose,
}: Props) {
  const [rating, setRating] = useState(0);
  const [hovered, setHovered] = useState(0);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  function toggleTag(tag: string) {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag],
    );
  }

  async function handleSubmit() {
    if (!rating) return;
    setSubmitting(true);
    try {
      const reviewText = [
        selectedTags.length > 0 ? `Tags: ${selectedTags.join(", ")}` : "",
        comment,
      ]
        .filter(Boolean)
        .join("\n");

      const res = await fetch(`/api/bookings/${bookingId}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rating, comment: reviewText }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error ?? "Something went wrong");
        setSubmitting(false);
        return;
      }
      setDone(true);
      setTimeout(onClose, 2500);
    } finally {
      setSubmitting(false);
    }
  }

  const activeRating = hovered || rating;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-gray-900/70 backdrop-blur-sm p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Rate your booking"
        className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl animate-up"
      >
        {done ? (
          <div className="text-center py-8">
            <div className="text-5xl mb-3 animate-bounce">🎉</div>
            <p className="font-display text-xl font-bold text-gray-900 mb-1">
              Thanks for your review!
            </p>
            <p className="text-sm text-gray-500">
              Your feedback helps {proName.split(" ")[0]} and future customers.
            </p>
            <div className="mt-4 inline-flex items-center gap-2 bg-gradient-to-r from-brand-800 to-brand-400 text-white font-mono text-xs font-medium px-4 py-2 rounded-full">
              ⭐ +3 Groomee Points earned
            </div>
          </div>
        ) : (
          <>
            <h3 className="font-display text-xl font-bold text-gray-900 mb-1">
              Rate your booking
            </h3>
            <p className="text-sm text-gray-500 mb-5">
              How was your experience with {proName}?
            </p>

            {/* Stars */}
            <div className="flex items-center justify-center gap-3 mb-2">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  aria-label={`Rate ${star} out of 5`}
                  onMouseEnter={() => setHovered(star)}
                  onMouseLeave={() => setHovered(0)}
                  onClick={() => setRating(star)}
                  className={`text-4xl transition-all ${
                    star <= activeRating
                      ? "text-amber-400 scale-110"
                      : "text-gray-200 hover:text-gray-300"
                  }`}
                >
                  ★
                </button>
              ))}
            </div>
            {activeRating > 0 && (
              <p className="text-center text-sm font-semibold text-amber-600 mb-4">
                {STAR_LABELS[activeRating]}
              </p>
            )}

            {/* Tags */}
            {rating > 0 && (
              <>
                <p className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">
                  What stood out?
                </p>
                <div className="flex flex-wrap gap-2 mb-4">
                  {REVIEW_TAGS.map((tag) => {
                    const isSelected = selectedTags.includes(tag.label);
                    return (
                      <button
                        key={tag.label}
                        onClick={() => toggleTag(tag.label)}
                        className={`flex items-center gap-1.5 rounded-full border-2 px-3 py-1.5 text-xs font-semibold transition-all ${
                          isSelected
                            ? "border-brand-500 bg-brand-50 text-brand-700"
                            : "border-gray-200 bg-gray-50 text-gray-600 hover:border-gray-300"
                        }`}
                      >
                        {tag.emoji} {tag.label}
                      </button>
                    );
                  })}
                </div>

                <textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="Anything else you'd like to share? (optional)"
                  className="input resize-none mb-4"
                  rows={3}
                />
              </>
            )}

            <div className="flex gap-3">
              <button
                onClick={handleSubmit}
                disabled={!rating || submitting}
                className="btn-primary btn-lg flex-1"
              >
                {submitting ? "Submitting…" : "Submit review ⭐"}
              </button>
              <button onClick={onClose} className="btn-ghost btn-md">
                Skip
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
