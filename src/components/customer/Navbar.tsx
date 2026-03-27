import Link from "next/link";
import { getSession } from "@/lib/auth";
import { LOGO_BASE64 } from "@/lib/logo";
import PointsBadge from "./PointsBadge";
import MobileMenu from "./MobileMenu";

export default async function Navbar() {
  const session = await getSession();

  return (
    <nav className="fixed inset-x-0 top-0 z-[100] h-14 border-b border-white/10 bg-brand-deep/97 backdrop-blur-xl lg:h-[68px]">
      <div className="mx-auto flex h-full max-w-7xl items-center justify-between px-4 lg:px-8">
        {/* Logo */}
        <Link href="/" className="flex shrink-0 items-center">
          <img
            src={LOGO_BASE64}
            alt="Groomee"
            width={140}
            height={36}
            className="h-6 w-auto lg:h-8"
          />
        </Link>

        {/* Desktop links */}
        <div className="hidden items-center gap-6 lg:flex">
          <Link href="/#services" className="text-sm font-medium text-white/70 hover:text-white transition-colors">
            Services
          </Link>
          <Link href="/#how-it-works" className="text-sm font-medium text-white/70 hover:text-white transition-colors">
            How it works
          </Link>
          <Link href="/#about" className="text-sm font-medium text-white/70 hover:text-white transition-colors">
            Our story
          </Link>
          <Link href="/#waitlist" className="text-sm font-semibold text-brand-400 hover:text-brand-300 transition-colors">
            Abuja waitlist
          </Link>
          <Link href="/partner/login" className="text-sm font-semibold text-brand-400 hover:text-brand-300 transition-colors">
            List your business
          </Link>
        </div>

        {/* Right side */}
        <div className="flex items-center gap-2 lg:gap-3">
          {session ? (
            <>
              {session.role === "ADMIN" && (
                <Link
                  href="/admin"
                  className="hidden rounded-lg border border-brand-400/30 px-3 py-1.5 text-xs font-medium text-white/80 hover:border-brand-400/60 transition-colors lg:block"
                >
                  Admin
                </Link>
              )}
              <PointsBadge />
              <Link
                href="/profile"
                aria-label="My profile"
                className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-400/20 text-xs font-bold text-brand-400 lg:h-9 lg:w-9"
              >
                {session.phone?.slice(-2) ?? "👤"}
              </Link>
            </>
          ) : (
            <>
              <Link
                href="/auth"
                className="hidden rounded-lg border border-brand-400/30 px-4 py-2 text-sm font-medium text-white/80 hover:border-brand-400/60 transition-colors lg:block"
              >
                Log in
              </Link>
              <Link
                href="/search"
                className="rounded-lg bg-brand-400 px-3.5 py-2 text-xs font-semibold text-brand-deep hover:bg-brand-300 transition-colors lg:px-5 lg:text-sm"
              >
                <span className="hidden sm:inline">⚡ </span>Book now
              </Link>
            </>
          )}

          {/* Mobile hamburger */}
          <MobileMenu session={session} />
        </div>
      </div>
    </nav>
  );
}
