import Image from "next/image";
import Link from "next/link";

const LINKS = {
  Services: [
    { href: "/search?category=HAIR", label: "Hair" },
    { href: "/search?category=MAKEUP", label: "Makeup" },
    { href: "/search?category=NAILS", label: "Nails" },
    { href: "/search?category=BARBING", label: "Barbing" },
    { href: "/search?category=LASHES", label: "Lashes" },
    { href: "/search?category=SKINCARE", label: "Skincare" },
  ],
  Company: [
    { href: "/#about", label: "Our story" },
    { href: "/#survey", label: "List your business" },
    { href: "/#abuja-waitlist", label: "Abuja waitlist" },
  ],
  Support: [
    { href: "/profile", label: "Help centre" },
    { href: "mailto:hello@groomee.ng", label: "Contact us" },
    { href: "#", label: "Safety (Coming soon)" },
    { href: "#", label: "Privacy policy (Coming soon)" },
  ],
};

export default function Footer() {
  return (
    <>
      <footer className="bg-gray-950 text-white/50 py-12 px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {/* Brand */}
          <div>
            <div className="mb-4 flex items-center gap-2">
              <Image
                src="/assets/logo/groomee-logo-teal.jpg"
                alt="Groomee"
                width={28}
                height={28}
                className="rounded-full"
              />
              <span className="font-display text-lg font-black text-white">Groomee</span>
            </div>
            <p className="text-sm leading-relaxed max-w-xs">
              On-demand beauty in Lagos. Abuja coming soon. Show up ready, every time.
            </p>
          </div>

          {/* Link columns */}
          {Object.entries(LINKS).map(([heading, links]) => (
            <div key={heading}>
              <h4 className="mb-4 text-xs font-bold uppercase tracking-widest text-white/90">
                {heading}
              </h4>
              <ul className="space-y-2">
                {links.map((link) => (
                  <li key={link.label}>
                    <Link
                      href={link.href}
                      className="text-sm text-white/45 hover:text-white/90 transition-colors"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </footer>

      {/* Bottom bar */}
      <div className="bg-gray-950 border-t border-white/5 py-4 px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl flex flex-col sm:flex-row justify-between items-center gap-2 text-xs text-white/30">
          <span>© {new Date().getFullYear()} Groomee. All rights reserved.</span>
          <span>Lagos, Nigeria · Abuja coming soon</span>
        </div>
      </div>
    </>
  );
}
