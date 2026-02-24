"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function LogoutButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function logout() {
    setLoading(true);
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/");
    router.refresh();
  }

  return (
    <button
      onClick={logout}
      disabled={loading}
      className="card w-full flex items-center justify-between p-4 hover:bg-red-50 transition-colors text-left"
    >
      <span className="font-medium text-red-500">
        🚪 {loading ? "Logging out…" : "Log out"}
      </span>
    </button>
  );
}
