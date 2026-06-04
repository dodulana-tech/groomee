"use client";

import { useRouter, useSearchParams } from "next/navigation";

const TYPE_OPTIONS: { value: string; label: string }[] = [
  { value: "", label: "All movement types" },
  { value: "MOBILIZATION", label: "Mobilization" },
  { value: "COMPLETION_RELEASE", label: "Completion release" },
  { value: "CONFIRM_RELEASE", label: "Confirm release" },
  { value: "APPRENTICE_COMMISSION_RELEASE", label: "Apprentice commission" },
  { value: "CLAWBACK", label: "Clawback" },
  { value: "ADVANCE_DISBURSED", label: "Advance disbursed" },
  { value: "ADVANCE_REPAYMENT", label: "Advance repayment" },
  { value: "PAYOUT_DEBIT", label: "Payout debit" },
  { value: "PAYOUT_REVERSAL", label: "Payout reversal" },
  { value: "MANUAL_ADJUSTMENT", label: "Manual adjustment" },
  { value: "SAVINGS_SKIM", label: "Savings skim" },
  { value: "BENEFIT_PREMIUM", label: "Benefit premium" },
];

export default function LedgerFilter({ proId, current }: { proId: string; current: string }) {
  const router = useRouter();
  const params = useSearchParams();

  function onChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const next = new URLSearchParams(params.toString());
    if (e.target.value) next.set("type", e.target.value);
    else next.delete("type");
    next.delete("page"); // reset paging
    const qs = next.toString();
    router.push(`/admin/wallet/${proId}${qs ? `?${qs}` : ""}`);
  }

  return (
    <select
      value={current}
      onChange={onChange}
      className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
    >
      {TYPE_OPTIONS.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}
