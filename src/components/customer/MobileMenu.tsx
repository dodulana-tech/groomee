"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";

interface Props {
  session: { userId: string; phone: string; role: string } | null;
}

const NAV_LINKS = [
  { href: "/search", label: "Find a pro" },
  { href: "/#services", label: "Services" },
  { href: "/#how-it-works", label: "How it works" },
  { href: "/#about", label: "Our story" },
  { href: "/#waitlist", label: "Abuja waitlist" },
  { href: "/partner/login", label: "List your business" },
  { href: "/subscriptions", label: "Subscriptions" },
  { href: "/gift", label: "Gift a service" },
];

export default function MobileMenu({ session }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <div className="lg:hidden">
      {/* Hamburger button */}
      <button
        onClick={() => setOpen(!open)}
        aria-label="Toggle menu"
        className="flex h-9 w-9 items-center justify-center rounded-lg text-white/80 hover:bg-white/10 transition-colors"
      >
        {open ? (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        ) : (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <line x1="3" y1="6" x2="21" y2="6" />
            <line x1="3" y1="12" x2="21" y2="12" />
            <line x1="3" y1="18" x2="21" y2="18" />
          </svg>
        )}
      </button>

      {/* Overlay + drawer — portaled to body to escape navbar's backdrop-filter containing block */}
      {open && createPortal(
        <>
          <div
            className="fixed inset-0 z-[90] bg-black/50 backdrop-blur-sm animate-fade-in"
            onClick={() => setOpen(false)}
          />
          <nav
            role="navigation"
            aria-label="Mobile menu"
            className="fixed inset-y-0 right-0 z-[95] w-72 overflow-y-auto bg-brand-deep border-l border-white/10 shadow-2xl"
            style={{
              paddingBottom: "env(safe-area-inset-bottom, 0px)",
              animation: "slideInRight 0.3s cubic-bezier(0.16, 1, 0.3, 1)",
            }}
          >
            {/* Close */}
            <div className="flex h-14 items-center justify-end px-4">
              <button
                onClick={() => setOpen(false)}
                className="flex h-9 w-9 items-center justify-center rounded-lg text-white/80 hover:bg-white/10"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            {/* Links */}
            <div className="flex flex-col gap-1 px-4 pb-6">
              {NAV_LINKS.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setOpen(false)}
                  className="rounded-xl px-4 py-3 text-sm font-medium text-white/80 hover:bg-white/10 hover:text-white transition-colors"
                >
                  {link.label}
                </Link>
              ))}

              <div className="my-3 border-t border-white/10" />

              {session ? (
                <>
                  <Link
                    href="/profile"
                    onClick={() => setOpen(false)}
                    className="rounded-xl px-4 py-3 text-sm font-medium text-white/80 hover:bg-white/10 transition-colors"
                  >
                    My profile
                  </Link>
                  <Link
                    href="/bookings"
                    onClick={() => setOpen(false)}
                    className="rounded-xl px-4 py-3 text-sm font-medium text-white/80 hover:bg-white/10 transition-colors"
                  >
                    My bookings
                  </Link>
                  <Link
                    href="/profile/points"
                    onClick={() => setOpen(false)}
                    className="rounded-xl px-4 py-3 text-sm font-medium text-brand-400 hover:bg-white/10 transition-colors"
                  >
                    ✨ My points
                  </Link>
                  {session.role === "ADMIN" && (
                    <Link
                      href="/admin"
                      onClick={() => setOpen(false)}
                      className="rounded-xl px-4 py-3 text-sm font-medium text-brand-400 hover:bg-white/10 transition-colors"
                    >
                      ⚙️ Admin panel
                    </Link>
                  )}
                </>
              ) : (
                <Link
                  href="/auth"
                  onClick={() => setOpen(false)}
                  className="mx-4 mt-2 rounded-xl bg-brand-400 py-3 text-center text-sm font-bold text-brand-deep hover:bg-brand-300 transition-colors"
                >
                  Log in / Sign up
                </Link>
              )}
            </div>
          </nav>
        </>,
        document.body
      )}
    </div>
  );
}
