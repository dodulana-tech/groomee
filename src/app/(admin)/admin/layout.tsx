import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import AdminSidebar from "@/components/admin/AdminSidebar";
import NoRoleNotice from "@/components/admin/NoRoleNotice";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") {
    redirect("/admin/login?redirect=/admin");
  }

  // An admin with no role has no permissions: every page and API would
  // refuse them. Say so plainly instead of rendering an empty dashboard.
  if (!session.permissions?.length) {
    return <NoRoleNotice />;
  }

  return (
    <div className="flex h-[100dvh] bg-gray-900">
      <AdminSidebar
        permissions={session.permissions}
        roleName={session.adminRoleName ?? "Admin"}
      />
      <main className="flex-1 overflow-auto bg-gray-50">{children}</main>
    </div>
  );
}
