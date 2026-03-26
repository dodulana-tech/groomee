import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatNaira(amount: number): string {
  return `₦${amount.toLocaleString("en-NG")}`;
}

export function formatPhone(phone: string): string {
  // Format +2348012345678 → 0801 234 5678
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("234") && digits.length === 13) {
    const local = "0" + digits.slice(3);
    return `${local.slice(0, 4)} ${local.slice(4, 7)} ${local.slice(7)}`;
  }
  return phone;
}

export function maskPhone(phone: string): string {
  const formatted = phone.replace(/\D/g, "");
  if (formatted.length >= 7) {
    return formatted.slice(0, 4) + "***" + formatted.slice(-4);
  }
  return "****";
}

export function generateMapsLink(lat: number, lng: number): string {
  return `https://www.google.com/maps?q=${lat},${lng}`;
}

export function generateMapsLinkFromAddress(address: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function getInitials(name: string): string {
  if (!name || !name.trim()) return "";
  return name
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export function getSurchargeLabel(type: string | null): string | null {
  const labels: Record<string, string> = {
    emergency: "Emergency fee",
    latenight: "Late night",
    earlymorning: "Early morning",
    surge: "Surge pricing",
  };
  return type ? (labels[type] ?? null) : null;
}

export function getBookingStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    PENDING_PAYMENT: "Awaiting payment",
    DISPATCHING: "Finding your pro…",
    NO_GROOMER: "No pro available",
    ACCEPTED: "Pro assigned",
    EN_ROUTE: "En route",
    ARRIVED: "Pro arrived",
    IN_SERVICE: "In service",
    COMPLETED: "Awaiting confirmation",
    CONFIRMED: "Complete",
    CANCELLED: "Cancelled",
    DISPUTED: "Disputed",
  };
  return labels[status] ?? status;
}

export function getBookingStatusColor(status: string): string {
  const colors: Record<string, string> = {
    PENDING_PAYMENT: "bg-gray-100 text-gray-600",
    DISPATCHING: "bg-yellow-100 text-yellow-700",
    NO_GROOMER: "bg-red-100 text-red-600",
    ACCEPTED: "bg-blue-100 text-blue-700",
    EN_ROUTE: "bg-brand-100 text-brand-700",
    ARRIVED: "bg-brand-100 text-brand-700",
    IN_SERVICE: "bg-brand-100 text-brand-700",
    COMPLETED: "bg-purple-100 text-purple-700",
    CONFIRMED: "bg-brand-100 text-brand-700",
    CANCELLED: "bg-gray-100 text-gray-500",
    DISPUTED: "bg-red-100 text-red-600",
  };
  return colors[status] ?? "bg-gray-100 text-gray-600";
}

export function getServiceCategoryIcon(category: string): string {
  const icons: Record<string, string> = {
    HAIR: "💇🏿‍♀️",
    MAKEUP: "💄",
    NAILS: "💅🏿",
    BARBING: "✂️",
    LASHES: "👁️",
    SKINCARE: "✨",
    OTHER: "💆",
  };
  return icons[category] ?? "💆";
}

export function isValidNigerianPhone(phone: string): boolean {
  const cleaned = phone.replace(/\D/g, "");
  // 0XXXXXXXXXX (11 digits) or 234XXXXXXXXXX (13 digits)
  return /^(0[789]\d{9}|234[789]\d{9})$/.test(cleaned);
}
