import Link from "next/link";
import { LOGO_TEAL_BASE64 } from "@/lib/logo";

const SERVICES = [
  { href: "/search?service=knotless-braids", label: "Hair styling" },
  { href: "/search?service=full-glam-makeup", label: "Makeup" },
  { href: "/search?service=gel-nails", label: "Nails" },
  { href: "/search?service=haircut-fade", label: "Barbing" },
  { href: "/search?service=classic-lashes", label: "Lashes" },
  { href: "/search?service=facial-glow", label: "Skincare" },
];

const COMPANY = [
  { href: "/#about", label: "Our story" },
  { href: "/partner/onboarding", label: "Become a pro" },
  { href: "/#waitlist", label: "Abuja waitlist" },
  { href: "/#survey", label: "Take our survey" },
];

const SUPPORT = [
  { href: "mailto:hello@groomeeapp.com", label: "Contact us" },
  { href: "/auth", label: "My account" },
  { href: "/bookings", label: "My bookings" },
  { href: "/partner/login", label: "Pro portal" },
];

const TRUST_BADGES = [
  {
    icon: "🛡️",
    title: "ID-verified pros",
    desc: "Government ID checked before first job",
  },
  {
    icon: "💳",
    title: "Secure payments",
    desc: "Held by Paystack until you confirm",
  },
  {
    icon: "⭐",
    title: "4.8+ average rating",
    desc: "Only top-reviewed pros on the platform",
  },
  {
    icon: "📱",
    title: "Real-time tracking",
    desc: "WhatsApp updates at every step",
  },
];

const SOCIAL = [
  {
    label: "Instagram",
    href: "https://instagram.com/groomeeapp",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="2" width="20" height="20" rx="5" />
        <circle cx="12" cy="12" r="5" />
        <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
      </svg>
    ),
  },
  {
    label: "Twitter",
    href: "https://twitter.com/groomeeapp",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
      </svg>
    ),
  },
  {
    label: "TikTok",
    href: "https://tiktok.com/@groomeeapp",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
        <path d="M16.6 5.82s.51.5 0 0A4.278 4.278 0 0115.54 3h-3.09v12.4a2.592 2.592 0 01-2.59 2.5c-1.42 0-2.6-1.16-2.6-2.6 0-1.72 1.66-3.01 3.37-2.48V9.66c-3.45-.46-6.47 2.22-6.47 5.64 0 3.33 2.76 5.7 5.69 5.7 3.14 0 5.69-2.55 5.69-5.7V9.01a7.35 7.35 0 004.3 1.38V7.3s-1.88.09-3.24-1.48z" />
      </svg>
    ),
  },
  {
    label: "WhatsApp",
    href: "https://wa.me/2348000000000",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
      </svg>
    ),
  },
];

export default function Footer() {
  return (
    <footer className="bg-[#0a0f0b]">
      {/* ── Trust Strip ── */}
      <div className="border-b border-white/[0.06]">
        <div className="mx-auto max-w-7xl px-6 py-8 sm:px-10 sm:py-10">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
            {TRUST_BADGES.map((b) => (
              <div
                key={b.title}
                className="flex items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3"
              >
                <span className="shrink-0 text-xl">{b.icon}</span>
                <div className="min-w-0">
                  <p className="text-sm font-bold text-white/80 truncate">
                    {b.title}
                  </p>
                  <p className="text-[11px] leading-snug text-white/30 truncate">
                    {b.desc}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── CTA Banner ── */}
      <div className="border-b border-white/[0.06]">
        <div className="mx-auto max-w-7xl px-6 sm:px-10">
          <div className="flex flex-col items-center gap-6 py-14 text-center sm:flex-row sm:justify-between sm:text-left">
            <div>
              <h3 className="font-display text-2xl font-bold text-white sm:text-3xl">
                Ready to look your best?
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-white/40">
                Book a vetted beauty professional in under 60 seconds.
              </p>
            </div>
            <div className="flex shrink-0 flex-wrap justify-center gap-3 sm:justify-start">
              <Link
                href="/search"
                className="inline-flex items-center gap-2 rounded-xl bg-[#53eb64] px-6 py-3.5 text-sm font-bold text-[#0a0a0a] transition-all hover:-translate-y-0.5 hover:shadow-[0_8px_20px_rgba(83,235,100,0.3)] active:scale-[0.97]"
              >
                Book a pro
              </Link>
              <Link
                href="/partner/onboarding"
                className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-6 py-3.5 text-sm font-semibold text-white/60 transition-all hover:border-white/20 hover:text-white"
              >
                Join as a pro
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* ── Main Grid ── */}
      <div className="mx-auto max-w-7xl px-6 py-16 sm:px-10 sm:py-20">
        <div className="grid gap-12 sm:gap-16 lg:grid-cols-[2fr_1fr_1fr_1fr]">
          {/* Brand */}
          <div>
            <div className="mb-5 flex items-center gap-2.5">
              <img
                src={LOGO_TEAL_BASE64}
                alt="Groomee"
                width={32}
                height={32}
                className="rounded-full"
              />
              <span className="font-display text-lg font-black text-white">
                Groomee<span className="text-[#53eb64]">.</span>
              </span>
            </div>
            <p className="mb-6 max-w-sm text-sm leading-[1.8] text-white/30">
              On-demand beauty for Lagos. Vetted professionals delivered to your
              door &mdash; anytime, anywhere. Abuja launching soon.
            </p>

            {/* Contact */}
            <div className="mb-8">
              <a
                href="mailto:hello@groomeeapp.com"
                className="text-sm font-medium text-[#53eb64]/60 transition-colors hover:text-[#53eb64]"
              >
                hello@groomeeapp.com
              </a>
            </div>

            {/* Social */}
            <div className="flex items-center gap-2.5">
              {SOCIAL.map((s) => (
                <a
                  key={s.label}
                  href={s.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={s.label}
                  className="flex h-10 w-10 items-center justify-center rounded-lg border border-white/[0.06] bg-white/[0.02] text-white/30 transition-all hover:border-white/12 hover:bg-white/[0.05] hover:text-white/70"
                >
                  {s.icon}
                </a>
              ))}
            </div>
          </div>

          {/* Services */}
          <div>
            <h4 className="mb-5 text-[0.65rem] font-bold uppercase tracking-[0.15em] text-white/40">
              Services
            </h4>
            <ul className="space-y-3">
              {SERVICES.map((l) => (
                <li key={l.label}>
                  <Link
                    href={l.href}
                    className="inline-block py-1.5 text-[0.85rem] text-white/30 transition-colors hover:text-white/60"
                  >
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Company */}
          <div>
            <h4 className="mb-5 text-[0.65rem] font-bold uppercase tracking-[0.15em] text-white/40">
              Company
            </h4>
            <ul className="space-y-3">
              {COMPANY.map((l) => (
                <li key={l.label}>
                  <Link
                    href={l.href}
                    className="inline-block py-1.5 text-[0.85rem] text-white/30 transition-colors hover:text-white/60"
                  >
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Support */}
          <div>
            <h4 className="mb-5 text-[0.65rem] font-bold uppercase tracking-[0.15em] text-white/40">
              Support
            </h4>
            <ul className="space-y-3">
              {SUPPORT.map((l) => (
                <li key={l.label}>
                  <Link
                    href={l.href}
                    className="inline-block py-1.5 text-[0.85rem] text-white/30 transition-colors hover:text-white/60"
                  >
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {/* ── Bottom Bar ── */}
      <div className="border-t border-white/[0.04]">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-3 px-6 py-6 sm:flex-row sm:px-10">
          <span className="text-xs text-white/15">
            &copy; {new Date().getFullYear()} Groomee Technologies. All rights
            reserved.
          </span>
          <div className="flex items-center gap-4 text-xs text-white/15">
            <span>Lagos, Nigeria</span>
            <span className="h-3 w-px bg-white/[0.06]" />
            <span className="text-[#7c3aed]/40">Abuja coming soon</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
