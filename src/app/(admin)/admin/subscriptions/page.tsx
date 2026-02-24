import type { Metadata } from "next";

export const metadata: Metadata = { title: "Subscriptions" };

export default function AdminSubscriptionsPage() {
  return (
    <div className="p-6 lg:p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Subscriptions</h1>
        <p className="mt-1 text-sm text-gray-500">
          Subscription plans and recurring revenue
        </p>
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 border-dashed p-16 text-center">
        <p className="text-4xl mb-4">🌿</p>
        <p className="font-bold text-gray-700 text-lg mb-2">
          Subscriptions not yet set up
        </p>
        <p className="text-sm text-gray-400 max-w-sm mx-auto">
          Add{" "}
          <code className="bg-gray-100 px-1.5 py-0.5 rounded text-xs">
            SubscriptionPlan
          </code>{" "}
          and{" "}
          <code className="bg-gray-100 px-1.5 py-0.5 rounded text-xs">
            Subscription
          </code>{" "}
          models to your Prisma schema to enable this feature.
        </p>
      </div>
    </div>
  );
}
