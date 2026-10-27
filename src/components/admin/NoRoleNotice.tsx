"use client";

import { LOGO_TEAL_BASE64 } from "@/lib/logo";

/** Shown to a signed-in admin whose account has no role (so no permissions). */
export default function NoRoleNotice() {
  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-4"
      style={{ background: "#0D1B12" }}
    >
      <img
        src={LOGO_TEAL_BASE64}
        alt="Groomee"
        width={40}
        height={40}
        className="mb-8 rounded-full"
      />
      <div
        className="w-full max-w-sm rounded-3xl p-8 text-center"
        style={{
          background: "rgba(255,255,255,0.06)",
          border: "1px solid rgba(255,255,255,0.1)",
          backdropFilter: "blur(16px)",
        }}
      >
        <h1
          className="text-2xl font-black text-white mb-2"
          style={{ fontFamily: "var(--font-playfair), Georgia, serif" }}
        >
          No role assigned yet
        </h1>
        <p className="text-sm mb-6" style={{ color: "rgba(255,255,255,0.55)" }}>
          Your account has admin access but no role, so there is nothing you can
          open yet. Ask a Super Admin to assign you a role in Team. It applies
          straight away, no need to sign in again.
        </p>
        <div className="flex flex-col gap-2">
          <button
            onClick={() => window.location.reload()}
            className="w-full rounded-xl py-3 text-sm font-bold"
            style={{ background: "#53eb64", color: "#014342" }}
          >
            Check again
          </button>
          <button
            onClick={async () => {
              await fetch("/api/auth/logout", { method: "POST" });
              window.location.href = "/admin/login";
            }}
            className="w-full rounded-xl py-3 text-sm font-semibold"
            style={{ color: "rgba(255,255,255,0.5)" }}
          >
            Sign out
          </button>
        </div>
      </div>
    </div>
  );
}
