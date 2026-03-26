"use client";

import { useEffect, useRef, useState } from "react";

export default function PartnerProfilePage() {
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState("");
  const [name, setName] = useState("");
  const [bio, setBio] = useState("");
  const [bankCode, setBankCode] = useState("");
  const [bankAccount, setBankAccount] = useState("");
  const [bankName, setBankName] = useState("");

  // Photo upload state
  const [photo, setPhoto] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadMsg, setUploadMsg] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Bank verification state
  const [verifying, setVerifying] = useState(false);
  const [verifiedName, setVerifiedName] = useState("");
  const [verifyMsg, setVerifyMsg] = useState("");

  useEffect(() => {
    fetch("/api/partner/profile")
      .then((r) => r.json())
      .then((d) => {
        if (d.success) {
          setProfile(d.data);
          setName(d.data.name ?? "");
          setBio(d.data.bio ?? "");
          setBankCode(d.data.bankCode ?? "");
          setBankAccount(d.data.bankAccount ?? "");
          setBankName(d.data.bankName ?? "");
          setPhoto(d.data.photo ?? null);
        }
      })
      .finally(() => setLoading(false));
  }, []);

  async function handleSave() {
    setSaving(true);
    setSaveMsg("");
    try {
      const res = await fetch("/api/partner/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, bio, bankCode, bankAccount, bankName }),
      });
      if (res.ok) {
        setSaveMsg("Profile saved!");
        setTimeout(() => setSaveMsg(""), 3000);
      } else {
        const d = await res.json();
        setSaveMsg(d.error ?? "Failed to save. Please try again.");
      }
    } catch {
      setSaveMsg("Something went wrong. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  async function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setUploadMsg("");
    try {
      const formData = new FormData();
      formData.append("photo", file);
      const res = await fetch("/api/partner/photo", { method: "POST", body: formData });
      const data = await res.json();
      if (res.ok && data.url) {
        setPhoto(data.url);
        setUploadMsg("Photo updated!");
        setTimeout(() => setUploadMsg(""), 3000);
      } else {
        setUploadMsg(data.error ?? "Upload failed. Please try again.");
      }
    } catch {
      setUploadMsg("Something went wrong. Please try again.");
    } finally {
      setUploading(false);
      // Reset input so the same file can be re-selected if needed
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handleVerifyBank() {
    if (!bankCode || !bankAccount) {
      setVerifyMsg("Enter bank code and account number first.");
      return;
    }
    setVerifying(true);
    setVerifyMsg("");
    setVerifiedName("");
    try {
      const res = await fetch("/api/partner/verify-bank", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bankCode, accountNumber: bankAccount }),
      });
      const data = await res.json();
      if (res.ok && data.accountName) {
        setVerifiedName(data.accountName);
        setVerifyMsg("");
      } else {
        setVerifyMsg(data.error ?? "Could not verify account.");
      }
    } catch {
      setVerifyMsg("Something went wrong. Please try again.");
    } finally {
      setVerifying(false);
    }
  }

  const initials = (name || profile?.name || "?")
    .split(" ")
    .map((w: string) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  if (loading) {
    return (
      <div className="p-8 space-y-6">
        <div className="skeleton h-8 w-48" />
        <div className="skeleton h-64 w-full rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Profile</h1>
          <p className="text-sm text-gray-500">
            Manage your public profile and payment details.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={handleSave} disabled={saving} className="btn-primary btn-md">
            {saving ? "Saving…" : "Save changes"}
          </button>
          {saveMsg && (
            <span className={`text-sm font-medium ${saveMsg.includes("saved") ? "text-green-600" : "text-red-500"}`}>
              {saveMsg}
            </span>
          )}
        </div>
      </div>

      {/* Photo upload */}
      <div className="glass rounded-2xl border border-white/20 p-6 shadow-lg">
        <h2 className="font-bold text-gray-900 mb-4">Profile photo</h2>
        <div className="flex items-center gap-5">
          {photo ? (
            <img
              src={photo}
              alt="Profile photo"
              className="h-20 w-20 rounded-full object-cover border-2 border-white shadow-md"
            />
          ) : (
            <div className="h-20 w-20 rounded-full bg-brand-100 border-2 border-white shadow-md flex items-center justify-center text-2xl font-bold text-brand-700 select-none">
              {initials}
            </div>
          )}
          <div className="space-y-2">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={handlePhotoChange}
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="btn-secondary btn-sm"
            >
              {uploading ? "Uploading…" : "Change photo"}
            </button>
            <p className="text-xs text-gray-400">JPG, PNG or WebP — max 5 MB</p>
            {uploadMsg && (
              <p className={`text-xs font-medium ${uploadMsg.includes("updated") ? "text-green-600" : "text-red-500"}`}>
                {uploadMsg}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Verification status */}
      <div className="glass rounded-2xl border border-white/20 p-6 shadow-lg">
        <div className="flex items-center gap-4">
          <div
            className={`h-12 w-12 rounded-full flex items-center justify-center text-xl ${
              profile?.idVerified
                ? "bg-green-100 text-green-600"
                : "bg-amber-100 text-amber-600"
            }`}
          >
            {profile?.idVerified ? "✅" : "⏳"}
          </div>
          <div>
            <p className="font-semibold text-gray-900">
              {profile?.idVerified ? "ID Verified" : "Verification pending"}
            </p>
            <p className="text-sm text-gray-500">
              {profile?.idVerified
                ? "Your identity has been verified. Customers see this badge."
                : "Upload a government-issued ID to get verified and start receiving bookings."}
            </p>
          </div>
          {profile?.tier && (
            <span className="ml-auto rounded-lg bg-brand-100 px-3 py-1 text-xs font-bold text-brand-700">
              {profile.tier === "PRO_TIER" ? "Pro" : profile.tier === "ELITE" ? "Elite" : "Standard"} tier
            </span>
          )}
        </div>
      </div>

      {/* Personal info */}
      <div className="glass rounded-2xl border border-white/20 p-6 shadow-lg">
        <h2 className="font-bold text-gray-900 mb-4">Personal information</h2>
        <div className="space-y-4 max-w-lg">
          <div>
            <label className="input-label mb-1">Display name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="input"
              placeholder="Your professional name"
            />
          </div>
          <div>
            <label className="input-label mb-1">Bio</label>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              className="input min-h-[100px] resize-none"
              placeholder="Tell customers about your experience and style…"
            />
          </div>
          <div>
            <label className="input-label mb-1">Phone</label>
            <input
              type="text"
              value={profile?.phone ?? ""}
              className="input bg-gray-50"
              disabled
            />
            <p className="text-xs text-gray-400 mt-1">
              Phone number cannot be changed. Contact support if needed.
            </p>
          </div>
        </div>
      </div>

      {/* Bank details */}
      <div className="glass rounded-2xl border border-white/20 p-6 shadow-lg">
        <h2 className="font-bold text-gray-900 mb-4">Bank details</h2>
        <p className="text-sm text-gray-500 mb-4">
          We use these details to pay you. Payouts are processed weekly on Fridays.
        </p>
        <div className="space-y-4 max-w-lg">
          <div>
            <label className="input-label mb-1">Bank name</label>
            <input
              type="text"
              value={bankName}
              onChange={(e) => setBankName(e.target.value)}
              className="input"
              placeholder="e.g. GTBank"
            />
          </div>
          <div>
            <label className="input-label mb-1">Account number</label>
            <input
              type="text"
              value={bankAccount}
              onChange={(e) => {
                setBankAccount(e.target.value);
                setVerifiedName("");
                setVerifyMsg("");
              }}
              className="input"
              placeholder="10-digit account number"
              maxLength={10}
            />
          </div>
          <div>
            <label className="input-label mb-1">Bank code</label>
            <input
              type="text"
              value={bankCode}
              onChange={(e) => {
                setBankCode(e.target.value);
                setVerifiedName("");
                setVerifyMsg("");
              }}
              className="input"
              placeholder="e.g. 058"
            />
          </div>

          {/* Verify button + result */}
          <div className="flex items-center gap-3 pt-1">
            <button
              onClick={handleVerifyBank}
              disabled={verifying || !bankCode || !bankAccount}
              className="btn-secondary btn-sm"
            >
              {verifying ? "Verifying…" : "Verify account"}
            </button>
            {verifiedName && (
              <span className="flex items-center gap-1.5 text-sm font-semibold text-green-700">
                <span className="text-green-500">✓</span>
                {verifiedName}
              </span>
            )}
            {verifyMsg && !verifiedName && (
              <span className="text-sm text-red-500">{verifyMsg}</span>
            )}
          </div>
          {verifiedName && (
            <p className="text-xs text-gray-500">
              Account confirmed. Make sure this matches your name before saving.
            </p>
          )}
        </div>
      </div>

      {/* Services & zones — read-only for now, admin manages */}
      <div className="glass rounded-2xl border border-white/20 p-6 shadow-lg">
        <h2 className="font-bold text-gray-900 mb-3">Services &amp; zones</h2>
        <p className="text-sm text-gray-500 mb-3">
          Your services and operating zones are managed by the Groomee team.
          Contact us to update them.
        </p>
        {profile?.services?.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-3">
            {profile.services.map((s: any) => (
              <span
                key={s.serviceId}
                className="rounded-full bg-brand-50 border border-brand-200 px-3 py-1 text-xs font-semibold text-brand-700"
              >
                {s.service?.name ?? s.serviceId}
              </span>
            ))}
          </div>
        )}
        {profile?.zones?.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {profile.zones.map((z: any) => (
              <span
                key={z.zoneId}
                className="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-600"
              >
                📍 {z.zone?.name ?? z.zoneId}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
