import Link from "next/link";

const STEPS = [
  {
    num: "01",
    icon: "🔍",
    title: "Pick your service",
    desc: "Hair, nails, makeup, barbing, or lashes. Filter by zone and availability.",
  },
  {
    num: "02",
    icon: "📍",
    title: "Set your location",
    desc: "Enter your address. We cover VI, Lekki, Ikoyi, Yaba, Ikeja, Surulere and more.",
  },
  {
    num: "03",
    icon: "💳",
    title: "Pay securely",
    desc: "Card, transfer, or USSD via Paystack. Funds held until you confirm.",
  },
  {
    num: "04",
    icon: "✨",
    title: "Get glammed",
    desc: "Your pro arrives and delivers. Confirm, rate, and rebook in one tap.",
  },
];

export default function HowItWorks() {
  return (
    <section
      id="how-it-works"
      className="relative overflow-hidden py-12 px-4 sm:py-24"
      style={{ background: "#014342" }}
    >
      {/* Ambient gradients */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -right-40 -top-40 h-[500px] w-[500px] rounded-full bg-[radial-gradient(circle,rgba(83,235,100,0.12)_0%,transparent_70%)]" />
        <div className="absolute -left-20 bottom-0 h-[300px] w-[300px] rounded-full bg-[radial-gradient(circle,rgba(255,254,161,0.06)_0%,transparent_70%)]" />
      </div>

      <div className="container relative z-10">
        <div className="mb-8 md:mb-14 max-w-lg">
          <p className="mb-3 flex items-center gap-2.5 text-xs font-bold uppercase tracking-[0.15em] text-green-400">
            <span className="inline-block h-px w-6 bg-green-400" />
            How it works
          </p>
          <h2 className="font-display text-3xl font-bold text-white sm:text-4xl">
            Booked in 60 seconds
          </h2>
          <p className="mt-4 text-base leading-relaxed text-white/50">
            No calls, no DMs, no haggling. Book a vetted beauty pro as easily as
            ordering a ride.
          </p>
        </div>

        {/* Mobile compact steps — 4 circles in a row */}
        <div className="md:hidden mb-8">
          <div className="relative flex items-start justify-between">
            {/* Connecting line */}
            <div className="absolute top-4 left-[calc(12.5%)] right-[calc(12.5%)] h-px bg-green-400/30" />
            {[
              { num: "1", label: "Pick" },
              { num: "2", label: "Book" },
              { num: "3", label: "Pro arrives" },
              { num: "4", label: "Glow" },
            ].map((s) => (
              <div key={s.num} className="relative z-10 flex flex-1 flex-col items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-full border border-green-400/40 bg-green-400/10 font-mono text-xs font-bold text-green-400">
                  {s.num}
                </span>
                <span className="text-center text-[11px] font-semibold leading-tight text-white/60">
                  {s.label}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Steps — full cards on md+ */}
        <div className="hidden md:grid gap-px sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((step, i) => (
            <div
              key={i}
              className="group relative rounded-2xl border border-white/[0.06] bg-white/[0.03] p-6 transition-all hover:border-green-400/20 hover:bg-white/[0.06]"
            >
              {/* Step number */}
              <div className="mb-4 flex items-center justify-between">
                <span className="font-mono text-[0.65rem] font-medium tracking-[0.2em] text-green-400/70">
                  STEP {step.num}
                </span>
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/[0.06] text-base transition-transform group-hover:scale-110">
                  {step.icon}
                </span>
              </div>
              <h3 className="mb-2 text-[0.95rem] font-bold text-white">
                {step.title}
              </h3>
              <p className="text-sm leading-relaxed text-white/45">
                {step.desc}
              </p>

              {/* Connector arrow on desktop */}
              {i < STEPS.length - 1 && (
                <div className="pointer-events-none absolute -right-2 top-1/2 z-10 hidden -translate-y-1/2 text-green-400/30 lg:block">
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <path d="M6 3l5 5-5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Emergency CTA */}
        <div className="mt-12 overflow-hidden rounded-2xl border border-green-400/15 bg-gradient-to-r from-green-400/[0.06] to-transparent">
          <div className="flex flex-col items-start gap-6 p-8 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.12em] text-green-400">
                <span>⚡</span> Emergency bookings 24/7
              </p>
              <h3 className="font-display text-xl font-bold text-white sm:text-2xl">
                Last-minute event? We&apos;ve got you.
              </h3>
              <p className="mt-1 text-sm text-white/45">
                Owambe tonight? Morning interview? A vetted pro at your door
                within the hour.
              </p>
            </div>
            <Link
              href="/search?asap=true"
              className="group shrink-0 inline-flex items-center gap-2 rounded-xl bg-[#53eb64] px-6 py-3.5 text-sm font-bold text-[#0a0a0a] transition-all hover:-translate-y-0.5 hover:shadow-[0_8px_24px_rgba(83,235,100,0.3)]"
            >
              <span className="transition-transform group-hover:scale-110">⚡</span>
              Book emergency pro
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
