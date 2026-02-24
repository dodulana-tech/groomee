"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

const HAIR_TYPES = [
  { value: "1a", label: "1A — Straight fine" },
  { value: "1b", label: "1B — Straight medium" },
  { value: "2a", label: "2A — Wavy fine" },
  { value: "2b", label: "2B — Wavy medium" },
  { value: "3a", label: "3A — Curly loose" },
  { value: "3b", label: "3B — Curly medium" },
  { value: "3c", label: "3C — Curly tight" },
  { value: "4a", label: "4A — Coily soft" },
  { value: "4b", label: "4B — Coily wiry" },
  { value: "4c", label: "4C — Coily tight" },
];
const HAIR_LENGTHS = [
  "Short (above ear)",
  "Medium (to shoulder)",
  "Long (past shoulder)",
  "Extra long (waist+)",
];
const SCALP_CONDITIONS = [
  "Normal",
  "Dry",
  "Oily",
  "Sensitive",
  "Dandruff-prone",
];
const SKIN_TONES = ["Fair", "Light", "Medium", "Tan", "Deep", "Rich"];
const SKIN_TYPES = ["Normal", "Dry", "Oily", "Combination", "Sensitive"];
const COMMON_ALLERGIES = [
  "Sulphates",
  "Parabens",
  "Mineral oil",
  "Fragrances",
  "Latex",
  "Formaldehyde",
];
const STYLE_TAGS = [
  "Knotless braids",
  "Box braids",
  "Ghana braids",
  "Natural twists",
  "Weave",
  "Full glam",
  "Natural makeup",
  "Gel nails",
  "Acrylic nails",
  "Skin fade",
  "Low fade",
];

export default function BeautyProfilePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [form, setForm] = useState({
    hairType: "",
    hairLength: "",
    hairTexture: "medium",
    scalpCondition: "",
    colourTreated: false,
    skinTone: "",
    skinType: "",
    allergies: [] as string[],
    preferredProducts: [] as string[],
    avoidProducts: [] as string[],
    favouriteStyles: [] as string[],
    styleNotes: "",
  });

  useEffect(() => {
    fetch("/api/profile/beauty")
      .then((r) => r.json())
      .then((d) => {
        if (d.data) setForm((f) => ({ ...f, ...d.data }));
      })
      .finally(() => setLoading(false));
  }, []);

  function toggleArr(key: "allergies" | "favouriteStyles", val: string) {
    setForm((f) => ({
      ...f,
      [key]: f[key].includes(val)
        ? f[key].filter((x) => x !== val)
        : [...f[key], val],
    }));
  }

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch("/api/profile/beauty", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (res.ok) {
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
      }
    } finally {
      setSaving(false);
    }
  }

  if (loading)
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-200 border-t-brand-600" />
      </div>
    );

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 pb-24">
      <div className="mb-6">
        <button
          onClick={() => router.back()}
          className="mb-3 text-sm text-gray-400 hover:text-brand-600"
        >
          ← Back to profile
        </button>
        <h1 className="font-display text-2xl font-bold text-gray-900">
          Your Beauty Profile
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          This profile is shared with every groomer you book, so they arrive
          prepared. It lives only on Groomee.
        </p>
      </div>

      <div className="space-y-5">
        {/* Hair section */}
        <Section title="💇‍♀️ Hair">
          <div className="grid gap-4 sm:grid-cols-2">
            <Select
              label="Hair type"
              value={form.hairType}
              onChange={(v) => setForm((f) => ({ ...f, hairType: v }))}
              options={HAIR_TYPES.map((t) => ({
                value: t.value,
                label: t.label,
              }))}
            />
            <Select
              label="Hair length"
              value={form.hairLength}
              onChange={(v) => setForm((f) => ({ ...f, hairLength: v }))}
              options={HAIR_LENGTHS.map((l) => ({
                value: l.toLowerCase(),
                label: l,
              }))}
            />
            <Select
              label="Scalp condition"
              value={form.scalpCondition}
              onChange={(v) => setForm((f) => ({ ...f, scalpCondition: v }))}
              options={SCALP_CONDITIONS.map((s) => ({
                value: s.toLowerCase(),
                label: s,
              }))}
            />
            <div className="flex items-center gap-3 self-end pb-1">
              <input
                type="checkbox"
                id="coloured"
                checked={form.colourTreated}
                onChange={(e) =>
                  setForm((f) => ({ ...f, colourTreated: e.target.checked }))
                }
                className="h-4 w-4 rounded border-gray-300 text-brand-600"
              />
              <label
                htmlFor="coloured"
                className="text-sm font-medium text-gray-700"
              >
                Hair is colour-treated / relaxed
              </label>
            </div>
          </div>
        </Section>

        {/* Skin section */}
        <Section title="✨ Skin & Makeup">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <p className="mb-2 text-xs font-semibold text-gray-500">
                Skin tone
              </p>
              <div className="flex gap-2 flex-wrap">
                {SKIN_TONES.map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() =>
                      setForm((f) => ({ ...f, skinTone: t.toLowerCase() }))
                    }
                    className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${form.skinTone === t.toLowerCase() ? "border-brand-500 bg-brand-50 text-brand-700" : "border-gray-200 text-gray-600"}`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className="mb-2 text-xs font-semibold text-gray-500">
                Skin type
              </p>
              <div className="flex gap-2 flex-wrap">
                {SKIN_TYPES.map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() =>
                      setForm((f) => ({ ...f, skinType: t.toLowerCase() }))
                    }
                    className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${form.skinType === t.toLowerCase() ? "border-brand-500 bg-brand-50 text-brand-700" : "border-gray-200 text-gray-600"}`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </Section>

        {/* Allergies */}
        <Section title="⚠️ Allergies & Sensitivities">
          <p className="mb-3 text-xs text-gray-500">
            Groomers will see these before your appointment.
          </p>
          <div className="flex flex-wrap gap-2 mb-3">
            {COMMON_ALLERGIES.map((a) => (
              <button
                key={a}
                type="button"
                onClick={() => toggleArr("allergies", a)}
                className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${form.allergies.includes(a) ? "border-red-400 bg-red-50 text-red-700" : "border-gray-200 text-gray-600"}`}
              >
                {form.allergies.includes(a) ? "✗ " : "+"} {a}
              </button>
            ))}
          </div>
          <textarea
            value={form.avoidProducts.join(", ")}
            onChange={(e) =>
              setForm((f) => ({
                ...f,
                avoidProducts: e.target.value
                  .split(",")
                  .map((x) => x.trim())
                  .filter(Boolean),
              }))
            }
            placeholder="Other products to avoid (comma-separated)"
            className="input resize-none text-sm"
            rows={2}
          />
        </Section>

        {/* Favourite styles */}
        <Section title="💅 Favourite Styles">
          <p className="mb-3 text-xs text-gray-500">
            Helps groomers understand your preferences.
          </p>
          <div className="flex flex-wrap gap-2 mb-3">
            {STYLE_TAGS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => toggleArr("favouriteStyles", s)}
                className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${form.favouriteStyles.includes(s) ? "border-brand-500 bg-brand-50 text-brand-700" : "border-gray-200 text-gray-600"}`}
              >
                {s}
              </button>
            ))}
          </div>
          <textarea
            value={form.styleNotes}
            onChange={(e) =>
              setForm((f) => ({ ...f, styleNotes: e.target.value }))
            }
            placeholder="Any other style notes or preferences your groomers should know…"
            className="input resize-none text-sm"
            rows={3}
          />
        </Section>

        {saved && (
          <div className="rounded-xl bg-brand-50 px-4 py-3 text-center text-sm font-semibold text-brand-700">
            ✅ Profile saved!
          </div>
        )}

        <button
          onClick={handleSave}
          disabled={saving}
          className="btn-primary btn-lg w-full"
        >
          {saving ? "Saving…" : "Save beauty profile"}
        </button>
      </div>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="card p-5">
      <h2 className="mb-4 font-semibold text-gray-900">{title}</h2>
      {children}
    </div>
  );
}

function Select({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-semibold text-gray-500">
        {label}
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="input"
      >
        <option value="">Select…</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}
