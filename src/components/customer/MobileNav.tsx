"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/", label: "Home", match: (p: string) => p === "/" },
  {
    href: "/search",
    label: "Explore",
    match: (p: string) => p.startsWith("/search"),
  },
  {
    href: "/bookings",
    label: "Bookings",
    match: (p: string) => p.startsWith("/book"),
  },
  {
    href: "/profile",
    label: "Account",
    match: (p: string) => p.startsWith("/profile"),
  },
];

export default function MobileNav() {
  const pathname = usePathname();

  return (
    <nav
      className="bottom-nav lg:hidden"
      style={{ display: "flex", height: "64px" }}
    >
      {TABS.map((tab) => {
        const active = tab.match(pathname);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: "4px",
              textDecoration: "none",
              position: "relative",
              transition: "color 0.2s ease",
              color: active ? "#1A3A2A" : "#9CA3AF",
            }}
          >
            <div style={{
              transition: "transform 0.2s ease",
              transform: active ? "scale(1.1)" : "scale(1)",
            }}>
              <TabIcon name={tab.label} active={!!active} />
            </div>
            <span
              style={{
                fontSize: "11px",
                fontWeight: active ? 700 : 500,
                letterSpacing: "0.3px",
                transition: "font-weight 0.15s ease",
              }}
            >
              {tab.label}
            </span>
            <span
              style={{
                position: "absolute",
                bottom: 0,
                left: "50%",
                transform: "translateX(-50%)",
                width: active ? "32px" : "0px",
                height: "2px",
                background: "#1A3A2A",
                borderRadius: "2px 2px 0 0",
                transition: "width 0.25s cubic-bezier(0.4, 0, 0.2, 1)",
              }}
            />
          </Link>
        );
      })}
    </nav>
  );
}

function TabIcon({ name, active }: { name: string; active: boolean }) {
  const color = active ? "#1A3A2A" : "#9CA3AF";
  const w = 22;

  if (name === "Home")
    return (
      <svg
        width={w}
        height={w}
        viewBox="0 0 24 24"
        fill="none"
        stroke={color}
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
        <polyline points="9,22 9,12 15,12 15,22" />
      </svg>
    );

  if (name === "Explore")
    return (
      <svg
        width={w}
        height={w}
        viewBox="0 0 24 24"
        fill="none"
        stroke={color}
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <circle cx="11" cy="11" r="8" />
        <line x1="21" y1="21" x2="16.65" y2="16.65" />
      </svg>
    );

  if (name === "Bookings")
    return (
      <svg
        width={w}
        height={w}
        viewBox="0 0 24 24"
        fill="none"
        stroke={color}
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <rect x="3" y="4" width="18" height="18" rx="2" />
        <line x1="16" y1="2" x2="16" y2="6" />
        <line x1="8" y1="2" x2="8" y2="6" />
        <line x1="3" y1="10" x2="21" y2="10" />
      </svg>
    );

  return (
    <svg
      width={w}
      height={w}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}
