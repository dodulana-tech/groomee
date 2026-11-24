/**
 * Researched premium home-visit prices for Abuja (labour only, hair extra),
 * Nov 2026. Built from Abuja/Lagos salon and home-service menus plus a
 * home-visit premium. Shown to the team in Admin → Prices as a suggestion;
 * the live price is whatever the team saves into the catalogue.
 */
export const PRICE_RESEARCH: Record<string, { min: number; max: number; note?: string; confidence: "high" | "medium" | "low" }> = {
  "knotless-braids": { min: 40000, max: 70000, note: "Small or waist length usually ₦70k–₦120k. Hair extra.", confidence: "medium" },
  "box-braids": { min: 30000, max: 55000, note: "Small size ₦55k–₦90k. Hair extra.", confidence: "medium" },
  "locs-styling": { min: 35000, max: 60000, note: "Microloc / sisterlocs retie ₦80k–₦150k.", confidence: "medium" },
  "weave-installation": { min: 45000, max: 100000, note: "Frontal customisation +₦20k–₦25k. Wig not included.", confidence: "medium" },
  "natural-hair-styling": { min: 30000, max: 60000, note: "Silk press ₦45k–₦75k.", confidence: "medium" },
  "full-glam-makeup": { min: 80000, max: 160000, note: "Gele +₦10k–₦15k.", confidence: "medium" },
  "natural-makeup": { min: 50000, max: 90000, confidence: "low" },
  "bridal-makeup": { min: 250000, max: 450000, note: "Trial ₦50k–₦120k; second look extra.", confidence: "medium" },
  "gel-nails": { min: 10000, max: 18000, note: "Gel-X / BIAB set ₦25k–₦45k.", confidence: "high" },
  "acrylic-nails": { min: 30000, max: 55000, note: "Refill ₦18k–₦28k.", confidence: "high" },
  "nail-art": { min: 5000, max: 20000, note: "Added to a gel or acrylic set.", confidence: "medium" },
  "fade-shape-up": { min: 15000, max: 25000, confidence: "low" },
  "classic-haircut": { min: 12000, max: 20000, confidence: "medium" },
  "beard-grooming": { min: 8000, max: 15000, confidence: "low" },
  "classic-lash-set": { min: 25000, max: 40000, note: "Refill ₦10k–₦20k.", confidence: "high" },
  "volume-lashes": { min: 45000, max: 60000, note: "Refill ₦15k–₦25k.", confidence: "high" },
  "lash-lift-tint": { min: 30000, max: 40000, confidence: "low" },
  "facial-treatment": { min: 40000, max: 80000, confidence: "high" },
  "glow-treatment": { min: 70000, max: 120000, confidence: "medium" },
};

/** Settings keys for fees the team confirms on the Prices page. */
export const FEE_KEYS = {
  homeVisit: "HOME_VISIT_FEE_NGN",
  earlyMorning: "EARLY_MORNING_FEE_NGN",
  depositPercent: "BOOKING_DEPOSIT_PERCENT",
} as const;
