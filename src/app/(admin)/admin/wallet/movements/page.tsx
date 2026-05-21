import MovementsClient from "./MovementsClient";
import { redirect } from "next/navigation";
import { getSession, hasPermission } from "@/lib/auth";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Wallet — Movements" };
export const revalidate = 0;

export default async function WalletMovementsPage() {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") {
    redirect("/auth?redirect=/admin/wallet/movements");
  }
  if (!hasPermission(session, "wallet.view")) {
    return (
      <div className="p-6 lg:p-8">
        <h1 className="text-2xl font-bold text-gray-900">Movements</h1>
        <p className="mt-2 text-sm text-gray-500">No permission.</p>
      </div>
    );
  }
  return <MovementsClient />;
}
