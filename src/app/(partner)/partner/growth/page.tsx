import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";

async function getProStats() {
  try {
    const session = await getSession();
    if (!session) return null;
    const pro = await db.pro.findFirst({ where: { phone: session.phone } });
    if (!pro) return null;
    return {
      totalJobs: pro.totalJobs,
      avgRating: pro.avgRating,
      acceptanceRate: pro.acceptanceRate,
      tier:
        pro.totalJobs >= 200 && pro.avgRating >= 4.7 && pro.acceptanceRate >= 0.9
          ? "ELITE"
          : pro.totalJobs >= 50 && pro.avgRating >= 4.5 && pro.acceptanceRate >= 0.8
            ? "PRO"
            : "STANDARD",
    };
  } catch {
    return null;
  }
}

function ProgressBar({ value, max, label, current, target }: {
  value: number;
  max: number;
  label: string;
  current: string;
  target: string;
}) {
  const pct = Math.min(100, Math.round((value / max) * 100));
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-medium text-gray-700">{label}</span>
        <span className="text-xs text-gray-500">
          {current} / {target}
        </span>
      </div>
      <div className="h-2 rounded-full bg-gray-200 overflow-hidden">
        <div
          className="h-full rounded-full bg-brand-600 transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

export default async function PartnerGrowthPage() {
  const stats = await getProStats();

  const totalJobs = stats?.totalJobs ?? 0;
  const avgRating = stats?.avgRating ?? 0;
  const acceptanceRate = stats?.acceptanceRate ?? 0;
  const tier = stats?.tier ?? "STANDARD";

  // Which tier to show progress toward
  const targetTier = tier === "ELITE" ? "ELITE" : tier === "PRO" ? "ELITE" : "PRO";

  const proTargets = { jobs: 50, rating: 4.5, acceptance: 0.8 };
  const eliteTargets = { jobs: 200, rating: 4.7, acceptance: 0.9 };
  const targets = targetTier === "ELITE" ? eliteTargets : proTargets;

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Growth &amp; Tips</h1>
        <p className="text-sm text-gray-500">
          Track your progress and learn how to earn more.
        </p>
      </div>

      {/* Current tier badge */}
      {stats && (
        <div className="glass rounded-2xl border border-white/20 p-5 shadow-lg flex items-center gap-4">
          <span className="text-3xl">
            {tier === "ELITE" ? "🥇" : tier === "PRO" ? "🥈" : "🥉"}
          </span>
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wide">Current tier</p>
            <p className="text-xl font-bold text-gray-900">{tier}</p>
          </div>
          <div className="ml-auto text-right">
            <p className="text-xs text-gray-500">{totalJobs} jobs completed</p>
            <p className="text-xs text-gray-500">
              {avgRating > 0 ? avgRating.toFixed(1) : "—"} avg rating
            </p>
            <p className="text-xs text-gray-500">
              {Math.round(acceptanceRate * 100)}% acceptance
            </p>
          </div>
        </div>
      )}

      {/* Progress toward next tier */}
      {stats && tier !== "ELITE" && (
        <div className="glass rounded-2xl border border-white/20 p-6 shadow-lg">
          <h2 className="font-bold text-gray-900 mb-1">
            Progress toward{" "}
            <span className={targetTier === "ELITE" ? "text-amber-600" : "text-blue-600"}>
              {targetTier}
            </span>
          </h2>
          <p className="text-xs text-gray-500 mb-4">
            {targetTier === "PRO"
              ? "50+ jobs · 4.5+ rating · 80% acceptance"
              : "200+ jobs · 4.7+ rating · 90% acceptance"}
          </p>
          <div className="space-y-4">
            <ProgressBar
              label="Jobs completed"
              value={totalJobs}
              max={targets.jobs}
              current={String(totalJobs)}
              target={`${targets.jobs}+`}
            />
            <ProgressBar
              label="Average rating"
              value={avgRating}
              max={targets.rating}
              current={avgRating > 0 ? avgRating.toFixed(2) : "0.00"}
              target={`${targets.rating}+`}
            />
            <ProgressBar
              label="Acceptance rate"
              value={acceptanceRate}
              max={targets.acceptance}
              current={`${Math.round(acceptanceRate * 100)}%`}
              target={`${Math.round(targets.acceptance * 100)}%+`}
            />
          </div>
        </div>
      )}

      {/* Tier journey overview */}
      <div className="glass rounded-2xl border border-white/20 p-6 shadow-lg">
        <h2 className="font-bold text-gray-900 mb-4">Your tier journey</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <div
            className={`rounded-xl border-2 p-4 text-center ${
              tier === "STANDARD"
                ? "border-gray-400 bg-gray-50"
                : "border-gray-200 glass-card"
            }`}
          >
            <p className="text-2xl mb-1">🥉</p>
            <p className="font-bold text-gray-900">Standard</p>
            <p className="text-xs text-gray-500 mt-1">
              Starting tier. Access to standard bookings.
            </p>
            <div className="mt-3 text-[10px] text-gray-400">
              Default for all new pros
            </div>
          </div>
          <div
            className={`rounded-xl border-2 p-4 text-center ${
              tier === "PRO"
                ? "border-blue-400 bg-blue-50"
                : "border-blue-200 bg-blue-50/50"
            }`}
          >
            <p className="text-2xl mb-1">🥈</p>
            <p className="font-bold text-blue-700">Pro</p>
            <p className="text-xs text-gray-500 mt-1">
              Urgent bookings, higher fee split, priority listing.
            </p>
            <div className="mt-3 text-[10px] text-blue-600">
              50+ jobs · 4.5+ rating · 80% acceptance
            </div>
          </div>
          <div
            className={`rounded-xl border-2 p-4 text-center ${
              tier === "ELITE"
                ? "border-amber-400 bg-amber-50"
                : "border-amber-200 bg-amber-50/50"
            }`}
          >
            <p className="text-2xl mb-1">🥇</p>
            <p className="font-bold text-amber-700">Elite</p>
            <p className="text-xs text-gray-500 mt-1">
              Corporate jobs, brand partnerships, highest fee split.
            </p>
            <div className="mt-3 text-[10px] text-amber-600">
              200+ jobs · 4.7+ rating · 90% acceptance
            </div>
          </div>
        </div>
      </div>

      {/* Tips */}
      <div className="glass rounded-2xl border border-white/20 p-6 shadow-lg">
        <h2 className="font-bold text-gray-900 mb-4">Tips to earn more</h2>
        <div className="space-y-3">
          {[
            {
              title: "Stay online during peak hours",
              desc: "Fri-Sun evenings (6-10pm) have the highest demand. Being available earns you more bookings.",
              icon: "⏰",
            },
            {
              title: "Accept bookings quickly",
              desc: "Fast acceptance rate improves your ranking. Aim for under 30 seconds.",
              icon: "⚡",
            },
            {
              title: "Ask customers to review you",
              desc: "More 5-star reviews = higher search ranking = more bookings.",
              icon: "⭐",
            },
            {
              title: "Expand your service zones",
              desc: "Covering more areas means more potential customers. Talk to us about adding zones.",
              icon: "📍",
            },
            {
              title: "Maintain your rating above 4.5",
              desc: "High ratings unlock the Pro tier with better fee splits and urgent booking access.",
              icon: "📈",
            },
            {
              title: "Be on time, every time",
              desc: "Punctuality is the #1 factor in customer satisfaction. Arrive within 5 mins of your ETA.",
              icon: "🕐",
            },
          ].map((tip) => (
            <div
              key={tip.title}
              className="flex items-start gap-3 rounded-xl bg-white/60 p-4"
            >
              <span className="text-xl shrink-0">{tip.icon}</span>
              <div>
                <p className="text-sm font-semibold text-gray-900">{tip.title}</p>
                <p className="text-xs text-gray-500 leading-relaxed mt-0.5">
                  {tip.desc}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Value prop reminder */}
      <div className="rounded-2xl bg-gradient-to-r from-brand-800 to-brand-600 p-6 text-white">
        <h2 className="font-display text-xl font-bold mb-2">
          We build with you, not on you.
        </h2>
        <p className="text-sm text-white/80 leading-relaxed mb-4">
          Groomee exists to elevate informal talent into structured, empowered
          entrepreneurship. Fair pay. Safer work. Real growth.
        </p>
        <div className="flex flex-wrap gap-2">
          {[
            "Transparent pricing",
            "Weekly payouts",
            "Insurance coverage",
            "Training resources",
          ].map((item) => (
            <span
              key={item}
              className="rounded-full bg-white/15 border border-white/20 px-3 py-1 text-xs font-semibold"
            >
              ✓ {item}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
