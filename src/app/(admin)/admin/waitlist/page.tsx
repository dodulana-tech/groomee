import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { format } from "date-fns";
import type { Metadata } from "next";
import ExportCsvButton from "./ExportCsvButton";

export const metadata: Metadata = { title: "Waitlist | Admin" };
export const revalidate = 0;

export default async function AdminWaitlistPage() {
  await requireAdmin();

  const entries = await db.waitlist.findMany({
    orderBy: { createdAt: "desc" },
  });

  const total = entries.length;

  // By city
  const cityMap: Record<string, number> = {};
  for (const e of entries) {
    const city = e.city || "Unknown";
    cityMap[city] = (cityMap[city] ?? 0) + 1;
  }

  // By role
  const roleMap: Record<string, number> = {};
  for (const e of entries) {
    const role = e.role || "unknown";
    roleMap[role] = (roleMap[role] ?? 0) + 1;
  }

  const lagosCount = cityMap["Lagos"] ?? 0;
  const abujaCount = cityMap["Abuja"] ?? 0;
  const customerCount = roleMap["customer"] ?? 0;
  const proCount = roleMap["pro"] ?? 0;
  const bothCount = roleMap["both"] ?? 0;

  // Serialise for the client CSV button
  const serialised = entries.map((e) => ({
    id: e.id,
    createdAt: e.createdAt.toISOString(),
    name: e.name,
    phone: e.phone,
    email: e.email,
    city: e.city,
    area: e.area,
    role: e.role,
  }));

  return (
    <div className="p-6 lg:p-8">
      <div className="mb-6 flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Waitlist</h1>
          <p className="mt-1 text-sm text-gray-500">
            {total} total sign-up{total !== 1 ? "s" : ""}
          </p>
        </div>
        <ExportCsvButton entries={serialised} />
      </div>

      {/* Summary stats — two rows */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 mb-6">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 col-span-2 sm:col-span-1 lg:col-span-1">
          <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Total</p>
          <p className="text-3xl font-bold text-gray-900 mt-1">{total}</p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
          <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Lagos</p>
          <p className="text-3xl font-bold text-gray-800 mt-1">{lagosCount}</p>
        </div>
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
          <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Abuja</p>
          <p className="text-3xl font-bold text-gray-800 mt-1">{abujaCount}</p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
          <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Customers</p>
          <p className="text-3xl font-bold text-blue-700 mt-1">{customerCount}</p>
        </div>
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Pros</p>
              <p className="text-3xl font-bold text-green-700 mt-1">{proCount}</p>
            </div>
            {bothCount > 0 && (
              <div className="text-right">
                <p className="text-xs text-gray-400">Both</p>
                <p className="text-xl font-bold text-purple-600">{bothCount}</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        <h2 className="text-base font-semibold text-gray-800 mb-4">
          All Sign-ups
        </h2>

        {entries.length === 0 ? (
          <div className="py-16 text-center">
            <p className="text-3xl mb-3">📋</p>
            <p className="font-semibold text-gray-600">No waitlist entries yet</p>
            <p className="text-sm text-gray-400 mt-1">
              People who sign up for the waitlist will appear here.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left py-3 px-3 font-semibold text-gray-500 text-xs uppercase tracking-wide whitespace-nowrap">
                    Date
                  </th>
                  <th className="text-left py-3 px-3 font-semibold text-gray-500 text-xs uppercase tracking-wide">
                    Name
                  </th>
                  <th className="text-left py-3 px-3 font-semibold text-gray-500 text-xs uppercase tracking-wide">
                    Phone
                  </th>
                  <th className="text-left py-3 px-3 font-semibold text-gray-500 text-xs uppercase tracking-wide">
                    Email
                  </th>
                  <th className="text-left py-3 px-3 font-semibold text-gray-500 text-xs uppercase tracking-wide">
                    City
                  </th>
                  <th className="text-left py-3 px-3 font-semibold text-gray-500 text-xs uppercase tracking-wide">
                    Area
                  </th>
                  <th className="text-left py-3 px-3 font-semibold text-gray-500 text-xs uppercase tracking-wide">
                    Role
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {entries.map((e) => (
                  <tr key={e.id} className="hover:bg-gray-50/60 transition-colors">
                    <td className="py-3 px-3 text-gray-500 whitespace-nowrap text-xs">
                      {format(new Date(e.createdAt), "dd MMM yyyy, HH:mm")}
                    </td>
                    <td className="py-3 px-3 text-gray-800 font-medium">
                      {e.name ?? <span className="text-gray-300">—</span>}
                    </td>
                    <td className="py-3 px-3 text-gray-700 whitespace-nowrap">
                      {e.phone ?? <span className="text-gray-300">—</span>}
                    </td>
                    <td className="py-3 px-3 text-gray-700">
                      {e.email ?? <span className="text-gray-300">—</span>}
                    </td>
                    <td className="py-3 px-3 whitespace-nowrap">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-gray-100 text-gray-600">
                        {e.city}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-gray-600 text-xs">
                      {e.area ?? <span className="text-gray-300">—</span>}
                    </td>
                    <td className="py-3 px-3 whitespace-nowrap">
                      <span
                        className={[
                          "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium",
                          e.role === "customer"
                            ? "bg-blue-100 text-blue-700"
                            : e.role === "pro"
                              ? "bg-green-100 text-green-700"
                              : e.role === "both"
                                ? "bg-purple-100 text-purple-700"
                                : "bg-gray-100 text-gray-600",
                        ].join(" ")}
                      >
                        {e.role}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
