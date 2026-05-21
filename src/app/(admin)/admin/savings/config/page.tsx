import { loadSavingsSettings } from "@/lib/savings";
import ConfigForm from "./ConfigForm";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Reserve config · Admin" };
export const revalidate = 0;

export default async function SavingsConfigPage() {
  const settings = await loadSavingsSettings();
  return (
    <div className="p-6 lg:p-8 max-w-3xl">
      <div className="mb-6">
        <Link href="/admin/savings" className="text-xs text-gray-400 hover:underline">← Overview</Link>
        <h1 className="mt-1 text-2xl font-bold text-gray-900">Earnings Reserve configuration</h1>
        <p className="mt-1 text-sm text-gray-500">
          Platform-wide defaults. Per-pro overrides (notice days, penalty %) live on the account itself.
        </p>
      </div>
      <ConfigForm initial={settings} />
    </div>
  );
}
