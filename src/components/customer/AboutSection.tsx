export default function AboutSection() {
  return (
    <section id="about" className="section bg-cream-50 hidden md:block">
      <div className="container">
        <div className="grid gap-12 lg:grid-cols-[1fr_1.2fr] lg:items-center">
          {/* Left: Quote card */}
          <div>
            <div className="glass rounded-2xl p-8 shadow-lg relative">
              <span className="absolute top-4 left-6 font-display text-7xl font-black text-brand-200 leading-none select-none">
                &ldquo;
              </span>
              <blockquote className="relative z-10 pt-10 font-display text-xl italic text-gray-900 leading-relaxed">
                Finding a trusted beauty service provider isn&apos;t easy. When that
                person is unavailable, it leaves you distressed - especially when
                it&apos;s a necessity. It really shouldn&apos;t be this hard.
              </blockquote>
              <div className="mt-5 flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-gradient-to-br from-brand-600 to-brand-400 flex items-center justify-center text-sm font-bold text-white font-display">
                  F
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-900">The Founder</p>
                  <p className="text-xs text-gray-500">Co-founder, Groomee</p>
                </div>
              </div>
            </div>

            {/* Impact pills */}
            <div className="mt-6 flex flex-wrap gap-2">
              {[
                "🛡️ Vetted professionals",
                "📈 Income stability for pros",
                "⚡ Urgency with dignity",
                "💰 Fair pay, fair standards",
              ].map((pill) => (
                <span
                  key={pill}
                  className="inline-flex items-center gap-1.5 rounded-full bg-brand-yellow px-3 py-1.5 text-xs font-semibold text-gray-900 border border-brand-400/30"
                >
                  {pill}
                </span>
              ))}
            </div>
          </div>

          {/* Right: Story */}
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-brand-600 mb-3">
              Our story
            </p>
            <h2 className="font-display text-3xl font-bold text-gray-900 sm:text-4xl mb-6">
              Built for the moments that matter
            </h2>
            <p className="text-base text-gray-600 leading-relaxed mb-4">
              Groomee was built for the moments when time runs out and opportunity
              is on the line. In a city like Lagos, a last-minute cancellation or
              a fully-booked salon can cost more than convenience. For many women,
              showing up put-together is not vanity. It is confidence, visibility,
              and access.
            </p>
            <p className="text-base text-gray-600 leading-relaxed mb-4">
              We deliver vetted beauty professionals to your door - reliable,
              structured, and available when it matters most. From owambe-eve
              emergencies to early-morning interview prep, we show up.
            </p>
            <div className="my-6 border-l-4 border-brand-500 bg-brand-50 rounded-r-xl py-4 px-5">
              <p className="font-display text-lg font-bold italic text-brand-800">
                Urgency with dignity. That is what Groomee is built on.
              </p>
            </div>
            <p className="text-base text-gray-600 leading-relaxed">
              But Groomee is not only solving for customers. Behind every booking
              is a skilled professional who deserves fair pay, safer working
              conditions, and a platform that helps them grow. We are building
              that - one booking at a time.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
