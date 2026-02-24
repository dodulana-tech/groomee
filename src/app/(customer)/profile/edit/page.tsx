"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function EditProfilePage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setLoading(true);
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((d) => {
        setName(d.data?.name ?? "");
        setEmail(d.data?.email ?? "");
      })
      .finally(() => setLoading(false));
  }, []);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      const res = await fetch("/api/auth/update-profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to save");
      setSaved(true);
      setTimeout(() => router.push("/profile"), 1200);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-8 pb-28">
      <div className="flex items-center gap-3 mb-6">
        <Link
          href="/profile"
          className="text-gray-400 hover:text-gray-600 text-sm"
        >
          ← Back
        </Link>
        <h1
          className="text-xl font-black"
          style={{
            fontFamily: "var(--font-playfair), Georgia, serif",
            color: "#0D1B12",
          }}
        >
          Edit Profile
        </h1>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 rounded-full border-2 border-gray-200 border-t-gray-600 animate-spin" />
        </div>
      ) : (
        <form onSubmit={handleSave} className="space-y-4">
          <div className="bg-white rounded-3xl shadow-card p-5 space-y-4">
            <div>
              <label className="label">Full name</label>
              <input
                type="text"
                className="input"
                placeholder="e.g. Temi Adeyemi"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div>
              <label className="label">
                Email address{" "}
                <span className="text-gray-400 font-normal normal-case">
                  (optional)
                </span>
              </label>
              <input
                type="email"
                className="input"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <p className="text-xs text-gray-400 mt-1">
                Used for booking receipts only.
              </p>
            </div>
          </div>

          {error && (
            <p
              className="text-sm font-medium px-1"
              style={{ color: "#FF4D2E" }}
            >
              {error}
            </p>
          )}

          {saved && (
            <p className="text-sm font-medium px-1 text-green-600">
              ✓ Saved! Redirecting…
            </p>
          )}

          <button
            type="submit"
            disabled={saving || saved}
            className="w-full py-4 rounded-2xl text-base font-bold text-white transition-all"
            style={{
              background: saving || saved ? "#9CA3AF" : "#1A3A2A",
              cursor: saving ? "not-allowed" : "pointer",
            }}
          >
            {saving ? "Saving…" : saved ? "Saved ✓" : "Save changes"}
          </button>
        </form>
      )}
    </div>
  );
}
