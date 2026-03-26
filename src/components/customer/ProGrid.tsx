import Link from "next/link";
import { formatNaira } from "@/lib/utils";

const EMOJI_MAP: Record<string, string> = {
  HAIR: "💇🏿‍♀️",
  MAKEUP: "💄",
  NAILS: "💅🏿",
  BARBING: "✂️",
  LASHES: "👁️",
  SKINCARE: "✨",
};

interface Props {
  pros: Array<{
    id: string;
    name: string;
    photo: string | null;
    availability: string;
    avgRating: number;
    reviewCount: number;
    totalJobs: number;
    services: Array<{
      service: { name: string; basePrice: number; category: string };
      customPrice: number | null;
    }>;
    zones: Array<{ zone: { name: string } }>;
  }>;
  searchParams: { service?: string };
}

export default function ProGrid({ pros, searchParams }: Props) {
  if (pros.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-3xl border-2 border-dashed border-gray-200 py-20 text-center">
        <span className="mb-4 text-5xl">🔍</span>
        <p className="font-bold text-gray-700 text-lg">No pros found</p>
        <p className="mt-2 text-sm text-gray-500 max-w-xs">
          Try removing filters or searching in a different zone. More pros
          are being added daily.
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
      {pros.map((pro) => {
        const firstService = pro.services[0];
        const price = firstService
          ? (firstService.customPrice ?? firstService.service.basePrice)
          : 0;
        const isOnline = pro.availability === "ONLINE";
        const mainCat = firstService?.service.category ?? "HAIR";
        const href = `/pro/${pro.id}${searchParams.service ? `?service=${searchParams.service}` : ""}`;
        const initial = pro.name.charAt(0);

        return (
          <Link
            key={pro.id}
            href={href}
            style={{
              border: "1px solid rgba(13,61,38,0.07)",
              borderRadius: 16,
              overflow: "hidden",
              transition: "all 0.25s",
              background: "#ffffff",
              display: "flex",
              flexDirection: "column",
              textDecoration: "none",
              color: "inherit",
            }}
            className="group hover:shadow-lg hover:-translate-y-1 hover:border-[#b4f5bb]"
          >
            {/* Photo area */}
            <div
              style={{
                height: 220,
                position: "relative",
                overflow: "hidden",
              }}
            >
              {pro.photo ? (
                <img
                  src={pro.photo}
                  alt={pro.name}
                  style={{
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                    transition: "transform 0.4s ease",
                  }}
                  className="group-hover:scale-105"
                />
              ) : (
                <div
                  style={{
                    width: "100%",
                    height: "100%",
                    background: "linear-gradient(135deg, #012e2e, #016060)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <span
                    style={{
                      fontFamily: "'Playfair Display', serif",
                      fontSize: "4rem",
                      fontWeight: 900,
                      color: "rgba(83,235,100,0.15)",
                    }}
                  >
                    {initial}
                  </span>
                </div>
              )}

              {/* Badges overlay */}
              {isOnline && (
                <div
                  style={{
                    position: "absolute",
                    top: 12,
                    left: 12,
                    display: "flex",
                    alignItems: "center",
                    gap: 5,
                    fontSize: "0.72rem",
                    fontWeight: 700,
                    color: "white",
                    background: "rgba(1,67,66,0.85)",
                    backdropFilter: "blur(8px)",
                    padding: "5px 10px",
                    borderRadius: 100,
                    letterSpacing: "0.03em",
                  }}
                >
                  <span
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: "50%",
                      background: "#53eb64",
                      boxShadow: "0 0 0 2px rgba(83,235,100,0.3)",
                      display: "inline-block",
                    }}
                  />
                  Available now
                </div>
              )}

              {pro.avgRating >= 4.8 && (
                <div
                  style={{
                    position: "absolute",
                    top: 12,
                    right: 12,
                    fontSize: "0.72rem",
                    fontWeight: 700,
                    color: "#92400e",
                    background: "rgba(251,191,36,0.9)",
                    backdropFilter: "blur(8px)",
                    padding: "4px 10px",
                    borderRadius: 100,
                  }}
                >
                  ⭐ Top rated
                </div>
              )}

              {/* Jobs count - bottom right */}
              {pro.totalJobs > 0 && (
                <div
                  style={{
                    position: "absolute",
                    bottom: 10,
                    right: 10,
                    fontSize: "0.7rem",
                    fontWeight: 600,
                    color: "white",
                    background: "rgba(0,0,0,0.5)",
                    backdropFilter: "blur(6px)",
                    padding: "4px 10px",
                    borderRadius: 8,
                  }}
                >
                  {pro.totalJobs} jobs done
                </div>
              )}

              {/* ID verified badge - bottom left */}
              <div
                style={{
                  position: "absolute",
                  bottom: 10,
                  left: 12,
                  fontSize: "0.7rem",
                  fontWeight: 600,
                  color: "white",
                  background: "rgba(1,67,66,0.7)",
                  backdropFilter: "blur(6px)",
                  padding: "4px 10px",
                  borderRadius: 8,
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                }}
              >
                🛡️ ID verified
              </div>
            </div>

            {/* Info body */}
            <div style={{ padding: "16px 20px 20px", flex: 1, display: "flex", flexDirection: "column" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                <div>
                  <h3
                    style={{ fontSize: "0.95rem", fontWeight: 700, color: "#0a0a0a", marginBottom: 2 }}
                    className="group-hover:text-[#016060] transition-colors"
                  >
                    {pro.name}
                  </h3>
                  <p style={{ fontSize: "0.78rem", color: "#7a9a7c", display: "flex", alignItems: "center", gap: 4 }}>
                    📍 {pro.zones[0]?.zone.name ?? "Lagos"}
                  </p>
                </div>
                <div style={{ textAlign: "right", flexShrink: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    <span style={{ color: "#f59e0b", fontSize: "0.8rem" }}>★</span>
                    <span style={{ fontFamily: "'DM Mono', monospace", fontSize: "0.8rem", fontWeight: 500, color: "#0a0a0a" }}>
                      {pro.avgRating > 0 ? pro.avgRating.toFixed(1) : "New"}
                    </span>
                  </div>
                  <span style={{ fontSize: "0.72rem", color: "#7a9a7c" }}>
                    ({pro.reviewCount})
                  </span>
                </div>
              </div>

              {/* Service tags */}
              <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginTop: 10, marginBottom: 14 }}>
                {pro.services.slice(0, 3).map((gs) => (
                  <span
                    key={gs.service.name}
                    style={{
                      fontSize: "0.7rem",
                      fontWeight: 500,
                      color: "#016060",
                      background: "#f1fef2",
                      border: "1px solid #b4f5bb",
                      padding: "3px 9px",
                      borderRadius: 100,
                    }}
                  >
                    {gs.service.name}
                  </span>
                ))}
                {pro.services.length > 3 && (
                  <span
                    style={{
                      fontSize: "0.7rem",
                      fontWeight: 500,
                      color: "#7a9a7c",
                      background: "#f1fef2",
                      border: "1px solid #b4f5bb",
                      padding: "3px 9px",
                      borderRadius: 100,
                    }}
                  >
                    +{pro.services.length - 3}
                  </span>
                )}
              </div>

              {/* Price + Book */}
              <div style={{ marginTop: "auto", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ fontFamily: "'DM Mono', monospace", fontSize: "0.85rem", fontWeight: 500, color: "#0a0a0a" }}>
                  {formatNaira(price)}{" "}
                  <span style={{ fontSize: "0.72rem", color: "#7a9a7c", fontFamily: "'DM Sans', sans-serif" }}>from</span>
                </span>
                <span
                  style={{
                    background: "#014342",
                    color: "white",
                    fontSize: "0.85rem",
                    fontWeight: 600,
                    padding: "10px 16px",
                    borderRadius: 8,
                    transition: "background 0.2s",
                  }}
                  className="group-hover:bg-[#016060]"
                >
                  Book →
                </span>
              </div>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
