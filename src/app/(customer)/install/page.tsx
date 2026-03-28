import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Add Groomee to your home screen",
  description:
    "Get the full Groomee experience. No app store, no download. Add to your home screen in seconds.",
};

const STEPS_IOS = [
  {
    num: "1",
    icon: "🧭",
    title: "Open in Safari",
    desc: "Make sure you're using Safari (not Chrome or another browser). Tap the link or type groomee.ng in the address bar.",
  },
  {
    num: "2",
    icon: "📤",
    title: "Tap the share button",
    desc: "Look for the share icon at the bottom of your screen (the square with an arrow pointing up).",
  },
  {
    num: "3",
    icon: "➕",
    title: 'Tap "Add to Home Screen"',
    desc: "Scroll down in the share menu until you see it. Tap it, then tap Add.",
  },
  {
    num: "4",
    icon: "✨",
    title: "You're all set",
    desc: "Groomee now lives on your home screen. Open it anytime, just like a regular app.",
  },
];

const STEPS_ANDROID = [
  {
    num: "1",
    icon: "🌐",
    title: "Open in Chrome",
    desc: "Visit groomee.ng in Google Chrome. You might see an \"Install app\" banner at the bottom automatically.",
  },
  {
    num: "2",
    icon: "⋮",
    title: "Tap the menu",
    desc: "If no banner appears, tap the three dots (menu) in the top-right corner of Chrome.",
  },
  {
    num: "3",
    icon: "📲",
    title: 'Tap "Install app" or "Add to Home screen"',
    desc: "Chrome will prompt you to confirm. Tap Install.",
  },
  {
    num: "4",
    icon: "✨",
    title: "Done",
    desc: "Groomee is now on your home screen. Faster access, offline support, the full experience.",
  },
];

export default function InstallPage() {
  return (
    <div className="min-h-screen" style={{ background: "#f7f5f0" }}>
      {/* Hero */}
      <section className="relative overflow-hidden px-5 pt-10 pb-8 sm:px-8 sm:pt-16 sm:pb-12">
        <div className="pointer-events-none absolute -right-32 -top-32 h-[400px] w-[400px] rounded-full bg-[radial-gradient(circle,rgba(83,235,100,0.08)_0%,transparent_70%)]" />
        <div className="mx-auto max-w-2xl text-center">
          <div className="mb-5 inline-flex items-center gap-2 rounded-full bg-[#e2fce5] px-4 py-1.5 text-xs font-bold text-[#014342]">
            <span>📲</span> No app store needed
          </div>
          <h1
            className="font-display text-3xl font-bold text-[#0a0a0a] sm:text-4xl"
            style={{ lineHeight: 1.15 }}
          >
            Add Groomee to your
            <br />
            <span className="italic text-[#014342]">home screen</span>
          </h1>
          <p className="mx-auto mt-4 max-w-md text-[0.95rem] leading-relaxed text-[#3c4d3d]">
            Get the full app experience without the App Store. Book a pro in
            seconds, right from your home screen. Works offline too.
          </p>
        </div>
      </section>

      <div className="mx-auto max-w-3xl px-5 pb-16 sm:px-8">
        {/* Benefits */}
        <div className="mb-10 grid gap-3 sm:grid-cols-3">
          {[
            { icon: "⚡", label: "Instant launch", desc: "No browser, no tabs" },
            { icon: "📴", label: "Works offline", desc: "Cached for speed" },
            { icon: "🔔", label: "Stay updated", desc: "Never miss a booking" },
          ].map((b) => (
            <div
              key={b.label}
              className="rounded-2xl border border-[rgba(13,61,38,0.08)] bg-white p-4 text-center"
            >
              <div className="text-2xl mb-1">{b.icon}</div>
              <p className="text-sm font-bold text-[#0a0a0a]">{b.label}</p>
              <p className="text-xs text-[#7a9a7c]">{b.desc}</p>
            </div>
          ))}
        </div>

        {/* iPhone */}
        <div className="mb-8">
          <div className="mb-4 flex items-center gap-2">
            <span className="text-xl">🍎</span>
            <h2 className="text-lg font-bold text-[#0a0a0a]">iPhone / iPad</h2>
          </div>
          <div className="space-y-3">
            {STEPS_IOS.map((step) => (
              <div
                key={step.num}
                className="flex gap-4 rounded-2xl border border-[rgba(13,61,38,0.06)] bg-white p-4"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#e2fce5] text-lg">
                  {step.icon}
                </div>
                <div>
                  <p className="text-sm font-bold text-[#0a0a0a]">
                    <span className="text-[#014342]">{step.num}.</span>{" "}
                    {step.title}
                  </p>
                  <p className="mt-0.5 text-xs leading-relaxed text-[#7a9a7c]">
                    {step.desc}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Android */}
        <div className="mb-10">
          <div className="mb-4 flex items-center gap-2">
            <span className="text-xl">🤖</span>
            <h2 className="text-lg font-bold text-[#0a0a0a]">Android</h2>
          </div>
          <div className="space-y-3">
            {STEPS_ANDROID.map((step) => (
              <div
                key={step.num}
                className="flex gap-4 rounded-2xl border border-[rgba(13,61,38,0.06)] bg-white p-4"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#e2fce5] text-lg">
                  {step.icon}
                </div>
                <div>
                  <p className="text-sm font-bold text-[#0a0a0a]">
                    <span className="text-[#014342]">{step.num}.</span>{" "}
                    {step.title}
                  </p>
                  <p className="mt-0.5 text-xs leading-relaxed text-[#7a9a7c]">
                    {step.desc}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* CTA */}
        <div className="rounded-3xl bg-[#014342] p-6 text-center sm:p-8">
          <p className="text-2xl mb-2">💚</p>
          <h3 className="font-display text-xl font-bold text-white mb-2">
            Ready to get glammed?
          </h3>
          <p className="text-sm text-white/60 mb-5">
            50+ vetted pros in Lagos. Book in 60 seconds.
          </p>
          <Link
            href="/search"
            className="inline-flex items-center gap-2 rounded-xl bg-[#53eb64] px-6 py-3.5 text-sm font-bold text-[#0a0a0a] active:scale-[0.97] transition-all"
          >
            Book a pro now
          </Link>
        </div>
      </div>
    </div>
  );
}
