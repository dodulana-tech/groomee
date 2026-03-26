import Link from "next/link";

const STEPS = [
  {
    num: "01",
    icon: "🔍",
    title: "Browse & select",
    desc: "Pick your service — hair, nails, makeup, barbing, or lashes. Filter by your Lagos zone and see who's available right now.",
  },
  {
    num: "02",
    icon: "📍",
    title: "Set your location",
    desc: "Enter your address or use GPS. We cover Victoria Island, Lekki, Ikoyi, Yaba, Ikeja, Surulere & more.",
  },
  {
    num: "03",
    icon: "💳",
    title: "Pay securely",
    desc: "Pay via card, bank transfer, or USSD. Your funds are held by Paystack — not released until you confirm the service is done.",
  },
  {
    num: "04",
    icon: "✨",
    title: "Enjoy your service",
    desc: "Your pro arrives and gets to work. Confirm completion to release payment. Rate and rebook in one tap.",
  },
];

export default function HowItWorks() {
  return (
    <section
      id="how-it-works"
      className="relative overflow-hidden py-20 px-4"
      style={{ background: "var(--color-brand-deep, #014342)" }}
    >
      {/* Decorative gradients matching landing page */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_80%_at_90%_10%,rgba(83,235,100,0.15),transparent_60%),radial-gradient(ellipse_40%_40%_at_5%_90%,rgba(255,254,161,0.07),transparent_55%)] pointer-events-none" />

      <div className="container relative z-10">
        <div className="mb-12">
          <p className="text-xs font-bold uppercase tracking-widest text-green-400 mb-3 flex items-center gap-2">
            <span className="inline-block w-5 h-0.5 bg-green-400" />
            How it works
          </p>
          <h2 className="font-display text-3xl font-bold text-white sm:text-4xl">
            Ready in 60 seconds
          </h2>
          <p className="mt-4 max-w-md text-base text-white/60">
            No calls, no DMs, no waiting. Book a vetted beauty professional as
            easily as ordering a ride.
          </p>
        </div>

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((step, i) => (
            <div key={i} className="relative">
              <span className="text-xs font-mono font-medium text-green-400 tracking-widest mb-3 block">
                STEP {step.num}
              </span>
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-white/8 border border-white/12 text-xl">
                {step.icon}
              </div>
              <h3 className="font-bold text-white mb-2">{step.title}</h3>
              <p className="text-sm text-white/55 leading-relaxed">
                {step.desc}
              </p>
              {/* Connector line */}
              {i < STEPS.length - 1 && (
                <div className="absolute top-[60px] -right-3 hidden w-6 h-px bg-gradient-to-r from-green-400/40 to-transparent lg:block pointer-events-none" />
              )}
            </div>
          ))}
        </div>

        {/* Emergency CTA — glassmorphism card on dark bg */}
        <div className="mt-14 rounded-2xl bg-green-400/8 border border-green-400/20 p-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6">
          <div>
            <div className="mb-2 inline-flex items-center gap-1.5 text-xs font-bold text-green-400 uppercase tracking-wider">
              ⚡ Emergency bookings available 24/7
            </div>
            <h3 className="font-display text-2xl font-bold text-white mb-1">
              Last-minute event? We&apos;ve got you.
            </h3>
            <p className="text-sm text-white/55">
              Owambe tonight? Morning interview? We&apos;ll have a vetted pro at
              your door within the hour.
            </p>
          </div>
          <Link
            href="/search?asap=true"
            className="shrink-0 inline-flex items-center justify-center gap-1.5 rounded-xl bg-green-400 px-6 py-3.5 text-sm font-bold text-gray-950 transition-all hover:bg-yellow-200 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-green-400/40"
          >
            ⚡ Book an emergency pro
          </Link>
        </div>
      </div>
    </section>
  );
}
