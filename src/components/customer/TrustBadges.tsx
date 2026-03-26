export default function TrustBadges() {
  const badges = [
    {
      icon: "🛡️",
      title: "ID Verified",
      desc: "Every pro verified with a government-issued ID before their first booking",
    },
    {
      icon: "💳",
      title: "Secure payments",
      desc: "Powered by Paystack - held until complete",
    },
    { icon: "⭐", title: "4.8+ rated", desc: "Only top-reviewed, consistently reliable pros on the platform" },
    {
      icon: "📱",
      title: "Real-time updates",
      desc: "Track every step via WhatsApp + app",
    },
  ];

  return (
    <section className="border-b border-gray-100 bg-white py-8">
      <div className="container">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {badges.map((b, i) => (
            <div
              key={i}
              className="flex items-start gap-3 sm:flex-col sm:items-center sm:text-center"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-50 text-xl">
                {b.icon}
              </div>
              <div>
                <p className="font-semibold text-gray-900 text-sm">{b.title}</p>
                <p className="mt-0.5 text-xs text-gray-500 leading-snug">
                  {b.desc}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
