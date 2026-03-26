import Image from "next/image";
import Link from "next/link";
import { getSession } from "@/lib/auth";
import PointsBadge from "./PointsBadge";

const linkStyle: React.CSSProperties = {
  fontSize: "0.9rem",
  fontWeight: 500,
  color: "rgba(255,255,255,0.72)",
  textDecoration: "none",
  transition: "color 0.2s",
};

const vendorLinkStyle: React.CSSProperties = {
  ...linkStyle,
  color: "#53eb64",
  fontWeight: 600,
};

export default async function Navbar() {
  const session = await getSession();

  return (
    <nav
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        zIndex: 100,
        background: "rgba(1,67,66,0.97)",
        backdropFilter: "blur(16px)",
        WebkitBackdropFilter: "blur(16px)",
        borderBottom: "1px solid rgba(83,235,100,0.15)",
        padding: "0 5%",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        height: 68,
      }}
    >
      <Link href="/" style={{ display: "flex", alignItems: "center", height: "100%" }}>
        <Image
          src="/assets/logo/groomee-wordmark-green.png"
          alt="Groomee"
          width={140}
          height={36}
          style={{ height: 32, width: "auto", display: "block" }}
          priority
        />
      </Link>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "2rem",
          listStyle: "none",
        }}
        className="hidden lg:flex"
      >
        <Link href="/#services" style={linkStyle}>
          Services
        </Link>
        <Link href="/#how-it-works" style={linkStyle}>
          How it works
        </Link>
        <Link href="/#about" style={linkStyle}>
          Our story
        </Link>
        <Link href="/#abuja-waitlist" style={vendorLinkStyle}>
          Abuja waitlist
        </Link>
        <Link href="/#survey" style={vendorLinkStyle}>
          List your business
        </Link>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
        {session ? (
          <>
            {session.role === "ADMIN" && (
              <Link
                href="/admin"
                className="hidden lg:flex"
                style={{
                  fontSize: "0.875rem",
                  fontWeight: 500,
                  color: "rgba(255,255,255,0.8)",
                  background: "transparent",
                  border: "1.5px solid rgba(83,235,100,0.3)",
                  padding: "0.5rem 1.1rem",
                  borderRadius: 8,
                  textDecoration: "none",
                  transition: "all 0.2s",
                }}
              >
                ⚙️ Admin
              </Link>
            )}
            <PointsBadge />
            <Link
              href="/profile"
              aria-label="My profile"
              style={{
                width: 36,
                height: 36,
                borderRadius: "50%",
                background: "rgba(83,235,100,0.2)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "0.85rem",
                fontWeight: 700,
                color: "#53eb64",
                textDecoration: "none",
              }}
            >
              {session.phone?.slice(-2) ?? "👤"}
            </Link>
          </>
        ) : (
          <>
            <Link
              href="/auth"
              className="hidden lg:block"
              style={{
                fontSize: "0.875rem",
                fontWeight: 500,
                color: "rgba(255,255,255,0.8)",
                background: "transparent",
                border: "1.5px solid rgba(83,235,100,0.3)",
                padding: "0.5rem 1.1rem",
                borderRadius: 8,
                textDecoration: "none",
                transition: "all 0.2s",
              }}
            >
              Log in
            </Link>
            <Link
              href="/search"
              style={{
                fontSize: "0.875rem",
                fontWeight: 600,
                color: "#0a0a0a",
                background: "#53eb64",
                border: "none",
                padding: "0.5rem 1.25rem",
                borderRadius: 8,
                display: "flex",
                alignItems: "center",
                gap: "0.4rem",
                textDecoration: "none",
                transition: "all 0.2s",
              }}
            >
              ⚡ Book now
            </Link>
          </>
        )}
      </div>
    </nav>
  );
}
