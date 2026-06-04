import type { WalletMovementType } from "@prisma/client";

// Pro-facing copy for every movement type. We never expose the raw enum names
// to pros — they read as warm, plain English. Keep in sync with the
// WalletMovementType enum in schema.prisma.
export const MOVEMENT_LABEL: Record<WalletMovementType, string> = {
  MOBILIZATION: "Transport advance",
  COMPLETION_RELEASE: "Service complete release",
  CONFIRM_RELEASE: "Final release",
  APPRENTICE_COMMISSION_RELEASE: "Master commission",
  CLAWBACK: "Reversal",
  ADVANCE_DISBURSED: "Advance taken",
  ADVANCE_REPAYMENT: "Advance repayment",
  PAYOUT_DEBIT: "Paid out",
  PAYOUT_REVERSAL: "Payout reversed",
  MANUAL_ADJUSTMENT: "Adjustment",
  SAVINGS_SKIM: "Reserve set aside",
  BENEFIT_PREMIUM: "Insurance premium",
};

// Coloured pill backgrounds for ledger rows. Plain Tailwind tokens so the
// partner ledger reads consistently with the admin one.
export const MOVEMENT_BADGE: Record<WalletMovementType, string> = {
  MOBILIZATION: "bg-blue-100 text-blue-700",
  COMPLETION_RELEASE: "bg-indigo-100 text-indigo-700",
  CONFIRM_RELEASE: "bg-emerald-100 text-emerald-700",
  APPRENTICE_COMMISSION_RELEASE: "bg-purple-100 text-purple-700",
  CLAWBACK: "bg-red-100 text-red-700",
  ADVANCE_DISBURSED: "bg-amber-100 text-amber-700",
  ADVANCE_REPAYMENT: "bg-amber-100 text-amber-800",
  PAYOUT_DEBIT: "bg-gray-200 text-gray-700",
  PAYOUT_REVERSAL: "bg-gray-100 text-gray-700",
  MANUAL_ADJUSTMENT: "bg-yellow-100 text-yellow-800",
  SAVINGS_SKIM: "bg-teal-100 text-teal-700",
  BENEFIT_PREMIUM: "bg-rose-100 text-rose-700",
};

export type WalletTypeGroup =
  | "all"
  | "earnings"
  | "reserve"
  | "insurance"
  | "advances"
  | "payouts";

// Filter chips on the history page map to subsets of WalletMovementType.
export const TYPE_GROUPS: Record<WalletTypeGroup, WalletMovementType[]> = {
  all: [],
  earnings: [
    "MOBILIZATION",
    "COMPLETION_RELEASE",
    "CONFIRM_RELEASE",
    "APPRENTICE_COMMISSION_RELEASE",
    "CLAWBACK",
    "MANUAL_ADJUSTMENT",
  ],
  reserve: ["SAVINGS_SKIM"],
  insurance: ["BENEFIT_PREMIUM"],
  advances: ["ADVANCE_DISBURSED", "ADVANCE_REPAYMENT"],
  payouts: ["PAYOUT_DEBIT", "PAYOUT_REVERSAL"],
};

export const TYPE_GROUP_LABEL: Record<WalletTypeGroup, string> = {
  all: "All",
  earnings: "Earnings",
  reserve: "Reserve",
  insurance: "Insurance",
  advances: "Advances",
  payouts: "Payouts",
};
