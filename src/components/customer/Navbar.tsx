import Link from "next/link";
import { getSession } from "@/lib/auth";

export default async function Navbar() {
  const session = await getSession();

  return (
    <header className="sticky top-0 z-50 border-b border-gray-100 bg-white/90 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-6 px-4 sm:px-6 lg:px-8">
        {/* Logo */}
        <Link href="/" className="text-accent-400">
          Groomee<span className="text-accent">.</span>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden items-center gap-8 lg:flex">
          <Link
            href="/search"
            className="text-sm font-medium text-gray-600 hover:text-brand-600 transition-colors"
          >
            Find a groomer
          </Link>
          <Link
            href="/#how-it-works"
            className="text-sm font-medium text-gray-600 hover:text-brand-600 transition-colors"
          >
            How it works
          </Link>
          <Link
            href="/#services"
            className="text-sm font-medium text-gray-600 hover:text-brand-600 transition-colors"
          >
            Services
          </Link>
        </nav>

        {/* Actions */}
        <div className="ml-auto flex items-center gap-2 sm:gap-3">
          {/* Emergency CTA — desktop */}
          <Link
            href="/search?asap=true"
            className="hidden items-center gap-1.5 rounded-xl bg-accent-50 border border-accent/30 px-4 py-2 text-sm font-bold text-accent hover:bg-accent hover:text-white transition-all sm:flex"
          >
            <span>⚡</span>
            Emergency booking
          </Link>

          {session ? (
            <>
              {session.role === "ADMIN" && (
                <Link
                  href="/admin"
                  className="hidden rounded-xl bg-gray-900 px-3 py-2 text-xs font-bold text-white hover:bg-gray-700 transition-colors lg:flex items-center gap-1"
                >
                  ⚙️ Admin
                </Link>
              )}
              <Link
                href="/profile"
                className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-100 text-sm font-bold text-brand-700 hover:bg-brand-200 transition-colors ring-2 ring-brand-200"
              >
                {session.phone?.slice(-2) ?? "👤"}
              </Link>
            </>
          ) : (
            <>
              <Link
                href="/auth"
                className="hidden text-sm font-semibold text-gray-600 hover:text-brand-600 transition-colors lg:block"
              >
                Log in
              </Link>
              <Link href="/auth" className="btn-primary btn-sm">
                Sign up free
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
