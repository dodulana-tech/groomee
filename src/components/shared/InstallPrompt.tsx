"use client";

import { useState, useEffect } from "react";

export default function InstallPrompt() {
  const [prompt, setPrompt] = useState<
    (Event & { prompt?: () => Promise<void> }) | null
  >(null);
  const [show, setShow] = useState(false);

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setPrompt(e as Event & { prompt?: () => Promise<void> });
      // Show after 30s or if they've visited twice
      const visits = parseInt(localStorage.getItem("gv") ?? "0") + 1;
      localStorage.setItem("gv", visits.toString());
      if (visits >= 2 && !localStorage.getItem("pwa_dismissed")) setShow(true);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  if (!show) return null;

  return (
    <div className="fixed bottom-24 md:bottom-6 left-4 right-4 md:left-auto md:right-6 md:max-w-sm z-50 animate-slide-up">
      <div className="bg-forest-500 text-white rounded-2xl p-4 shadow-lg flex items-center gap-3">
        <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center text-2xl shrink-0">
          💇‍♀️
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-sm">Add Groomee to home screen</p>
          <p className="text-xs text-white/70 mt-0.5">
            Book groomers faster, anytime
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => {
              prompt?.prompt?.();
              setShow(false);
            }}
            className="bg-amber text-ink text-xs font-bold px-3 py-1.5 rounded-lg"
          >
            Add
          </button>
          <button
            onClick={() => {
              setShow(false);
              localStorage.setItem("pwa_dismissed", "1");
            }}
            className="text-white/60 text-sm px-2"
          >
            ✕
          </button>
        </div>
      </div>
    </div>
  );
}
