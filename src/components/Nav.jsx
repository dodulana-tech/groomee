"use client";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

export default function Nav({ variant = "default", user = null }) {
  const pathname = usePathname();
  const isLoggedIn = !!user;
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <nav className="nav">
      <Link href="/" className="nav-logo" style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
        <Image
          src="/assets/logo/groomee-logo-teal.jpg"
          alt="Groomee"
          width={32}
          height={32}
          style={{ borderRadius: "50%" }}
        />
        Groomee<em>.</em>
      </Link>

      <div className="nav-links">
        <Link href="/#how-it-works">How it works</Link>
        <Link href="/search">Services</Link>
        <Link href="/#survey">For Beauty Pros</Link>
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
