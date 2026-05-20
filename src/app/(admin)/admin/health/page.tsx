import { redirect } from "next/navigation";
import Link from "next/link";
import { requireAdmin, hasPermission } from "@/lib/auth";
import { db } from "@/lib/db";
import { HEALTH_CONDITIONS, HEALTH_PERMISSIONS, findConditionDef } from "@/lib/health";
import HealthAdminActions from "./HealthAdminActions";

export const revalidate = 0;

const LEVEL_PILL: Record<string, string> = {
  INFO: "bg-blue-50 text-blue-700",
  WARN: "bg-amber-50 text-amber-700",
  BLOCK: "bg-red-50 text-red-700",
};

const ROLE_PILL: Record<string, string> = {
  ADMIN: "bg-purple-50 text-purple-700",
  PRO: "bg-emerald-50 text-emerald-700",
  CUSTOMER: "bg-blue-50 text-blue-700",
  SYSTEM: "bg-gray-100 text-gray-700",
};

function timeAgo(date: Date): string {
  const diffMs = Date.now() - new Date(date).getTime();
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(date).toLocaleDateString("en-NG");
}

export default async function AdminHealthPage() {
  let session;
  try {
    session = await requireAdmin();
  } catch {
    redirect("/admin/login");
  }
  if (!hasPermission(session, HEALTH_PERMISSIONS.view)) {
    redirect("/admin");
  }
  const canManage = hasPermission(session, HEALTH_PERMISSIONS.manage);

  const [rules, services, accessLogs] = await Promise.all([
    db.serviceContraindication.findMany({
      orderBy: [{ conditionCode: "asc" }, { createdAt: "asc" }],
      include: {
        service: { select: { id: true, name: true, slug: true, category: true } },
      },
    }),
    db.service.findMany({
      where: { isActive: true },
      orderBy: [{ category: "asc" }, { name: "asc" }],
      select: { id: true, name: true, category: true },
    }),
    db.healthAccessLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 50,
      include: {
        profile: {
          select: {
            userId: true,
            user: { select: { id: true, name: true, phone: true } },
          },
        },
      },
    }),
  ]);

  // Group rules by conditionCode for the table render.
  const grouped = new Map<
    string,
    {
      code: string;
      label: string;
      rules: typeof rules;
    }
  >();
  for (const r of rules) {
    const def = findConditionDef(r.conditionCode);
    const label = def?.label ?? r.conditionCode;
    if (!grouped.has(r.conditionCode)) {
      grouped.set(r.conditionCode, {
        code: r.conditionCode,
        label,
        rules: [] as unknown as typeof rules,
      });
    }
    grouped.get(r.conditionCode)!.rules.push(r);
  }
  const groups = Array.from(grouped.values()).sort((a, b) =>
    a.label.localeCompare(b.label),
  );

  // Counts
  const levelCounts = { INFO: 0, WARN: 0, BLOCK: 0 } as Record<string, number>;
  for (const r of rules) levelCounts[r.level] = (levelCounts[r.level] ?? 0) + 1;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Health & care</h2>
          <p className="text-gray-400 text-sm mt-0.5">
            Controlled vocabulary, contraindication rules, and PHI access audit
            trail.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/admin/health/profiles"
            className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
          >
            Browse customer profiles →
          </Link>
          <HealthAdminActions
            canManage={canManage}
            services={services}
            catalog={HEALTH_CONDITIONS}
          />
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-2xl border border-gray-200 bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">
            Rules
          </p>
          <p className="text-2xl font-black text-gray-900 mt-1">{rules.length}</p>
        </div>
        <div className="rounded-2xl border border-gray-200 bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">
            INFO
          </p>
          <p className="text-2xl font-black text-blue-700 mt-1">
            {levelCounts.INFO ?? 0}
          </p>
        </div>
        <div className="rounded-2xl border border-gray-200 bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">
            WARN
          </p>
          <p className="text-2xl font-black text-amber-700 mt-1">
            {levelCounts.WARN ?? 0}
          </p>
        </div>
        <div className="rounded-2xl border border-gray-200 bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">
            BLOCK
          </p>
          <p className="text-2xl font-black text-red-700 mt-1">
            {levelCounts.BLOCK ?? 0}
          </p>
        </div>
      </div>

      {/* Catalog */}
      <section className="space-y-3">
        <h3 className="text-sm font-bold uppercase tracking-wider text-gray-500">
          Contraindication catalog
        </h3>
        <div className="rounded-2xl border border-gray-200 bg-white overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                <th className="px-4 py-3">Condition</th>
                <th className="px-4 py-3">Service</th>
                <th className="px-4 py-3">Level</th>
                <th className="px-4 py-3">Message</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {groups.length === 0 && (
                <tr>
                  <td
                    colSpan={5}
                    className="px-4 py-12 text-center text-gray-400"
                  >
                    No contraindication rules yet. Click "Add rule" to create one.
                  </td>
                </tr>
              )}
              {groups.flatMap((group) => [
                <tr
                  key={`${group.code}-header`}
                  className="border-t border-gray-200 bg-gray-50/40"
                >
                  <td
                    colSpan={5}
                    className="px-4 py-2 text-xs font-bold uppercase tracking-wider text-gray-600"
                  >
                    {group.label}{" "}
                    <span className="font-normal text-gray-400">
                      ({group.code})
                    </span>
                  </td>
                </tr>,
                ...group.rules.map((r) => (
                  <tr
                    key={r.id}
                    className="border-t border-gray-100 hover:bg-gray-50/30"
                  >
                    <td className="px-4 py-3 text-gray-500">—</td>
                    <td className="px-4 py-3">
                      {r.service ? (
                        <div>
                          <div className="font-medium text-gray-900">
                            {r.service.name}
                          </div>
                          <div className="text-xs text-gray-400">
                            {r.service.category}
                          </div>
                        </div>
                      ) : (
                        <span className="italic text-gray-500">
                          Any service
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-block rounded-full px-2 py-0.5 text-xs font-bold ${
                          LEVEL_PILL[r.level]
                        }`}
                      >
                        {r.level}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-700 max-w-md">
                      <span className="line-clamp-2">{r.message}</span>
                    </td>
                    <td className="px-4 py-3">
                      <HealthAdminActions
                        canManage={canManage}
                        services={services}
                        catalog={HEALTH_CONDITIONS}
                        editRule={{
                          id: r.id,
                          conditionCode: r.conditionCode,
                          conditionLabel: group.label,
                          serviceId: r.serviceId,
                          serviceName: r.service?.name ?? null,
                          level: r.level,
                          message: r.message,
                        }}
                        rowOnly
                      />
                    </td>
                  </tr>
                )),
              ])}
            </tbody>
          </table>
        </div>
      </section>

      {/* Access logs */}
      <section className="space-y-3">
        <div className="flex items-baseline justify-between">
          <h3 className="text-sm font-bold uppercase tracking-wider text-gray-500">
            Recent PHI access
          </h3>
          <span className="text-xs text-gray-400">
            Last {accessLogs.length} reads
          </span>
        </div>
        <div className="rounded-2xl border border-gray-200 bg-white overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                <th className="px-4 py-3">When</th>
                <th className="px-4 py-3">Accessor</th>
                <th className="px-4 py-3">Customer</th>
                <th className="px-4 py-3">Context</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {accessLogs.length === 0 && (
                <tr>
                  <td
                    colSpan={5}
                    className="px-4 py-12 text-center text-gray-400"
                  >
                    No PHI accesses on record yet.
                  </td>
                </tr>
              )}
              {accessLogs.map((log) => (
                <tr
                  key={log.id}
                  className="border-t border-gray-100 hover:bg-gray-50/30"
                >
                  <td
                    className="px-4 py-3 text-gray-500 text-xs"
                    title={new Date(log.createdAt).toLocaleString("en-NG")}
                  >
                    {timeAgo(log.createdAt)}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-block rounded-full px-2 py-0.5 text-xs font-bold ${
                        ROLE_PILL[log.accessorRole] ?? "bg-gray-100 text-gray-600"
                      }`}
                    >
                      {log.accessorRole}
                    </span>
                    {log.accessorId && (
                      <span className="ml-2 text-xs text-gray-400 font-mono">
                        {log.accessorId.slice(0, 8)}…
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {log.profile?.user ? (
                      <div>
                        <div className="font-medium text-gray-900">
                          {log.profile.user.name ?? "—"}
                        </div>
                        <div className="text-xs text-gray-400">
                          {log.profile.user.phone}
                        </div>
                      </div>
                    ) : (
                      <span className="text-gray-400 font-mono text-xs">
                        {log.profileId.slice(0, 8)}…
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-700 text-xs">
                    {log.context}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {log.profile?.userId && (
                      <Link
                        href={`/admin/health/profiles/${log.profile.userId}`}
                        className="text-xs font-bold text-brand-600 hover:underline"
                      >
                        View profile →
                      </Link>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
