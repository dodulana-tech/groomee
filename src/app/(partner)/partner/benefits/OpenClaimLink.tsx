"use client";

import Link from "next/link";

export default function OpenClaimLink() {
  return (
    <Link
      href="/partner/benefits/claims/new"
      className="rounded-xl bg-brand-600 px-4 py-2 text-xs font-bold text-white hover:bg-brand-700"
    >
      Open new claim
    </Link>
  );
}
