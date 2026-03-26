import Link from "next/link";

export default function CityRolloutBanner() {
  return (
    <section className="bg-gray-950 py-10 relative overflow-hidden">
      {/* Decorative gradients */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_50%_120%_at_25%_50%,rgba(37,135,79,0.18),transparent_60%),radial-gradient(ellipse_40%_100%_at_80%_50%,rgba(124,58,237,0.12),transparent_60%)] pointer-events-none" />

      <div className="container relative z-10">
        <div className="mx-auto max-w-3xl grid grid-cols-1 gap-0 rounded-2xl overflow-hidden border border-white/10 sm:grid-cols-[1fr_auto_1fr]">
          {/* Lagos */}
          <div className="flex flex-col justify-between gap-4 bg-green-500/10 p-6 sm:p-8 border-b sm:border-b-0 sm:border-r border-white/10">
            <div>
              <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-green-400">
                <span className="h-2 w-2 rounded-full bg-green-400 shadow-[0_0_0_3px_rgba(74,222,128,0.25)] animate-pulse" />
                Live now
              </div>
              <h3 className="font-display text-2xl font-black text-white mb-2">Lagos</h3>
              <p className="text-sm text-white/50 leading-relaxed">
                Groomee is open and taking bookings across Victoria Island, Lekki,
                Ikoyi, Ikeja, Surulere, Yaba, Ajah &amp; Gbagada.
              </p>
            </div>
            <Link
              href="/search"
              className="inline-flex items-center gap-2 rounded-xl bg-green-500 px-5 py-2.5 text-sm font-bold text-gray-950 hover:bg-green-400 transition-all w-fit"
            >
              Browse pros in Lagos →
            </Link>
          </div>

          {/* Divider */}
          <div className="hidden sm:flex w-px bg-white/10 items-center justify-center relative">
            <span className="absolute text-[10px] font-bold tracking-widest text-white/25 bg-gray-950 py-1 px-0.5" style={{ writingMode: "vertical-rl" }}>
              OR
            </span>
          </div>

          {/* Abuja */}
          <div className="flex flex-col justify-between gap-4 bg-purple-500/10 p-6 sm:p-8">
            <div>
              <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-purple-300">
                <span className="h-2 w-2 rounded-full bg-purple-400" />
                Coming soon
              </div>
              <h3 className="font-display text-2xl font-black text-white mb-2">Abuja</h3>
              <p className="text-sm text-white/50 leading-relaxed">
                We&apos;re building Groomee for Abuja next. Join the waitlist to be
                first in line.
              </p>
            </div>
            <Link
              href="#abuja-waitlist"
              className="inline-flex items-center gap-2 rounded-xl bg-purple-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-purple-500 transition-all w-fit"
            >
              Join the Abuja waitlist →
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
