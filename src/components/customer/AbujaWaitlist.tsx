"use client";

import { useState } from "react";

export default function AbujaWaitlist() {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("");
  const [area, setArea] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, phone, email, role, city: "Abuja", area }),
      });
      setSubmitted(true);
    } finally {
      setLoading(false);
    }
  }

  const AREAS = [
    "Maitama",
    "Wuse / Wuse 2",
    "Garki",
    "Gwarinpa",
    "Asokoro",
    "Jabi",
    "Utako",
    "Other",
  ];

  return (
    <section
      id="waitlist"
      className="relative overflow-hidden py-12 sm:py-20 px-4"
      style={{
        background:
          "linear-gradient(135deg, #1a0a3d 0%, #2d1060 50%, #1a0a3d 100%)",
      }}
    >
      {/* Decorative rings */}
      <div className="absolute -top-24 -right-20 h-96 w-96 rounded-full border border-purple-500/20 pointer-events-none" />
      <div className="absolute -bottom-12 left-[5%] h-64 w-64 rounded-full border border-purple-500/20 pointer-events-none" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_80%_at_15%_50%,rgba(124,58,237,0.3),transparent_60%),radial-gradient(ellipse_40%_60%_at_85%_30%,rgba(200,135,26,0.12),transparent_55%)] pointer-events-none" />

      <div className="container relative z-10">
        <div className="grid gap-12 lg:grid-cols-2 lg:items-center">
          {/* Left — hidden on mobile, shown on lg+ */}
          <div className="hidden lg:block">
            <p className="text-xs font-bold uppercase tracking-widest text-purple-300 mb-3 flex items-center gap-2">
              <span style={{ display: "inline-block", width: 20, height: 2, background: "#ddd0fa" }} />
              Coming soon
            </p>
            <h2 className="font-display text-3xl font-black text-white sm:text-4xl mb-4">
              Abuja, we&apos;re on our way.
            </h2>
            <p className="text-base text-white/60 leading-relaxed mb-6">
              Groomee is launching in Lagos first - and Abuja is next. Be among
              the first to experience trusted, on-demand beauty professionals in
              the FCT.
            </p>
            <div className="space-y-3">
              {[
                "Early access before public launch",
                "Shape how Groomee works in Abuja",
                "Earn 10 Groomee Points for joining",
                "First priority when we go live",
              ].map((item) => (
                <div
                  key={item}
                  className="flex items-center gap-3 text-sm text-white/70"
                >
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-purple-500/40 border border-purple-400 text-[10px]">
                    ✓
                  </span>
                  {item}
                </div>
              ))}
            </div>
          </div>

          {/* Right: Waitlist form */}
          <div className="rounded-2xl p-4 sm:p-8 bg-white/5 backdrop-blur-xl border border-white/10">
            {submitted ? (
              <div className="text-center py-8">
                <div className="text-5xl mb-4">🟡</div>
                <h3 className="font-display text-xl font-bold text-white mb-2">
                  You&apos;re on the Abuja waitlist!
                </h3>
                <p className="text-sm text-white/60 mb-4">
                  We&apos;ll notify you as soon as Groomee launches in Abuja.
                </p>
                <div className="inline-flex items-center gap-2 bg-gradient-to-r from-purple-600 to-purple-800 text-white font-mono text-sm font-medium px-4 py-2 rounded-full shadow-lg">
                  ⭐ +10 Groomee Points earned
                </div>
              </div>
            ) : (
              <>
                <h3 className="font-display text-lg sm:text-xl font-bold text-white mb-1">
                  Join the Abuja waitlist
                </h3>
                <p className="text-sm text-white/50 mb-4 sm:mb-6">
                  Takes 30 seconds · Be first in Abuja
                </p>

                <div className="mb-4 sm:mb-5 flex items-center gap-3 rounded-xl bg-amber-500/10 border border-amber-500/20 px-3 py-2.5 sm:px-4 sm:py-3 text-xs text-amber-100 leading-relaxed">
                  <span className="text-base">⭐</span>
                  Join now and earn <strong className="text-amber-400 ml-1">10 Groomee Points</strong>
                  <span className="ml-1 hidden sm:inline">- redeemable when Abuja goes live.</span>
                </div>

                <form onSubmit={handleSubmit} className="space-y-3 sm:space-y-4">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-white/50 mb-1.5">
                      Full name
                    </label>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Your name"
                      className="w-full rounded-xl bg-white/7 border border-white/12 px-4 py-3 text-base text-white placeholder:text-white/30 outline-none focus:border-purple-400 focus-visible:ring-2 focus-visible:ring-purple-400/40 transition"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-white/50 mb-1.5">
                      Phone number
                    </label>
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="0801 234 5678"
                      className="w-full rounded-xl bg-white/7 border border-white/12 px-4 py-3 text-base text-white placeholder:text-white/30 outline-none focus:border-purple-400 focus-visible:ring-2 focus-visible:ring-purple-400/40 transition"
                      required
                    />
                  </div>
                  {/* Email — hidden on mobile */}
                  <div className="hidden sm:block">
                    <label className="block text-xs font-bold uppercase tracking-wider text-white/50 mb-1.5">
                      Email
                    </label>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@email.com"
                      className="w-full rounded-xl bg-white/7 border border-white/12 px-4 py-3 text-base text-white placeholder:text-white/30 outline-none focus:border-purple-400 focus-visible:ring-2 focus-visible:ring-purple-400/40 transition"
                    />
                  </div>
                  {/* Role — hidden on mobile */}
                  <div className="hidden sm:block">
                    <label className="block text-xs font-bold uppercase tracking-wider text-white/50 mb-1.5">
                      I am joining as
                    </label>
                    <select
                      value={role}
                      onChange={(e) => setRole(e.target.value)}
                      className="w-full rounded-xl bg-white/7 border border-white/12 px-4 py-3 text-base text-white outline-none focus:border-purple-400 transition appearance-none"
                    >
                      <option value="" disabled>Select one</option>
                      <option value="customer">A customer - I want to book beauty pros</option>
                      <option value="pro">A beauty professional - I want to list my services</option>
                      <option value="both">Both</option>
                    </select>
                  </div>
                  {/* Area — hidden on mobile */}
                  <div className="hidden sm:block">
                    <label className="block text-xs font-bold uppercase tracking-wider text-white/50 mb-1.5">
                      Area in Abuja
                    </label>
                    <select
                      value={area}
                      onChange={(e) => setArea(e.target.value)}
                      className="w-full rounded-xl bg-white/7 border border-white/12 px-4 py-3 text-base text-white outline-none focus:border-purple-400 transition appearance-none"
                    >
                      <option value="" disabled>Select your area</option>
                      {AREAS.map((a) => (
                        <option key={a} value={a}>{a}</option>
                      ))}
                    </select>
                  </div>
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full rounded-xl bg-gradient-to-r from-purple-600 to-purple-800 py-3.5 text-sm font-bold text-white transition-all hover:shadow-lg hover:shadow-purple-500/30 disabled:opacity-60 flex items-center justify-center gap-2"
                  >
                    🟡 {loading ? "Joining…" : "Join the Abuja waitlist"}
                  </button>
                </form>
              </>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
