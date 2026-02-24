"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatNaira } from "@/lib/utils";
import { cn } from "@/lib/utils";

interface Props {
  planId: string;
  planName: string;
  price: number;
  isPopular: boolean;
  isLoggedIn: boolean;
  hasActiveSub: boolean;
}

export default function SubscribeButton({
  planId,
  planName,
  price,
  isPopular,
  isLoggedIn,
  hasActiveSub,
}: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleSubscribe() {
    if (!isLoggedIn) {
      router.push("/auth?redirect=/subscriptions");
      return;
    }
    if (hasActiveSub) {
      alert("Cancel your current plan first before switching.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/subscriptions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error);
        return;
      }
      window.location.href = data.data.authorizationUrl;
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={handleSubscribe}
      disabled={loading}
      className={cn(
        "btn btn-lg w-full",
        isPopular ? "btn-primary" : "btn-outline",
      )}
    >
      {loading ? "Processing…" : `Subscribe — ${formatNaira(price)}/mo`}
    </button>
  );
}
