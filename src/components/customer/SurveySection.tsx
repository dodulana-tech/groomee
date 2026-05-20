"use client";

import { useState } from "react";
import SurveyModal from "./SurveyModal";

export default function SurveySection() {
  const [openModal, setOpenModal] = useState<"customer" | "vendor" | null>(null);

  return (
    <>
      <section id="survey" className="section bg-cream-50">
        <div className="container">
          {/* Intro */}
          <div className="mx-auto max-w-2xl text-center mb-10">
            <p className="text-xs font-bold uppercase tracking-widest text-brand-600 mb-3">
              Early community
            </p>
            <h2 className="font-display text-3xl font-bold text-gray-900 sm:text-4xl">
              Help shape Groomee.
              <br />
              Earn your first points.
            </h2>
            <p className="mt-4 text-base text-gray-500">
              We&apos;re building with our community, not just for them. Share your
              experience in 60 seconds and earn 10 Groomee Points as a founding
              member.
            </p>
          </div>

          {/* Mobile compact banner */}
          <div className="md:hidden mx-auto max-w-sm rounded-2xl border border-white/20 bg-amber-50/80 p-5 text-center shadow">
            <p className="text-sm font-semibold text-gray-800 leading-snug mb-4">
              Help us improve! Take a 2-min survey and earn{" "}
              <span className="font-bold text-amber-600">10 Groomee Points</span> ✨
            </p>
            <button
              onClick={() => setOpenModal("customer")}
              className="btn-primary btn-md w-full"
            >
              Take the survey →
            </button>
          </div>

          {/* Cards — full layout on md+ */}
          <div className="hidden md:grid mx-auto max-w-3xl gap-6 sm:grid-cols-2">
            {/* Customer survey */}
            <div className="glass rounded-2xl border border-white/20 p-6 shadow-lg flex flex-col relative overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-brand-800 to-brand-400" />
              <div className="text-3xl mb-3">💪</div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">
                For customers
              </p>
              <h3 className="font-display text-lg font-bold text-gray-900 mb-2">
                How do you find beauty pros today?
              </h3>
              <p className="text-sm text-gray-500 leading-relaxed flex-1">
                Tell us about your current beauty routine, what frustrates you
                most, and what would make Groomee essential for you.
              </p>
              <div className="mt-4 flex items-center gap-3 rounded-xl bg-amber-50 border border-amber-200/50 px-3 py-2.5">
                <span className="text-lg">⭐</span>
                <p className="text-xs text-gray-700 leading-relaxed">
                  Complete the survey and earn{" "}
                  <strong className="text-amber-600">10 Groomee Points</strong> —
                  redeemable on your first or next booking.
                </p>
              </div>
              <p className="mt-3 text-[10px] font-semibold text-gray-400">
                ⏱️ 1-minute survey · 5 questions
              </p>
              <button
                onClick={() => setOpenModal("customer")}
                className="mt-4 btn-primary btn-md w-full"
              >
                Take the 1-minute survey →
              </button>
            </div>

            {/* Vendor survey */}
            <div className="glass rounded-2xl border border-white/20 p-6 shadow-lg flex flex-col relative overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-500 to-amber-400" />
              <div className="text-3xl mb-3">💼</div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">
                For beauty professionals
              </p>
              <h3 className="font-display text-lg font-bold text-gray-900 mb-2">
                Ready to grow your client base?
              </h3>
              <p className="text-sm text-gray-500 leading-relaxed flex-1">
                Tell us about your services, how you manage bookings today, and
                what Groomee can do to support your growth.
              </p>
              <div className="mt-4 flex items-center gap-3 rounded-xl bg-amber-50 border border-amber-200/50 px-3 py-2.5">
                <span className="text-lg">⭐</span>
                <p className="text-xs text-gray-700 leading-relaxed">
                  Complete the survey and earn{" "}
                  <strong className="text-amber-600">10 Groomee Points</strong> —
                  priority access when your city goes live.
                </p>
              </div>
              <p className="mt-3 text-[10px] font-semibold text-gray-400">
                ⏱️ 1-minute survey · 5 questions
              </p>
              <button
                onClick={() => setOpenModal("vendor")}
                className="mt-4 w-full rounded-xl bg-gradient-to-r from-amber-500 to-amber-400 py-3 text-sm font-bold text-gray-900 transition-all hover:shadow-lg"
              >
                List your business →
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Modals */}
      {openModal && (
        <SurveyModal
          type={openModal}
          onClose={() => setOpenModal(null)}
        />
      )}
    </>
  );
}
