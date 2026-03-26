import type { Metadata } from "next";

export const metadata: Metadata = { title: "Pro Advances" };

export default function AdvancesPage() {
  return (
    <div className="p-6 lg:p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Pro Advances</h1>
        <p className="mt-1 text-sm text-gray-500">
          Early payout requests from pros - repaid via deductions on weekly
          payouts.
        </p>
      </div>

      <div className="glass-card rounded-2xl border-dashed p-16 text-center">
        <p className="text-4xl mb-4">💰</p>
        <p className="font-bold text-gray-700 text-lg mb-2">
          Advances not yet set up
        </p>
        <p className="text-sm text-gray-400 max-w-sm mx-auto">
          Add a{" "}
          <code className="bg-gray-100 px-1.5 py-0.5 rounded text-xs">
            ProAdvance
          </code>{" "}
          model to your Prisma schema to enable this feature.
        </p>
      </div>
    </div>
  );
}
