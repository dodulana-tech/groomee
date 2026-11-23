import { redirect } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { getSession, hasPermission } from "@/lib/auth";
import ImportClient from "./ImportClient";

export const metadata: Metadata = { title: "Import existing pros" };

export default async function ImportProsPage() {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") redirect("/admin/login");
  if (!hasPermission(session, "pros.manage")) redirect("/admin/pros");

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-6xl">
      <div>
        <div className="flex items-center gap-2 text-sm text-gray-400 mb-1">
          <Link href="/admin/pros" className="hover:text-gray-700">Beauty Pros</Link>
          <span>/</span>
          <span className="text-gray-700 font-medium">Import</span>
        </div>
        <h1 className="text-2xl font-bold text-gray-900">Import existing pros</h1>
        <p className="mt-1 text-sm text-gray-500">
          Add the beauty professionals you already work with. Paste rows from a spreadsheet or upload a CSV,
          check the preview, then confirm. Each new pro gets a WhatsApp invite to sign in and finish their profile.
        </p>
      </div>
      <ImportClient />
    </div>
  );
}
