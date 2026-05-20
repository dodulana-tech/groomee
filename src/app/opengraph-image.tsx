import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "Groomee - On-demand beauty professionals in Lagos";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          background: "linear-gradient(135deg, #014342 0%, #026564 50%, #014342 100%)",
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "60px",
        }}
      >
        <div
          style={{
            fontSize: 72,
            fontWeight: 900,
            color: "#53eb64",
            marginBottom: 16,
            fontFamily: "serif",
          }}
        >
          Groomee
        </div>
        <div
          style={{
            fontSize: 36,
            color: "white",
            textAlign: "center",
            maxWidth: 800,
            lineHeight: 1.4,
          }}
        >
          Your beauty pro, at your door, right now.
        </div>
        <div
          style={{
            display: "flex",
            gap: 40,
            marginTop: 48,
            color: "#fffea1",
            fontSize: 20,
          }}
        >
          <span>💇🏿‍♀️ Hair</span>
          <span>💄 Makeup</span>
          <span>💅🏿 Nails</span>
          <span>✂️ Barbing</span>
          <span>👁️ Lashes</span>
        </div>
        <div
          style={{
            position: "absolute",
            bottom: 40,
            fontSize: 22,
            color: "rgba(255,255,255,0.7)",
          }}
        >
          groomee.ng — Lagos & Abuja
        </div>
      </div>
    ),
    { ...size }
  );
}
