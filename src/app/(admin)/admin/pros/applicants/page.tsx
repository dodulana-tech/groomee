import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { formatDistanceToNowStrict } from "date-fns";
import { db } from "@/lib/db";
import { getSession, hasPermission } from "@/lib/auth";
import { CATEGORY_LABEL, loadZoneCoverage } from "@/lib/pro-onboarding";
import ApplicantActions from "./ApplicantActions";

export const metadata: Metadata = { title: "Pro applicants" };
export const revalidate = 0;

const SLA_HOURS = 24;

export default async function ApplicantsPage() {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") redirect("/admin/login");
  if (!hasPermission(session, "pros.view")) redirect("/admin");
  const canManage = hasPermission(session, "pros.manage");

  const [pending, recent, coverageGroups] = await Promise.all([
    db.pro.findMany({
      where: { status: "PENDING" },
      include: {
        services: { include: { service: { select: { category: true } } } },
        zones: { include: { zone: { select: { name: true } } } },
        user: { select: { email: true } },
      },
      orderBy: [{ appliedAt: "asc" }, { createdAt: "asc" }],
      take: 200,
    }),
    db.pro.findMany({
      where: { OR: [{ approvedAt: { not: null } }, { rejectedAt: { not: null } }] },
      select: {
        id: true,
        name: true,
        status: true,
        approvedAt: true,
        rejectedAt: true,
        rejectionReason: true,
      },
      orderBy: { updatedAt: "desc" },
      take: 10,
    }),
    loadZoneCoverage(),
  ]);

  const allCoverage = coverageGroups.flatMap((g) => g.zones);
  const overdue = pending.filter(
    (p) => Date.now() - (p.appliedAt ?? p.createdAt).getTime() > SLA_HOURS * 3600_000,
  ).length;
  const prioritySet = new Set<string>(allCoverage.map((z) => z.name));

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex-1">
          <div className="flex items-center gap-2 text-sm text-gray-400 mb-1">
            <Link href="/admin/pros" className="hover:text-gray-700">Beauty Pros</Link>
            <span>/</span>
            <span className="text-gray-700 font-medium">Applicants</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Pro applicants</h1>
          <p className="mt-1 text-sm text-gray-500">
            {pending.length} waiting
            {overdue > 0 && (
              <span className="ml-1 font-semibold text-red-600">· {overdue} over {SLA_HOURS}h</span>
            )}
            {" "}· oldest first. Approving sends the welcome WhatsApp and portal link.
          </p>
        </div>
        {canManage && (
          <Link
            href="/admin/pros/import"
            className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-bold text-gray-800"
          >
            Import existing pros
          </Link>
        )}
      </div>

      {/* Zone coverage vs target (Abuja counts even though its City is WAITLIST) */}
      {coverageGroups.map((g) => {
        const active = g.zones.reduce((n, z) => n + z.active, 0);
        return (
          <section key={g.city} className="rounded-2xl border border-gray-100 bg-white p-4 sm:p-5">
            <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="font-bold text-gray-900">{g.city} priority zone coverage</h2>
              <p className="text-xs text-gray-500">
                {active} / {g.target * g.zones.length} active · target {g.target} per zone
              </p>
            </div>
            <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">
              {g.zones.map((c) => (
                <div key={c.name} className="rounded-xl border border-gray-100 bg-gray-50/60 p-3">
                  <p className="text-sm font-semibold text-gray-900">{c.name}</p>
                  {c.missing ? (
                    <p className="mt-1 text-xs text-red-600">Zone not set up in Cities</p>
                  ) : (
                    <>
                      <p className="mt-1 text-2xl font-black text-gray-900">
                        {c.active}
                        <span className="text-sm font-semibold text-gray-400"> / {c.target}</span>
                      </p>
                      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-gray-200">
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${c.pct}%`,
                            background: c.pct >= 100 ? "#16a34a" : c.pct >= 50 ? "#53eb64" : "#f59e0b",
                          }}
                        />
                      </div>
                      <p className="mt-2 text-[11px] text-gray-500">
                        {c.online} online now · {c.pending} applying
                      </p>
                    </>
                  )}
                </div>
              ))}
            </div>
          </section>
        );
      })}

      {/* Queue */}
      <section className="space-y-3">
        {pending.length === 0 && (
          <div className="rounded-2xl border border-dashed border-gray-200 bg-white p-10 text-center text-sm text-gray-500">
            No applications waiting. Share <span className="font-mono">/become-a-pro</span> to bring more in.
          </div>
        )}
        {pending.map((p) => {
          const applied = p.appliedAt ?? p.createdAt;
          const ageHours = (Date.now() - applied.getTime()) / 3600_000;
          const categories = [...new Set(p.services.map((s) => s.service.category))];
          const zoneNames = p.zones.map((z) => z.zone.name);
          const inPriority = zoneNames.some((z) => prioritySet.has(z));
          const waNumber = p.phone.replace(/\D/g, "");
          const portfolioHref = p.portfolioUrl
            ? /^https?:\/\//i.test(p.portfolioUrl)
              ? p.portfolioUrl
              : p.portfolioUrl.startsWith("@")
                ? `https://instagram.com/${p.portfolioUrl.slice(1)}`
                : null
            : null;
          return (
            <article
              key={p.id}
              className="rounded-2xl border border-gray-100 bg-white p-4 sm:p-5 shadow-sm"
            >
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0 flex-1 space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link
                      href={`/admin/pros/${p.id}`}
                      className="text-base font-bold text-gray-900 hover:underline"
                    >
                      {p.name}
                    </Link>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${
                        ageHours > SLA_HOURS
                          ? "bg-red-50 text-red-700"
                          : "bg-amber-50 text-amber-700"
                      }`}
                      title={applied.toISOString()}
                    >
                      {formatDistanceToNowStrict(applied, { addSuffix: true })}
                    </span>
                    {inPriority && (
                      <span className="rounded-full bg-brand-50 px-2 py-0.5 text-[11px] font-bold text-brand-700">
                        Priority zone
                      </span>
                    )}
                    {p.bankVerifiedAt && (
                      <span className="rounded-full bg-green-50 px-2 py-0.5 text-[11px] font-bold text-green-700">
                        Bank verified
                      </span>
                    )}
                    {p.applicationSource && (
                      <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-500">
                        via {p.applicationSource}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500">
                    <a
                      href={`https://wa.me/${waNumber}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-semibold text-brand-700 hover:underline"
                    >
                      {p.phone}
                    </a>
                    {p.user?.email && <> · {p.user.email}</>}
                    {p.yearsExperience != null && <> · {p.yearsExperience} yrs experience</>}
                    {p.portfolioUrl && (
                      <>
                        {" · "}
                        {portfolioHref ? (
                          <a
                            href={portfolioHref}
                            target="_blank"
                            rel="noopener noreferrer nofollow"
                            className="font-semibold text-brand-700 hover:underline"
                          >
                            Portfolio
                          </a>
                        ) : (
                          <span>Portfolio: {p.portfolioUrl}</span>
                        )}
                      </>
                    )}
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {categories.map((c) => (
                      <span key={c} className="rounded-md bg-gray-100 px-2 py-0.5 text-xs text-gray-700">
                        {CATEGORY_LABEL[c] ?? c}
                      </span>
                    ))}
                    {zoneNames.map((z) => (
                      <span
                        key={z}
                        className={`rounded-md px-2 py-0.5 text-xs ${
                          prioritySet.has(z) ? "bg-brand-50 text-brand-800 font-semibold" : "bg-gray-50 text-gray-500"
                        }`}
                      >
                        📍 {z}
                      </span>
                    ))}
                    {categories.length === 0 && (
                      <span className="text-xs text-red-600">No services selected</span>
                    )}
                    {zoneNames.length === 0 && (
                      <span className="text-xs text-red-600">No zones selected</span>
                    )}
                  </div>
                  {p.bio && <p className="text-sm text-gray-600 line-clamp-3">{p.bio}</p>}
                </div>
                {canManage && <ApplicantActions proId={p.id} name={p.name} />}
              </div>
            </article>
          );
        })}
      </section>

      {recent.length > 0 && (
        <section className="rounded-2xl border border-gray-100 bg-white p-4 sm:p-5">
          <h2 className="mb-3 font-bold text-gray-900">Recently reviewed</h2>
          <ul className="divide-y divide-gray-50 text-sm">
            {recent.map((r) => {
              const at = r.rejectedAt && (!r.approvedAt || r.rejectedAt > r.approvedAt) ? r.rejectedAt : r.approvedAt;
              const rejected = r.status === "REMOVED" && r.rejectedAt;
              return (
                <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                  <Link href={`/admin/pros/${r.id}`} className="font-medium text-gray-800 hover:underline">
                    {r.name}
                  </Link>
                  <span className="text-xs text-gray-500">
                    <span className={rejected ? "font-semibold text-red-600" : "font-semibold text-green-700"}>
                      {rejected ? "Declined" : r.status === "ACTIVE" ? "Approved" : r.status}
                    </span>
                    {at && <> · {formatDistanceToNowStrict(at, { addSuffix: true })}</>}
                    {rejected && r.rejectionReason && <> · “{r.rejectionReason}”</>}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}
