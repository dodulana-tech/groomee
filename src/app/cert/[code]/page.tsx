import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { format } from "date-fns";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";
export const revalidate = 0;

interface PageProps {
  params: Promise<{ code: string }>;
}

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://groomee.ng";

async function loadCert(code: string) {
  return db.apprenticeship.findUnique({
    where: { freedomCertCode: code },
    include: {
      apprentice: {
        select: { id: true, name: true, photo: true },
      },
      master: {
        select: { id: true, name: true, photo: true },
      },
      modules: {
        orderBy: { sortOrder: "asc" },
        select: {
          id: true,
          title: true,
          description: true,
          required: true,
          gatesIndependence: true,
          completedAt: true,
          masterSignoffAt: true,
        },
      },
    },
  });
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { code } = await params;
  const cert = await loadCert(code);
  if (!cert || !cert.freedomDate) {
    return { title: "Certificate not found" };
  }
  const year = new Date(cert.freedomDate).getFullYear();
  const title = `${cert.apprentice.name} — Freed under ${cert.master.name} · ${year}`;
  const description = `Verified Groomee Certificate of Freedom. ${cert.apprentice.name} was freed under master ${cert.master.name} on ${format(new Date(cert.freedomDate), "d MMMM yyyy")}. Cert code: ${code}.`;
  const url = `${APP_URL}/cert/${code}`;
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      type: "article",
      title,
      description,
      url,
      siteName: "Groomee",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
    robots: {
      index: true,
      follow: true,
    },
  };
}

export default async function CertPage({ params }: PageProps) {
  const { code } = await params;
  const cert = await loadCert(code);
  if (!cert || !cert.freedomDate) notFound();

  const completedModules = cert.modules.filter(
    (m) => m.completedAt !== null && m.masterSignoffAt !== null,
  );

  const startedAt = cert.acceptedAt ?? cert.invitedAt;
  const endedAt = cert.freedomDate;
  const year = new Date(endedAt).getFullYear();

  return (
    <div
      style={{
        minHeight: "100vh",
        background:
          "radial-gradient(ellipse at top, #f7f5f0 0%, #e7ebe2 60%, #cdd4c4 100%)",
        padding: "48px 16px",
      }}
    >
      <div style={{ maxWidth: 880, margin: "0 auto" }}>
        {/* Header bar */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 24,
          }}
        >
          <Link
            href="/"
            style={{
              fontSize: 22,
              fontWeight: 900,
              color: "#014342",
              textDecoration: "none",
              letterSpacing: "-0.5px",
            }}
          >
            groomee<span style={{ color: "#53eb64" }}>.</span>
          </Link>
          <Link
            href="https://groomee.ng"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "6px 14px",
              borderRadius: 999,
              background: "rgba(255,255,255,0.7)",
              border: "1px solid #014342",
              color: "#014342",
              fontSize: 12,
              fontWeight: 700,
              textDecoration: "none",
            }}
          >
            ✓ Verify on Groomee.ng
          </Link>
        </div>

        {/* Certificate */}
        <div
          style={{
            position: "relative",
            background:
              "linear-gradient(135deg, #014342 0%, #026564 50%, #014342 100%)",
            borderRadius: 24,
            padding: "8px",
            boxShadow:
              "0 24px 60px rgba(1, 67, 66, 0.35), 0 8px 24px rgba(0,0,0,0.12)",
          }}
        >
          {/* Inner gold double-border */}
          <div
            style={{
              border: "3px double #D4A853",
              borderRadius: 18,
              padding: "44px 28px",
              backdropFilter: "blur(20px)",
              background:
                "linear-gradient(180deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.02) 100%)",
            }}
          >
            {/* Seal */}
            <div style={{ textAlign: "center", marginBottom: 20 }}>
              <div
                style={{
                  display: "inline-block",
                  width: 76,
                  height: 76,
                  lineHeight: "76px",
                  borderRadius: "50%",
                  background:
                    "radial-gradient(circle at 30% 30%, #fffea1 0%, #D4A853 60%, #936B28 100%)",
                  fontSize: 38,
                  textAlign: "center",
                  boxShadow:
                    "0 6px 18px rgba(212, 168, 83, 0.5), inset 0 -3px 6px rgba(0,0,0,0.18), inset 0 3px 6px rgba(255,255,255,0.4)",
                }}
                aria-hidden
              >
                🎓
              </div>
            </div>

            <p
              style={{
                margin: 0,
                textAlign: "center",
                color: "#D4A853",
                fontSize: 13,
                fontWeight: 800,
                letterSpacing: "5px",
                textTransform: "uppercase",
              }}
            >
              Certificate of Freedom
            </p>

            <p
              style={{
                margin: "10px 0 0",
                textAlign: "center",
                color: "rgba(255,255,255,0.7)",
                fontSize: 13,
                fontStyle: "italic",
              }}
            >
              This certifies that
            </p>

            <h1
              style={{
                margin: "12px 0 0",
                textAlign: "center",
                fontFamily: "var(--font-display), 'Playfair Display', Georgia, serif",
                fontSize: 48,
                fontWeight: 900,
                color: "#ffffff",
                lineHeight: 1.1,
                letterSpacing: "-1px",
              }}
            >
              {cert.apprentice.name}
            </h1>

            <p
              style={{
                margin: "20px auto 0",
                textAlign: "center",
                maxWidth: 560,
                color: "rgba(255,255,255,0.85)",
                fontSize: 15,
                lineHeight: 1.7,
              }}
            >
              having completed the full apprenticeship curriculum and met the
              service standards of the Groomee guild, is hereby granted Freedom
              and recognised as an independent beauty professional.
            </p>

            <div
              style={{
                margin: "26px auto 0",
                textAlign: "center",
              }}
            >
              <p
                style={{
                  margin: 0,
                  fontSize: 11,
                  letterSpacing: "3px",
                  color: "rgba(255,255,255,0.55)",
                  textTransform: "uppercase",
                  fontWeight: 700,
                }}
              >
                Freed under
              </p>
              <p
                style={{
                  margin: "6px 0 0",
                  fontFamily:
                    "var(--font-display), 'Playfair Display', Georgia, serif",
                  fontSize: 26,
                  fontWeight: 800,
                  color: "#fffea1",
                  letterSpacing: "-0.5px",
                }}
              >
                {cert.master.name}
              </p>
            </div>

            {/* Dates row */}
            <div
              style={{
                marginTop: 32,
                display: "grid",
                gridTemplateColumns: "1fr 1fr 1fr",
                gap: 12,
                color: "rgba(255,255,255,0.85)",
                textAlign: "center",
                borderTop: "1px solid rgba(255,255,255,0.18)",
                borderBottom: "1px solid rgba(255,255,255,0.18)",
                padding: "16px 8px",
              }}
            >
              <div>
                <p
                  style={{
                    margin: 0,
                    fontSize: 10,
                    letterSpacing: "2px",
                    color: "rgba(255,255,255,0.55)",
                    textTransform: "uppercase",
                    fontWeight: 700,
                  }}
                >
                  Began
                </p>
                <p
                  style={{
                    margin: "4px 0 0",
                    fontSize: 14,
                    fontWeight: 700,
                  }}
                >
                  {format(new Date(startedAt), "d MMM yyyy")}
                </p>
              </div>
              <div>
                <p
                  style={{
                    margin: 0,
                    fontSize: 10,
                    letterSpacing: "2px",
                    color: "rgba(255,255,255,0.55)",
                    textTransform: "uppercase",
                    fontWeight: 700,
                  }}
                >
                  Freed
                </p>
                <p
                  style={{
                    margin: "4px 0 0",
                    fontSize: 14,
                    fontWeight: 700,
                  }}
                >
                  {format(new Date(endedAt), "d MMM yyyy")}
                </p>
              </div>
              <div>
                <p
                  style={{
                    margin: 0,
                    fontSize: 10,
                    letterSpacing: "2px",
                    color: "rgba(255,255,255,0.55)",
                    textTransform: "uppercase",
                    fontWeight: 700,
                  }}
                >
                  Year
                </p>
                <p
                  style={{
                    margin: "4px 0 0",
                    fontSize: 14,
                    fontWeight: 700,
                  }}
                >
                  {year}
                </p>
              </div>
            </div>

            {/* Verification code */}
            <div style={{ marginTop: 22, textAlign: "center" }}>
              <p
                style={{
                  margin: 0,
                  fontSize: 11,
                  letterSpacing: "3px",
                  color: "rgba(255,255,255,0.55)",
                  textTransform: "uppercase",
                  fontWeight: 700,
                }}
              >
                Verification code
              </p>
              <p
                style={{
                  margin: "8px 0 0",
                  fontFamily: "'Courier New', monospace",
                  fontSize: 22,
                  fontWeight: 900,
                  color: "#53eb64",
                  letterSpacing: "5px",
                }}
              >
                {cert.freedomCertCode}
              </p>
            </div>
          </div>
        </div>

        {/* Curriculum modules */}
        <div
          style={{
            marginTop: 28,
            background: "rgba(255,255,255,0.85)",
            backdropFilter: "blur(20px)",
            border: "1px solid rgba(255,255,255,0.6)",
            borderRadius: 20,
            padding: "24px 24px",
            boxShadow: "0 4px 24px rgba(0,0,0,0.06)",
          }}
        >
          <h2
            style={{
              margin: 0,
              fontFamily:
                "var(--font-display), 'Playfair Display', Georgia, serif",
              fontSize: 22,
              fontWeight: 800,
              color: "#014342",
            }}
          >
            Curriculum completed
          </h2>
          <p
            style={{
              margin: "4px 0 16px",
              fontSize: 13,
              color: "#5b6a5d",
            }}
          >
            Every module below was completed under direct master sign-off.
          </p>

          {completedModules.length === 0 ? (
            <p style={{ fontSize: 14, color: "#7a9a7c", margin: 0 }}>
              No modules on file.
            </p>
          ) : (
            <ul
              style={{
                listStyle: "none",
                padding: 0,
                margin: 0,
                display: "grid",
                gap: 10,
              }}
            >
              {completedModules.map((m) => (
                <li
                  key={m.id}
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 12,
                    padding: "12px 14px",
                    borderRadius: 12,
                    background: "rgba(83, 235, 100, 0.08)",
                    border: "1px solid rgba(83, 235, 100, 0.25)",
                  }}
                >
                  <span
                    style={{
                      flex: "0 0 22px",
                      width: 22,
                      height: 22,
                      borderRadius: "50%",
                      background: "#53eb64",
                      color: "#014342",
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 13,
                      fontWeight: 900,
                      marginTop: 1,
                    }}
                    aria-hidden
                  >
                    ✓
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p
                      style={{
                        margin: 0,
                        fontSize: 14,
                        fontWeight: 700,
                        color: "#0d1b12",
                      }}
                    >
                      {m.title}
                    </p>
                    {m.description && (
                      <p
                        style={{
                          margin: "3px 0 0",
                          fontSize: 12,
                          color: "#3c4d3d",
                          lineHeight: 1.55,
                        }}
                      >
                        {m.description}
                      </p>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Footer / verify */}
        <div
          style={{
            marginTop: 24,
            textAlign: "center",
            color: "#5b6a5d",
            fontSize: 12,
            lineHeight: 1.7,
          }}
        >
          <p style={{ margin: 0 }}>
            This certificate is issued and verified by{" "}
            <Link
              href="/"
              style={{ color: "#014342", fontWeight: 700, textDecoration: "none" }}
            >
              Groomee
            </Link>
            . Anyone can verify it by visiting{" "}
            <span style={{ fontFamily: "monospace" }}>
              groomee.ng/cert/{cert.freedomCertCode}
            </span>
            .
          </p>
          <p style={{ margin: "4px 0 0" }}>
            Groomee &middot; Beauty at your door, right now.
          </p>
        </div>
      </div>
    </div>
  );
}
