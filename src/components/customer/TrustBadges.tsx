export default function TrustBadges() {
  const badges = [
    {
      icon: "🛡️",
      title: "ID-verified pros",
      desc: "Government ID checked before first job",
      color: "bg-emerald-50 border-emerald-100",
    },
    {
      icon: "💳",
      title: "Secure payments",
      desc: "Held by Paystack until you confirm",
      color: "bg-blue-50 border-blue-100",
    },
    {
      icon: "⭐",
      title: "4.8+ average rating",
      desc: "Only top-reviewed pros on the platform",
      color: "bg-amber-50 border-amber-100",
    },
    {
      icon: "📱",
      title: "Real-time tracking",
      desc: "WhatsApp updates at every step",
      color: "bg-purple-50 border-purple-100",
    },
  ];

  return (
    <section className="border-y border-gray-100 bg-white/80 backdrop-blur-sm py-6">
      <div className="container">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
          {badges.map((b, i) => (
            <div
              key={i}
              className={`flex items-center gap-3 rounded-xl border ${b.color} px-4 py-3 transition-all hover:shadow-sm`}
            >
              <span className="shrink-0 text-xl">{b.icon}</span>
              <div className="min-w-0">
                <p className="text-sm font-bold text-gray-900 truncate">
                  {b.title}
                </p>
                <p className="text-[11px] leading-snug text-gray-500 truncate">
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
