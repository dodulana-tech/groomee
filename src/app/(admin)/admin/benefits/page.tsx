"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { formatNaira } from "@/lib/utils";

interface Overview {
  counts: { active: number; grace: number; paused: number; cancelled: number; pending: number };
  claims: { open: number };
  plans: { active: number };
  money: { monthlyRevenueGross: number; monthlySubsidyCost: number; expectedMonthlyRevenue: number };
  churnThisMonth: number;
}

export default function BenefitsOverviewPage() {
  const [data, setData] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/benefits/overview")
      .then((r) => r.json())
      .then((d) => setData(d.data ?? null))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="p-6 lg:p-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Benefits & insurance</h1>
          <p className="mt-1 text-sm text-gray-500">
            HMO + accident cover for beauty pros. Underwritten by Reliance HMO
            (NHIA) and Leadway (NAICOM). Groomee is not an insurer.
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/admin/benefits/enrollments/new"
            className="px-4 py-2 rounded-xl text-sm font-bold text-white"
            style={{ background: "#1A3A2A" }}
          >
            + Enrol a pro
          </Link>
        </div>
      </div>

      {loading ? (
        <div className="flex h-32 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200" style={{ borderTopColor: "#1A3A2A" }} />
        </div>
      ) : !data ? (
        <p className="text-sm text-gray-500">Failed to load overview.</p>
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Kpi label="Active enrolments" value={data.counts.active} tint="#DCFCE7" tone="#166534" />
            <Kpi label="In grace" value={data.counts.grace} tint="#FEF3C7" tone="#92400E" />
            <Kpi label="Paused" value={data.counts.paused} tint="#FEE2E2" tone="#991B1B" />
            <Kpi label="Cancelled (all-time)" value={data.counts.cancelled} tint="#F3F4F6" tone="#374151" />
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Kpi label="Monthly revenue (gross)" value={formatNaira(data.money.monthlyRevenueGross)} tint="#E0F2FE" tone="#075985" />
            <Kpi label="Subsidy cost (this month)" value={formatNaira(data.money.monthlySubsidyCost)} tint="#FCE7F3" tone="#9D174D" />
            <Kpi label="Expected monthly run-rate" value={formatNaira(data.money.expectedMonthlyRevenue)} tint="#EDE9FE" tone="#5B21B6" />
            <Kpi label="Open claims" value={data.claims.open} tint="#FEE2E2" tone="#991B1B" />
          </div>

          <div className="glass-card rounded-2xl p-4">
            <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-2">Churn this month</p>
            <p className="text-2xl font-bold text-gray-900">{(data.churnThisMonth * 100).toFixed(1)}%</p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <QuickLink href="/admin/benefits/plans" label="Plans" hint={`${data.plans.active} active`} />
            <QuickLink href="/admin/benefits/enrollments" label="Enrolments" hint={`${data.counts.active + data.counts.grace} live`} />
            <QuickLink href="/admin/benefits/debits" label="Debit log" hint="Run history" />
            <QuickLink href="/admin/benefits/claims" label="Claims" hint={`${data.claims.open} open`} />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <QuickLink href="/admin/benefits/config" label="Configuration" hint="Eligibility + grace/pause windows" />
          </div>
        </div>
      )}
    </div>
  );
}

function Kpi({ label, value, tint, tone }: { label: string; value: number | string; tint: string; tone: string }) {
  return (
    <div className="glass-card rounded-2xl p-4">
      <p className="text-xs font-bold uppercase tracking-widest text-gray-400">{label}</p>
      <p className="mt-2 text-2xl font-bold" style={{ color: tone }}>{value}</p>
      <div className="mt-1 h-1 rounded-full" style={{ background: tint }} />
    </div>
  );
}

function QuickLink({ href, label, hint }: { href: string; label: string; hint: string }) {
  return (
    <Link
      href={href}
      className="glass-card rounded-2xl p-4 block hover:shadow-md transition-shadow"
    >
      <p className="font-bold text-gray-900">{label}</p>
      <p className="text-xs text-gray-500 mt-1">{hint}</p>
    </Link>
  );
}
