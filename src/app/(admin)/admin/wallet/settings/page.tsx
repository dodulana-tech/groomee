import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession, hasPermission } from "@/lib/auth";
import {
  loadReleaseFractions,
  loadDefaultCreditLimit,
  loadAdvanceRepayRate,
} from "@/lib/wallet";
import SettingsForm from "./SettingsForm";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Wallet — Settings" };
export const revalidate = 0;

export default async function WalletSettingsPage() {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") {
    redirect("/admin/login?redirect=/admin/wallet/settings");
  }
  if (!hasPermission(session, "wallet.view")) {
    return (
      <div className="p-6 lg:p-8">
        <h1 className="text-2xl font-bold text-gray-900">Wallet settings</h1>
        <p className="mt-2 text-sm text-gray-500">No permission.</p>
      </div>
    );
  }
  const canManage = hasPermission(session, "wallet.manage");

  const [fractions, defaultCreditLimit, advanceRepayRate] = await Promise.all([
    loadReleaseFractions(),
    loadDefaultCreditLimit(),
    loadAdvanceRepayRate(),
  ]);

  return (
    <div className="p-6 lg:p-8 max-w-3xl">
      <Link
        href="/admin/wallet"
        className="text-xs font-semibold text-brand-600 hover:underline"
      >
        ← Wallets overview
      </Link>
      <h1 className="mt-1 text-2xl font-bold text-gray-900">Wallet settings</h1>
      <p className="mt-1 text-sm text-gray-500">
        Tune how pro earnings are released across the booking lifecycle. Changes
        apply to future bookings only - in-flight bookings keep the fractions
        already posted.
      </p>

      <div className="mt-6">
        <SettingsForm
          initial={{
            mobilization: fractions.mobilization,
            completion: fractions.completion,
            confirm: fractions.confirm,
            defaultCreditLimit,
            advanceRepayRate,
          }}
          canManage={canManage}
        />
      </div>
    </div>
  );
}
