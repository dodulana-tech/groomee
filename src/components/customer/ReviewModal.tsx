"use client";

import { useState } from "react";

interface Props {
  bookingId: string;
  groomerName: string;
  onClose: () => void;
}

export default function ReviewModal({
  bookingId,
  groomerName,
  onClose,
}: Props) {
  const [rating, setRating] = useState(0);
  const [hovered, setHovered] = useState(0);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  async function handleSubmit() {
    if (!rating) return;
    setSubmitting(true);
    try {
      await fetch(`/api/bookings/${bookingId}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rating, comment }),
      });
      setDone(true);
      setTimeout(onClose, 2000);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl animate-up">
        {done ? (
          <div className="text-center py-4">
            <p className="text-4xl mb-2">🎉</p>
            <p className="font-semibold text-gray-900">
              Thanks for your review!
            </p>
          </div>
        ) : (
          <>
            <h3 className="font-display text-lg font-bold text-gray-900 mb-1">
              Rate your session
            </h3>
            <p className="text-sm text-gray-500 mb-5">
              How was your experience with {groomerName}?
            </p>

            {/* Stars */}
            <div className="flex justify-center gap-2 mb-5">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  onMouseEnter={() => setHovered(star)}
                  onMouseLeave={() => setHovered(0)}
                  onClick={() => setRating(star)}
                  className="text-3xl transition-transform hover:scale-110"
                >
                  {star <= (hovered || rating) ? "★" : "☆"}
                </button>
              ))}
            </div>

            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Tell others about your experience (optional)"
              className="input resize-none mb-4"
              rows={3}
            />

            <div className="flex gap-3">
              <button
                onClick={handleSubmit}
                disabled={!rating || submitting}
                className="btn-primary btn-md flex-1"
              >
                {submitting ? "Submitting…" : "Submit review"}
              </button>
              <button onClick={onClose} className="btn-secondary btn-md">
                Skip
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
