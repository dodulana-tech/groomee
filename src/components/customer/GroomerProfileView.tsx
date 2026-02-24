"use client";

import { useState } from "react";
import Link from "next/link";
import { formatNaira } from "@/lib/utils";
import BookingPanel from "./BookingPanel";

interface Review {
  author: string;
  rating: number;
  text: string;
  date: string;
}
interface ServiceItem {
  id: string;
  name: string;
  price: number;
  duration: string;
}
interface GroomerService {
  service: any;
  customPrice: number | null;
}
interface Zone {
  id: string;
  name: string;
  city: string;
  slug: string;
}

interface Groomer {
  id: string;
  name: string;
  slug: string;
  initials: string;
  headline: string;
  specialties: string[];
  categories: string[];
  zones: string[];
  avgRating: number;
  reviewCount: number;
  totalJobs: number;
  isOnline: boolean;
  isVerified: boolean;
  bio: string;
  baseRate: number;
  services: ServiceItem[];
  groomerServices: GroomerService[];
  allZones: Zone[];
  reviews: Review[];
}

export default function GroomerProfileView({ groomer }: { groomer: Groomer }) {
  const [tab, setTab] = useState<"services" | "reviews" | "about">("services");
  const [bookingOpen, setBookingOpen] = useState(false);
  const [selectedService, setSelectedService] = useState<any>(null);

  const groomerForPanel = {
    id: groomer.id,
    name: groomer.name,
    availability: groomer.isOnline ? "ONLINE" : "OFFLINE",
    commissionRate: 0.2,
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero */}
      <div
        className="pt-8 pb-24 relative overflow-hidden"
        style={{ background: "#1A3A2A" }}
      >
        <div
          className="absolute inset-0 opacity-[0.05]"
          style={{
            backgroundImage:
              "radial-gradient(circle at 1px 1px, white 1px, transparent 0)",
            backgroundSize: "28px 28px",
          }}
        />
        <div className="container relative z-10">
          <Link
            href="/search"
            className="inline-flex items-center gap-2 text-white/60 hover:text-white text-sm mb-6 transition-colors"
          >
            ← Back to search
          </Link>
          <div className="flex items-start gap-5 md:gap-8">
            {/* Avatar */}
            <div
              className="w-24 h-24 md:w-32 md:h-32 rounded-2xl flex items-center justify-center font-black text-4xl md:text-5xl text-white shadow-xl shrink-0"
              style={{
                background: "#D4A853",
                fontFamily: "var(--font-playfair), Georgia, serif",
              }}
            >
              {groomer.initials}
            </div>
            <div className="flex-1 min-w-0 pt-1">
              <div className="flex items-center gap-3 flex-wrap mb-2">
                <h1
                  className="text-2xl md:text-4xl font-black text-white"
                  style={{ fontFamily: "var(--font-playfair), Georgia, serif" }}
                >
                  {groomer.name}
                </h1>
                {groomer.isVerified && (
                  <span
                    className="text-xs font-bold px-2.5 py-1 rounded-full"
                    style={{ background: "#D4A853", color: "#0D1B12" }}
                  >
                    ✓ Verified
                  </span>
                )}
              </div>
              <p className="text-white/70 text-sm md:text-base mb-3 leading-snug">
                {groomer.headline}
              </p>
              <div className="flex flex-wrap gap-2 mb-4">
                {groomer.specialties.map((s) => (
                  <span
                    key={s}
                    className="bg-white/15 text-white text-xs px-3 py-1 rounded-full font-medium"
                  >
                    {s}
                  </span>
                ))}
              </div>
              <div className="flex items-center gap-5 text-sm">
                <div className="text-white">
                  <span
                    className="font-bold text-lg"
                    style={{ color: "#D4A853" }}
                  >
                    ★ {groomer.avgRating}
                  </span>
                  <span className="text-white/50 ml-1">
                    ({groomer.reviewCount})
                  </span>
                </div>
                <div className="text-white/60">
                  <span className="font-bold text-white">
                    {groomer.totalJobs}
                  </span>{" "}
                  jobs done
                </div>
                <div
                  className="flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full"
                  style={
                    groomer.isOnline
                      ? { background: "rgba(74,222,128,0.2)", color: "#86EFAC" }
                      : {
                          background: "rgba(255,255,255,0.1)",
                          color: "rgba(255,255,255,0.4)",
                        }
                  }
                >
                  <span
                    className="w-1.5 h-1.5 rounded-full"
                    style={{
                      background: groomer.isOnline
                        ? "#4ADE80"
                        : "rgba(255,255,255,0.3)",
                    }}
                  />
                  {groomer.isOnline ? "Available now" : "Offline"}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Content card — overlaps hero */}
      <div className="container -mt-12 pb-32 md:pb-10 relative z-10">
        <div className="grid lg:grid-cols-[1fr_360px] gap-6 items-start">
          {/* Main content */}
          <div className="bg-white rounded-3xl shadow-card overflow-hidden">
            {/* Tabs */}
            <div className="flex border-b border-gray-100">
              {[
                { key: "services", label: "Services" },
                { key: "reviews", label: `Reviews (${groomer.reviewCount})` },
                { key: "about", label: "About" },
              ].map((t) => (
                <button
                  key={t.key}
                  onClick={() => setTab(t.key as typeof tab)}
                  className="flex-1 py-4 text-sm font-semibold transition-colors border-b-2 -mb-px"
                  style={{
                    borderColor: tab === t.key ? "#1A3A2A" : "transparent",
                    color: tab === t.key ? "#1A3A2A" : "#9CA3AF",
                  }}
                >
                  {t.label}
                </button>
              ))}
            </div>

            <div className="p-5 md:p-6">
              {/* Services tab */}
              {tab === "services" && (
                <div className="space-y-3">
                  {groomer.services.map((service) => (
                    <div
                      key={service.id}
                      className="flex items-center justify-between p-4 rounded-2xl border border-gray-100 hover:border-green-200 hover:bg-green-50/30 transition-all group"
                    >
                      <div>
                        <h3
                          className="font-bold text-base mb-1"
                          style={{ color: "#0D1B12" }}
                        >
                          {service.name}
                        </h3>
                        <div className="flex items-center gap-3 text-sm text-gray-400">
                          <span>⏱ {service.duration}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <div
                            className="font-bold text-base"
                            style={{ color: "#0D1B12" }}
                          >
                            {formatNaira(service.price)}
                          </div>
                        </div>
                        <button
                          onClick={() => {
                            setSelectedService(
                              groomer.groomerServices.find(
                                (gs) => gs.service.id === service.id,
                              )?.service ?? null,
                            );
                            setBookingOpen(true);
                          }}
                          className="btn btn-forest btn-sm opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          Book
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Reviews tab */}
              {tab === "reviews" && (
                <div>
                  <div
                    className="flex items-center gap-6 mb-6 p-4 rounded-2xl"
                    style={{ background: "#FDF8EE" }}
                  >
                    <div className="text-center">
                      <div
                        className="text-5xl font-black"
                        style={{
                          fontFamily: "var(--font-playfair), Georgia, serif",
                          color: "#D4A853",
                        }}
                      >
                        {groomer.avgRating}
                      </div>
                      <div
                        className="text-lg mt-1"
                        style={{ color: "#D4A853" }}
                      >
                        {"★".repeat(Math.round(groomer.avgRating))}
                      </div>
                      <div className="text-gray-400 text-xs mt-1">
                        {groomer.reviewCount} reviews
                      </div>
                    </div>
                    <div className="flex-1">
                      {[5, 4, 3, 2, 1].map((n) => (
                        <div key={n} className="flex items-center gap-2 mb-1">
                          <span className="text-xs text-gray-400 w-3">{n}</span>
                          <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full"
                              style={{
                                width: `${n === 5 ? 80 : n === 4 ? 15 : 5}%`,
                                background: "#D4A853",
                              }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  {groomer.reviews.length > 0 ? (
                    <div className="space-y-4">
                      {groomer.reviews.map((r, i) => (
                        <div
                          key={i}
                          className="border-b border-gray-50 pb-4 last:border-0 last:pb-0"
                        >
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <div
                                className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold"
                                style={{
                                  background: "#D8F3DC",
                                  color: "#1A3A2A",
                                }}
                              >
                                {r.author.charAt(0)}
                              </div>
                              <span className="font-semibold text-sm">
                                {r.author}
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span
                                className="text-sm"
                                style={{ color: "#D4A853" }}
                              >
                                {"★".repeat(r.rating)}
                              </span>
                              <span className="text-gray-400 text-xs">
                                {r.date}
                              </span>
                            </div>
                          </div>
                          <p className="text-gray-600 text-sm leading-relaxed">
                            {r.text}
                          </p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-10 text-gray-400">
                      <div className="text-4xl mb-3">⭐</div>
                      <p>No reviews yet</p>
                    </div>
                  )}
                </div>
              )}

              {/* About tab */}
              {tab === "about" && (
                <div>
                  <p className="text-gray-600 leading-relaxed mb-6">
                    {groomer.bio}
                  </p>
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div
                      className="rounded-xl p-4"
                      style={{ background: "#F0FAF2" }}
                    >
                      <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">
                        Coverage zones
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {groomer.zones.map((z) => (
                          <span
                            key={z}
                            className="bg-white text-xs px-2.5 py-1 rounded-full font-medium border"
                            style={{ color: "#2D6A4F", borderColor: "#D8F3DC" }}
                          >
                            {z}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div
                      className="rounded-xl p-4"
                      style={{ background: "#FDF8EE" }}
                    >
                      <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">
                        Stats
                      </p>
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-500">Jobs completed</span>
                          <span className="font-bold">{groomer.totalJobs}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-500">Average rating</span>
                          <span
                            className="font-bold"
                            style={{ color: "#B8893A" }}
                          >
                            ★ {groomer.avgRating}
                          </span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-500">Acceptance rate</span>
                          <span
                            className="font-bold"
                            style={{ color: "#2D6A4F" }}
                          >
                            95%
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Booking sidebar — desktop */}
          <div className="hidden lg:block sticky top-24">
            <BookingPanel
              groomer={groomerForPanel}
              groomerServices={groomer.groomerServices}
              zones={groomer.allZones}
              preSelectedService={selectedService}
            />
          </div>
        </div>
      </div>

      {/* Mobile sticky CTA */}
      <div
        className="fixed bottom-16 left-0 right-0 border-t border-gray-100 p-4 lg:hidden z-40"
        style={{ background: "#ffffff" }}
      >
        <button
          onClick={() => setBookingOpen(true)}
          style={{
            width: "100%",
            background: "#1A3A2A",
            color: "#ffffff",
            borderRadius: "14px",
            padding: "16px",
            fontSize: "16px",
            fontWeight: 700,
            border: "none",
            cursor: "pointer",
          }}
        >
          Book {groomer.name.split(" ")[0]} — from{" "}
          {formatNaira(groomer.baseRate)}
        </button>
      </div>

      {/* Mobile booking sheet */}
      {bookingOpen && (
        <>
          <div
            className="overlay lg:hidden"
            onClick={() => setBookingOpen(false)}
          />
          <div className="sheet lg:hidden">
            <div className="sheet-handle" />
            <div className="p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-lg">
                  Book {groomer.name.split(" ")[0]}
                </h3>
                <button
                  onClick={() => setBookingOpen(false)}
                  className="text-gray-400 text-xl"
                >
                  ✕
                </button>
              </div>
              <BookingPanel
                groomer={groomerForPanel}
                groomerServices={groomer.groomerServices}
                zones={groomer.allZones}
                preSelectedService={selectedService}
              />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
