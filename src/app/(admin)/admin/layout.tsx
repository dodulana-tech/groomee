import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import AdminSidebar from "@/components/admin/AdminSidebar";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") {
    redirect("/auth?redirect=/admin");
  }

  return (
    <div className="flex h-screen bg-gray-900">
      <AdminSidebar
        permissions={session.permissions ?? []}
        roleName={session.adminRoleName ?? "Admin"}
      />
      <main className="flex-1 overflow-auto bg-gray-50">{children}</main>
    </div>
  );
}
