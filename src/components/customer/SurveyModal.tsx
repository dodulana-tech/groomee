"use client";

import { useState } from "react";

interface Props {
  type: "customer" | "vendor";
  onClose: () => void;
}

const CUSTOMER_QUESTIONS = [
  {
    label: "1. Where are you based?",
    options: [
      "Lagos — Island (Lekki, VI, Ikoyi)",
      "Lagos — Mainland (Yaba, Surulere, Ikeja)",
      "Abuja",
      "Other city",
    ],
  },
  {
    label: "2. Which beauty services do you book most often?",
    multi: true,
    options: [
      "Hair (braids, weaves, styling)",
      "Makeup",
      "Nails",
      "Lashes",
      "Barbing / beard grooming",
      "Skincare / facials",
    ],
  },
  {
    label: "3. How do you currently find and book beauty professionals?",
    options: [
      "I have a regular person I always use",
      "I find someone on Instagram each time",
      "I go to a salon / shop near me",
      "I get referrals from friends",
      "It's always a scramble — no system",
    ],
  },
  {
    label: "4. How often do you have a last-minute beauty emergency?",
    options: [
      "Rarely — maybe once or twice a year",
      "Occasionally — a few times a year",
      "Regularly — at least once a month",
      "Constantly — it's a running theme",
    ],
  },
  {
    label: "5. What is your single biggest frustration when trying to book a beauty service?",
    freeText: true,
    placeholder:
      "e.g. Pros cancel last minute, hard to find someone I trust, prices are always different…",
  },
];

const VENDOR_QUESTIONS = [
  {
    label: "1. Where is your business based?",
    options: [
      "Lagos — Island (Lekki, VI, Ikoyi)",
      "Lagos — Mainland (Yaba, Surulere, Ikeja)",
      "Abuja",
      "Other city",
    ],
  },
  {
    label: "2. Which services do you offer?",
    multi: true,
    options: [
      "Hair styling (braids, weaves, natural)",
      "Makeup",
      "Nails",
      "Lashes",
      "Barbing / beard grooming",
      "Skincare / facials",
    ],
  },
  {
    label: "3. What is your average charge for your main service?",
    options: [
      "Under ₦5,000",
      "₦5,000 — ₦15,000",
      "₦15,000 — ₦40,000",
      "₦40,000 — ₦100,000",
      "Above ₦100,000",
    ],
  },
  {
    label: "4. How do you currently manage your bookings?",
    options: [
      "WhatsApp messages and calls",
      "Instagram DMs",
      "Walk-ins only",
      "I use a booking platform",
      "Mostly referrals — no system",
    ],
  },
  {
    label: "5. What would make you most excited to join Groomee?",
    freeText: true,
    placeholder:
      "e.g. Consistent bookings, fair pay, less price negotiation, access to corporate clients…",
  },
];

export default function SurveyModal({ type, onClose }: Props) {
  const questions = type === "customer" ? CUSTOMER_QUESTIONS : VENDOR_QUESTIONS;
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Record<number, string | string[]>>({});
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  const q = questions[step];
  const isLast = step === questions.length - 1;
  const pct = ((step + 1) / questions.length) * 100;

  function selectOption(opt: string) {
    if (q.multi) {
      const current = (answers[step] as string[]) ?? [];
      if (current.includes(opt)) {
        setAnswers({ ...answers, [step]: current.filter((o) => o !== opt) });
      } else {
        setAnswers({ ...answers, [step]: [...current, opt] });
      }
    } else {
      setAnswers({ ...answers, [step]: opt });
    }
  }

  function setFreeText(text: string) {
    setAnswers({ ...answers, [step]: text });
  }

  async function submit() {
    setLoading(true);
    try {
      await fetch("/api/surveys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, answers }),
      });
      setSubmitted(true);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/70 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div role="dialog" aria-modal="true" aria-label="Quick survey" className="w-full max-w-lg rounded-3xl bg-white shadow-2xl overflow-hidden relative">
        {/* Top bar */}
        <div
          className={`h-1 ${
            type === "customer"
              ? "bg-gradient-to-r from-brand-800 to-brand-400"
              : "bg-gradient-to-r from-amber-500 to-amber-400"
          }`}
        />

        {/* Close button */}
        <button
          onClick={onClose}
          aria-label="Close survey"
          className="absolute top-4 right-4 h-10 w-10 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 hover:bg-gray-200 transition z-10"
        >
          ✕
        </button>

        {submitted ? (
          /* Success screen */
          <div className="p-8 text-center">
            <div className="text-5xl mb-4 animate-bounce">🎉</div>
            <h3 className="font-display text-2xl font-bold text-gray-900 mb-2">
              {type === "customer"
                ? "You're in the community!"
                : "You're on the list!"}
            </h3>
            <p className="text-sm text-gray-500 mb-6">
              Thank you for helping shape Groomee. Your answers directly
              influence how we build the platform.
            </p>
            <div className="inline-flex items-center gap-2 bg-gradient-to-r from-brand-800 to-brand-400 text-white font-mono text-sm font-medium px-5 py-2.5 rounded-full shadow-lg mb-6">
              ⭐ +10 Groomee Points earned
            </div>
            <br />
            <button onClick={onClose} className="btn-primary btn-md">
              {type === "customer" ? "Start booking →" : "Got it →"}
            </button>
          </div>
        ) : (
          /* Question flow */
          <>
            <div className="p-6 pb-0">
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">
                {type === "customer" ? "Customer" : "Vendor"} survey · {questions.length} questions
              </p>
              <h3 className="font-display text-xl font-bold text-gray-900 mb-1">
                {type === "customer"
                  ? "Help us build the right thing"
                  : "Grow your client base with Groomee"}
              </h3>
              <p className="text-sm text-gray-500 mb-4">
                Takes about 60 seconds.
              </p>

              {/* Points strip */}
              <div className="flex items-center gap-3 rounded-xl bg-amber-50 border border-amber-200/50 px-3 py-2.5 mb-4">
                <span className="text-lg">⭐</span>
                <p className="text-xs text-gray-700">
                  Complete this survey and earn{" "}
                  <strong className="text-amber-600">10 Groomee Points</strong>
                </p>
              </div>

              {/* Progress */}
              <div className="mb-4">
                <div className="h-1 rounded-full bg-gray-100 overflow-hidden">
                  <div
                    className={`h-full transition-all duration-300 ${
                      type === "customer"
                        ? "bg-gradient-to-r from-brand-800 to-brand-400"
                        : "bg-gradient-to-r from-amber-500 to-amber-400"
                    }`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <p className="mt-1 text-right text-[10px] text-gray-400">
                  Question {step + 1} of {questions.length}
                </p>
              </div>
            </div>

            <div className="px-6 pb-6">
              <p className="text-sm font-semibold text-gray-900 mb-3">
                {q.label}
              </p>

              {q.freeText ? (
                <textarea
                  value={(answers[step] as string) ?? ""}
                  onChange={(e) => setFreeText(e.target.value)}
                  placeholder={q.placeholder}
                  className="input min-h-[100px] resize-none mb-4"
                />
              ) : (
                <div className="space-y-2 mb-4">
                  {q.options?.map((opt) => {
                    const selected = q.multi
                      ? ((answers[step] as string[]) ?? []).includes(opt)
                      : answers[step] === opt;
                    return (
                      <button
                        key={opt}
                        onClick={() => selectOption(opt)}
                        className={`flex w-full items-center gap-3 rounded-xl border-2 px-4 py-3 text-left text-sm transition-all ${
                          selected
                            ? "border-brand-500 bg-brand-50 text-brand-800 font-semibold"
                            : "border-gray-200 bg-gray-50 text-gray-600 hover:border-gray-300"
                        }`}
                      >
                        <span
                          className={`h-5 w-5 shrink-0 rounded-full border-2 flex items-center justify-center text-xs ${
                            selected
                              ? "border-brand-500 bg-brand-500 text-white"
                              : "border-gray-300"
                          }`}
                        >
                          {selected && "✓"}
                        </span>
                        {opt}
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Navigation */}
              <div className="flex gap-3">
                {step > 0 && (
                  <button
                    onClick={() => setStep(step - 1)}
                    className="btn-ghost btn-md"
                  >
                    ← Back
                  </button>
                )}
                {isLast ? (
                  <button
                    onClick={submit}
                    disabled={loading}
                    className={`flex-1 rounded-xl py-3 text-sm font-bold transition-all ${
                      type === "customer"
                        ? "btn-primary"
                        : "bg-gradient-to-r from-amber-500 to-amber-400 text-gray-900 hover:shadow-lg"
                    }`}
                  >
                    {loading ? "Submitting…" : "Submit & earn points ⭐"}
                  </button>
                ) : (
                  <button
                    onClick={() => setStep(step + 1)}
                    disabled={!answers[step]}
                    className={`flex-1 rounded-xl py-3 text-sm font-bold transition-all ${
                      type === "customer"
                        ? "btn-primary"
                        : "bg-gradient-to-r from-amber-500 to-amber-400 text-gray-900 hover:shadow-lg"
                    }`}
                  >
                    Next →
                  </button>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
