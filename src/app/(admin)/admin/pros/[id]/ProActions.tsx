"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import ApplicantActions from "../applicants/ApplicantActions";

interface Props {
  proId: string;
  currentStatus: string;
  name?: string;
}

export default function ProActions({ proId, currentStatus, name }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function updateStatus(status: string) {
    if (!confirm(`Set pro status to ${status}?`)) return;
    setLoading(true);
    try {
      await fetch(`/api/admin/pros/${proId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  // Applicants go through the review flow so they get the welcome / decline
  // message instead of a silent status flip.
  if (currentStatus === "PENDING") {
    return <ApplicantActions proId={proId} name={name ?? "this applicant"} compact />;
  }

  return (
    <div className="flex gap-2">
      {currentStatus === "ACTIVE" && (
        <button
          onClick={() => updateStatus("SUSPENDED")}
          disabled={loading}
          className="rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-100 disabled:opacity-50"
        >
          Suspend
        </button>
      )}
      {currentStatus === "SUSPENDED" && (
        <button
          onClick={() => updateStatus("ACTIVE")}
          disabled={loading}
          className="rounded-lg border border-brand-200 bg-brand-50 px-3 py-1.5 text-xs font-semibold text-brand-600 hover:bg-brand-100 disabled:opacity-50"
        >
          Activate
        </button>
      )}
    </div>
  );
}
