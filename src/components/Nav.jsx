"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

export default function Nav({ variant = "default", user = null }) {
  const pathname = usePathname();
  const isLoggedIn = !!user;
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <nav className="nav">
      <Link href="/" className="nav-logo">
        Groomee<em>.</em>
      </Link>

      <div className="nav-links">
        <Link href="/#how-it-works">How it works</Link>
        <Link href="/search">Services</Link>
        <Link href="/#for-groomers">For Groomers</Link>
      </div>

      <div className="nav-actions">
        {isLoggedIn ? (
          <>
            <Link href="/account" className="btn-ghost">
              My Account
            </Link>
            <Link href="/search" className="btn-orange">
              ⚡ Book Now
            </Link>
          </>
        ) : (
          <>
            <button className="btn-ghost">Log in</button>
            <button className="btn-solid">Get started</button>
            <Link href="/search?asap=true" className="btn-orange">
              ⚡ Emergency booking
            </Link>
          </>
        )}
      </div>
    </nav>
  );
}
