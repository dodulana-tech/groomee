import Link from "next/link";

const STEPS = [
  {
    num: "01",
    icon: "🔍",
    title: "Browse & select",
    desc: "Pick your service — hair, nails, makeup, or barbing. Filter by your Lagos zone and see who's available now.",
    color: "bg-brand-50",
  },
  {
    num: "02",
    icon: "📍",
    title: "Set your location",
    desc: "Enter your address or use GPS. We cover Victoria Island, Lekki, Ikoyi, Yaba, Ikeja, Surulere & more.",
    color: "bg-orange-50",
  },
  {
    num: "03",
    icon: "💳",
    title: "Pay securely",
    desc: "Confirm your booking and pay via card, bank transfer, or USSD. Funds are held — not released until you're satisfied.",
    color: "bg-purple-50",
  },
  {
    num: "04",
    icon: "✨",
    title: "Enjoy your service",
    desc: "Your groomer arrives, does the work. Confirm completion to release payment. Rate and rebook in one tap.",
    color: "bg-yellow-50",
  },
];

export default function HowItWorks() {
  return (
    <section id="how-it-works" className="section bg-white">
      <div className="container">
        <div className="section-header">
          <p className="text-xs font-bold uppercase tracking-widest text-brand-600 mb-3">
            How it works
          </p>
          <h2 className="font-display text-3xl font-bold text-gray-900 sm:text-4xl">
            Ready in 60 seconds
          </h2>
          <p className="mx-auto mt-4 max-w-md text-base text-gray-500">
            No calls, no DMs, no waiting. Book a professional groomer as easily
            as ordering a ride.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((step, i) => (
            <div
              key={i}
              className="relative rounded-3xl border border-gray-100 bg-white p-6 shadow-card"
            >
              {/* Step number */}
              <div className="mb-4 flex items-center justify-between">
                <span
                  className={`rounded-2xl ${step.color} px-3 py-1.5 text-3xl font-black text-gray-100 font-display leading-none`}
                >
                  {step.num}
                </span>
                <span className="text-3xl">{step.icon}</span>
              </div>
              <h3 className="font-bold text-gray-900 mb-2">{step.title}</h3>
              <p className="text-sm text-gray-500 leading-relaxed">
                {step.desc}
              </p>

              {/* Arrow connector */}
              {i < STEPS.length - 1 && (
                <div className="absolute -right-3 top-1/2 hidden -translate-y-1/2 text-gray-300 lg:block text-xl">
                  →
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Emergency CTA */}
        <div className="mt-12 overflow-hidden rounded-3xl bg-brand-600 p-8 text-center sm:p-10">
          <div className="mb-2 inline-block rounded-full bg-white/10 px-4 py-1.5 text-sm font-semibold text-white/90">
            ⚡ Emergency bookings available 24/7
          </div>
          <h3 className="mt-3 font-display text-2xl font-bold text-white sm:text-3xl">
            Last-minute event? We've got you.
          </h3>
          <p className="mx-auto mt-3 max-w-md text-white/70">
            Owambe tonight? Morning interview? Book a groomer right now and
            they'll be at your door within the hour.
          </p>
          <Link
            href="/search?asap=true"
            className="btn-orange btn-lg mt-6 inline-flex"
          >
            ⚡ Book emergency groomer
          </Link>
        </div>
      </div>
    </section>
  );
}
