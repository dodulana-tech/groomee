"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function EditProfilePage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [needsPhone, setNeedsPhone] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  // Phone linking state
  const [linkingPhone, setLinkingPhone] = useState(false);
  const [phoneSaved, setPhoneSaved] = useState(false);
  const [phoneError, setPhoneError] = useState("");

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((d) => {
        setName(d.data?.name ?? "");
        setEmail(d.data?.email ?? "");
        const ph: string | null = d.data?.phone ?? null;
        setPhone(ph ?? "");
        setNeedsPhone(!ph);
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
      if (!needsPhone) {
        setTimeout(() => router.push("/profile"), 1200);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleLinkPhone(e: React.FormEvent) {
    e.preventDefault();
    setPhoneError("");
    if (!phone || phone.length < 10) {
      setPhoneError("Enter a valid Nigerian phone number");
      return;
    }
    setLinkingPhone(true);
    try {
      const res = await fetch("/api/auth/link-phone", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to link phone");
      setPhoneSaved(true);
      setNeedsPhone(false);
      setTimeout(() => router.push("/profile"), 1200);
    } catch (err: any) {
      setPhoneError(err.message);
    } finally {
      setLinkingPhone(false);
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
        <h1 className="font-display text-xl font-bold text-gray-900">
          Edit Profile
        </h1>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 rounded-full border-2 border-gray-200 border-t-gray-600 animate-spin" />
        </div>
      ) : (
        <div className="space-y-4">
          {/* Name + Email */}
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
              <p className="text-sm font-medium px-1 text-red-500">{error}</p>
            )}
            {saved && !needsPhone && (
              <p className="text-sm font-medium px-1 text-green-600">
                ✓ Saved! Redirecting…
              </p>
            )}

            <button
              type="submit"
              disabled={saving || (saved && !needsPhone)}
              className="w-full py-4 rounded-2xl text-base font-bold text-white transition-all"
              style={{
                background: saving || (saved && !needsPhone) ? "#9CA3AF" : "#1A3A2A",
              }}
            >
              {saving ? "Saving…" : saved ? "Saved ✓" : "Save changes"}
            </button>
          </form>

          {/* Phone linking — only shown if user registered via email */}
          {needsPhone && (
            <form onSubmit={handleLinkPhone} className="space-y-4">
              <div className="bg-white rounded-3xl shadow-card p-5 space-y-4 border-2 border-amber-200">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-lg">📱</span>
                  <h3 className="font-bold text-gray-900">Link your phone number</h3>
                </div>
                <p className="text-xs text-gray-500">
                  A phone number is required to receive booking updates via WhatsApp and SMS.
                </p>
                <div>
                  <label className="label">Phone number</label>
                  <input
                    type="tel"
                    className="input"
                    placeholder="+234 801 234 5678"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                  />
                </div>
              </div>

              {phoneError && (
                <p className="text-sm font-medium px-1 text-red-500">{phoneError}</p>
              )}
              {phoneSaved && (
                <p className="text-sm font-medium px-1 text-green-600">
                  ✓ Phone linked! Redirecting…
                </p>
              )}

              <button
                type="submit"
                disabled={linkingPhone || phoneSaved}
                className="w-full py-4 rounded-2xl text-base font-bold text-white transition-all"
                style={{
                  background: linkingPhone || phoneSaved ? "#9CA3AF" : "#014342",
                }}
              >
                {linkingPhone ? "Linking…" : phoneSaved ? "Linked ✓" : "Link phone number"}
              </button>
            </form>
          )}
        </div>
      )}
    </div>
  );
}
