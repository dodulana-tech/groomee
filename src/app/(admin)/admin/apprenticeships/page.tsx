import { redirect } from "next/navigation";
import { requireAdmin, hasPermission } from "@/lib/auth";
import { db } from "@/lib/db";
import { APPRENTICESHIP_PERMISSIONS } from "@/lib/apprenticeships";

export const revalidate = 0;

const STATUS_STYLE: Record<string, string> = {
  PENDING_ACCEPT: "bg-amber-50 text-amber-700",
  IN_TRAINING: "bg-blue-50 text-blue-700",
  READY_FOR_FREEDOM: "bg-green-50 text-green-700",
  FREED: "bg-purple-50 text-purple-700",
  TERMINATED: "bg-red-50 text-red-400",
};

const STATUS_LABEL: Record<string, string> = {
  PENDING_ACCEPT: "Pending accept",
  IN_TRAINING: "In training",
  READY_FOR_FREEDOM: "Ready for Freedom",
  FREED: "Freed",
  TERMINATED: "Terminated",
};

export default async function AdminApprenticeshipsPage() {
  let session;
  try {
    session = await requireAdmin();
  } catch {
    redirect("/admin/login");
  }
  if (!hasPermission(session, APPRENTICESHIP_PERMISSIONS.view)) {
    redirect("/admin");
  }

  const apprenticeships = await db.apprenticeship.findMany({
    orderBy: { invitedAt: "desc" },
    include: {
      apprentice: { select: { id: true, name: true, phone: true, totalJobs: true, avgRating: true } },
      master: { select: { id: true, name: true, phone: true } },
      _count: { select: { modules: true } },
    },
  });

  const counts = apprenticeships.reduce(
    (acc, a) => ({ ...acc, [a.status]: (acc[a.status] ?? 0) + 1 }),
    {} as Record<string, number>,
  );

  return (
    <div className="p-6 space-y-6">
      <div>
        <h2 className="text-xl font-bold text-gray-900">Apprenticeships</h2>
        <p className="text-gray-400 text-sm mt-0.5">
          Track every master ↔ apprentice relationship across the network.
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {Object.keys(STATUS_LABEL).map((s) => (
          <div key={s} className="rounded-2xl border border-gray-200 bg-white p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">
              {STATUS_LABEL[s]}
            </p>
            <p className="text-2xl font-black text-gray-900 mt-1">{counts[s] ?? 0}</p>
          </div>
        ))}
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
              <th className="px-4 py-3">Apprentice</th>
              <th className="px-4 py-3">Master</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Master cut</th>
              <th className="px-4 py-3">Jobs</th>
              <th className="px-4 py-3">Rating</th>
              <th className="px-4 py-3">Started</th>
            </tr>
          </thead>
          <tbody>
            {apprenticeships.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-12 text-center text-gray-400">
                  No apprenticeships yet. Masters will create them from the partner portal.
                </td>
              </tr>
            )}
            {apprenticeships.map((a) => (
              <tr key={a.id} className="border-t border-gray-100">
                <td className="px-4 py-3">
                  <div className="font-semibold text-gray-900">{a.apprentice.name}</div>
                  <div className="text-xs text-gray-400">{a.apprentice.phone}</div>
                </td>
                <td className="px-4 py-3">
                  <div className="font-medium text-gray-900">{a.master.name}</div>
                  <div className="text-xs text-gray-400">{a.master.phone}</div>
                </td>
                <td className="px-4 py-3">
                  <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-bold ${STATUS_STYLE[a.status]}`}>
                    {STATUS_LABEL[a.status]}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-700">{(a.masterCommission * 100).toFixed(0)}%</td>
                <td className="px-4 py-3 text-gray-700">{a.apprentice.totalJobs}</td>
                <td className="px-4 py-3 text-gray-700">{a.apprentice.avgRating.toFixed(1)} ★</td>
                <td className="px-4 py-3 text-gray-400 text-xs">
                  {a.acceptedAt
                    ? new Date(a.acceptedAt).toLocaleDateString("en-NG")
                    : `Invited ${new Date(a.invitedAt).toLocaleDateString("en-NG")}`}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
