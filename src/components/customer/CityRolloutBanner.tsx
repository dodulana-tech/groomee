import Link from "next/link";

interface CitySummary {
  id: string;
  name: string;
  slug: string;
  tagline?: string | null;
}

interface Props {
  liveCities: CitySummary[];
  waitlistCities: CitySummary[];
}

export default function CityRolloutBanner({ liveCities, waitlistCities }: Props) {
  // Nothing to show if every city is hidden — and there's nothing intersting
  // to say when there are no waitlist cities (the landing is already
  // about LIVE cities). Hide.
  if (liveCities.length === 0) return null;
  const liveLabel = liveCities.map((c) => c.name).join(" · ");
  const firstWait = waitlistCities[0] ?? null;

  return (
    <section className="bg-gray-950 py-10 relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_50%_120%_at_25%_50%,rgba(37,135,79,0.18),transparent_60%),radial-gradient(ellipse_40%_100%_at_80%_50%,rgba(124,58,237,0.12),transparent_60%)] pointer-events-none" />

      <div className="container relative z-10">
        {/* Mobile slim banner */}
        <div className="md:hidden flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-3">
          <p className="text-sm font-semibold text-white">
            <span className="mr-1">🟢</span>
            Live in {liveLabel}
            {firstWait && (
              <>
                {" · "}
                <span className="text-purple-300">{firstWait.name} coming soon</span>
              </>
            )}
          </p>
          {firstWait && (
            <Link
              href={`#waitlist-${firstWait.slug}`}
              className="shrink-0 rounded-lg bg-purple-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-purple-500 transition-all"
            >
              Join waitlist
            </Link>
          )}
        </div>

        {/* Two-card layout md+. When no waitlist city exists, render only the
            LIVE side (one card, centered). */}
        <div
          className={`hidden md:grid mx-auto max-w-3xl rounded-2xl overflow-hidden border border-white/10 ${
            firstWait ? "sm:grid-cols-[1fr_auto_1fr]" : "sm:grid-cols-1"
          }`}
        >
          {/* LIVE — pick the first LIVE city for the hero copy */}
          {liveCities.slice(0, 1).map((c) => (
            <div
              key={c.id}
              className="flex flex-col justify-between gap-4 bg-green-500/10 p-6 sm:p-8 border-b sm:border-b-0 sm:border-r border-white/10"
            >
              <div>
                <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-green-400">
                  <span className="h-2 w-2 rounded-full bg-green-400 shadow-[0_0_0_3px_rgba(74,222,128,0.25)] animate-pulse" />
                  Live now
                </div>
                <h3 className="font-display text-2xl font-black text-white mb-2">{c.name}</h3>
                <p className="text-sm text-white/50 leading-relaxed">
                  {c.tagline ?? `Groomee is open and taking bookings across ${c.name}.`}
                </p>
              </div>
              <Link
                href="/search"
                className="inline-flex items-center gap-2 rounded-xl bg-green-500 px-5 py-2.5 text-sm font-bold text-gray-950 hover:bg-green-400 transition-all w-fit"
              >
                Browse pros in {c.name} →
              </Link>
            </div>
          ))}

          {firstWait && (
            <>
              <div className="hidden sm:flex w-px bg-white/10 items-center justify-center relative">
                <span
                  className="absolute text-[10px] font-bold tracking-widest text-white/25 bg-gray-950 py-1 px-0.5"
                  style={{ writingMode: "vertical-rl" }}
                >
                  OR
                </span>
              </div>

              <div className="flex flex-col justify-between gap-4 bg-purple-500/10 p-6 sm:p-8">
                <div>
                  <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-purple-300">
                    <span className="h-2 w-2 rounded-full bg-purple-400" />
                    Coming soon
                  </div>
                  <h3 className="font-display text-2xl font-black text-white mb-2">
                    {firstWait.name}
                  </h3>
                  <p className="text-sm text-white/50 leading-relaxed">
                    {firstWait.tagline ??
                      `We're building Groomee for ${firstWait.name} next. Join the waitlist to be first in line.`}
                  </p>
                </div>
                <Link
                  href={`#waitlist-${firstWait.slug}`}
                  className="inline-flex items-center gap-2 rounded-xl bg-purple-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-purple-500 transition-all w-fit"
                >
                  Join the {firstWait.name} waitlist →
                </Link>
              </div>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
