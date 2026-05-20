import Link from "next/link";
import { redirect } from "next/navigation";
import { requireAdmin, hasPermission } from "@/lib/auth";
import { HEALTH_PERMISSIONS } from "@/lib/health";
import ProfileSearch from "./ProfileSearch";

export const revalidate = 0;

export default async function AdminHealthProfilesPage() {
  let session;
  try {
    session = await requireAdmin();
  } catch {
    redirect("/admin/login");
  }
  if (!hasPermission(session, HEALTH_PERMISSIONS.view)) {
    redirect("/admin");
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 pb-24 sm:px-6">
      <div className="mb-6">
        <Link
          href="/admin/health"
          className="mb-3 inline-block text-sm text-gray-400 hover:text-brand-600"
        >
          ← Health & care
        </Link>
        <h1 className="font-display text-2xl font-bold text-gray-900">
          Customer health profiles
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          Customers with at least one active condition. Profiles are PHI — only
          open one when you have a care-related reason. Every open is logged.
        </p>
      </div>

      <ProfileSearch />
    </div>
  );
}
