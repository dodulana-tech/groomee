import { ImageResponse } from "next/og";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const alt = "Groomee Certificate of Freedom";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image({
  params,
}: {
  params: { code: string };
}) {
  const cert = await db.apprenticeship.findUnique({
    where: { freedomCertCode: params.code },
    include: {
      apprentice: { select: { name: true } },
      master: { select: { name: true } },
    },
  });

  const apprenticeName = cert?.apprentice.name ?? "A Groomee Pro";
  const masterName = cert?.master.name ?? "their master";
  const year = cert?.freedomDate
    ? new Date(cert.freedomDate).getFullYear()
    : new Date().getFullYear();

  return new ImageResponse(
    (
      <div
        style={{
          background:
            "linear-gradient(135deg, #014342 0%, #026564 50%, #014342 100%)",
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "60px",
          position: "relative",
        }}
      >
        {/* gold double-border frame */}
        <div
          style={{
            position: "absolute",
            inset: 30,
            border: "4px double #D4A853",
            borderRadius: 24,
            display: "flex",
          }}
        />

        {/* gold seal */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: 110,
            height: 110,
            borderRadius: 999,
            background:
              "radial-gradient(circle at 30% 30%, #fffea1 0%, #D4A853 60%, #936B28 100%)",
            fontSize: 60,
            marginBottom: 8,
          }}
        >
          🎓
        </div>

        <div
          style={{
            color: "#D4A853",
            fontSize: 22,
            fontWeight: 800,
            letterSpacing: "8px",
            textTransform: "uppercase",
            marginTop: 12,
          }}
        >
          Certificate of Freedom
        </div>

        <div
          style={{
            color: "rgba(255,255,255,0.7)",
            fontSize: 18,
            fontStyle: "italic",
            marginTop: 24,
          }}
        >
          This certifies that
        </div>

        <div
          style={{
            color: "#ffffff",
            fontFamily: "serif",
            fontSize: 70,
            fontWeight: 900,
            marginTop: 12,
            textAlign: "center",
            maxWidth: 1000,
            lineHeight: 1.1,
          }}
        >
          {apprenticeName}
        </div>

        <div
          style={{
            color: "#fffea1",
            fontSize: 26,
            marginTop: 20,
            display: "flex",
            gap: 10,
            alignItems: "center",
          }}
        >
          <span style={{ color: "rgba(255,255,255,0.6)" }}>Freed under</span>
          <span style={{ fontWeight: 800 }}>{masterName}</span>
          <span style={{ color: "rgba(255,255,255,0.5)" }}>·</span>
          <span style={{ fontWeight: 800 }}>{year}</span>
        </div>

        <div
          style={{
            position: "absolute",
            bottom: 56,
            color: "rgba(255,255,255,0.6)",
            fontSize: 18,
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          <span style={{ color: "#53eb64", fontWeight: 900 }}>
            groomee<span style={{ color: "#fffea1" }}>.</span>
          </span>
          <span>ng/cert/{params.code}</span>
        </div>
      </div>
    ),
    { ...size },
  );
}
