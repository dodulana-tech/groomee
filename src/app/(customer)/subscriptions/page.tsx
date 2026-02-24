import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatNaira } from "@/lib/utils";
import SubscribeButton from "./SubscribeButton";
import { redirect } from "next/navigation";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Groomee Subscriptions" };

export default async function SubscriptionsPage() {
  const session = await getSession();

  const plans = await db.subscriptionPlan.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: "asc" },
  });

  let currentSub = null;
  if (session) {
    currentSub = await db.subscription.findFirst({
      where: { userId: session.userId, status: "ACTIVE" },
      include: { plan: true },
    });
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      {/* Hero */}
      <div className="bg-brand-600 py-12 text-center text-white">
        <p className="section-eyebrow mb-2 text-brand-200">Monthly plans</p>
        <h1 className="font-display text-4xl font-black">
          Glow every month.
          <br />
          Save every time.
        </h1>
        <p className="mx-auto mt-4 max-w-md text-brand-200">
          Subscribe and get priority dispatch, discounted sessions, and a
          dedicated support line. Cancel anytime.
        </p>
      </div>

      <div className="mx-auto max-w-5xl px-4 py-10">
        {/* Active subscription */}
        {currentSub && (
          <div className="mb-8 rounded-2xl border-2 border-brand-300 bg-brand-50 p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-brand-600">
                  Your active plan
                </p>
                <p className="mt-1 text-xl font-bold text-brand-900">
                  {currentSub.plan.name}
                </p>
                <p className="mt-1 text-sm text-brand-700">
                  {currentSub.creditsRemaining} of {currentSub.creditsTotal}{" "}
                  sessions remaining this month
                </p>
              </div>
              <div className="text-right">
                <p className="text-2xl font-extrabold text-brand-700">
                  {formatNaira(currentSub.plan.price)}
                  <span className="text-sm font-normal">/mo</span>
                </p>
                <form
                  action={`/api/subscriptions/${currentSub.id}/cancel`}
                  method="POST"
                >
                  <button className="mt-2 text-xs text-red-500 hover:underline">
                    Cancel plan
                  </button>
                </form>
              </div>
            </div>
            {/* Credit bar */}
            <div className="mt-4">
              <div className="h-2 overflow-hidden rounded-full bg-brand-200">
                <div
                  className="h-full rounded-full bg-brand-500 transition-all"
                  style={{
                    width: `${(currentSub.creditsRemaining / currentSub.creditsTotal) * 100}%`,
                  }}
                />
              </div>
              <p className="mt-1.5 text-xs text-brand-600">
                Resets{" "}
                {currentSub.currentPeriodEnd.toLocaleDateString("en-NG", {
                  day: "numeric",
                  month: "long",
                })}
              </p>
            </div>
          </div>
        )}

        {/* Plan cards */}
        <div className="grid gap-5 md:grid-cols-3">
          {plans.map((plan: any, i: number) => {
            const isPopular = i === 1;
            const isCurrent = currentSub?.planId === plan.id;

            return (
              <div
                key={plan.id}
                className={`relative rounded-2xl border-2 p-6 ${
                  isPopular
                    ? "border-brand-500 bg-white shadow-lg shadow-brand-100"
                    : "border-gray-200 bg-white"
                }`}
              >
                {isPopular && (
                  <span className="absolute -top-3.5 left-1/2 -translate-x-1/2 rounded-full bg-brand-600 px-4 py-1 text-xs font-bold text-white shadow">
                    Most popular
                  </span>
                )}

                <h3 className="font-display text-xl font-bold text-gray-900">
                  {plan.name}
                </h3>
                <p className="mt-1 text-sm text-gray-500">{plan.description}</p>

                <p className="mt-4 text-4xl font-extrabold text-gray-900">
                  {formatNaira(plan.price)}
                  <span className="text-base font-normal text-gray-400">
                    /mo
                  </span>
                </p>

                <ul className="mt-5 space-y-2.5">
                  <li className="flex items-center gap-2 text-sm text-gray-700">
                    <span className="text-brand-500">✓</span>
                    <strong>{plan.credits} sessions</strong> per month
                  </li>
                  <li className="flex items-center gap-2 text-sm text-gray-700">
                    <span className="text-brand-500">✓</span>
                    <strong>
                      {Math.round(plan.discountRate * 100)}% off
                    </strong>{" "}
                    base prices
                  </li>
                  {plan.priorityDispatch && (
                    <li className="flex items-center gap-2 text-sm text-gray-700">
                      <span className="text-brand-500">✓</span>
                      Priority dispatch
                    </li>
                  )}
                  <li className="flex items-center gap-2 text-sm text-gray-700">
                    <span className="text-brand-500">✓</span>
                    Cancel anytime
                  </li>
                  {plan.credits >= 8 && (
                    <li className="flex items-center gap-2 text-sm text-gray-700">
                      <span className="text-brand-500">✓</span>
                      Dedicated support line
                    </li>
                  )}
                </ul>

                <div className="mt-6">
                  {isCurrent ? (
                    <div className="rounded-xl bg-brand-100 px-4 py-3 text-center text-sm font-semibold text-brand-700">
                      ✓ Your current plan
                    </div>
                  ) : (
                    <SubscribeButton
                      planId={plan.id}
                      planName={plan.name}
                      price={plan.price}
                      isPopular={isPopular}
                      isLoggedIn={!!session}
                      hasActiveSub={!!currentSub}
                    />
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* FAQ */}
        <div className="mt-12 card p-6">
          <h2 className="mb-5 font-display text-xl font-bold text-gray-900">
            Common questions
          </h2>
          <div className="space-y-4">
            {[
              {
                q: "How do session credits work?",
                a: "Each completed booking deducts one credit. Credits reset at the start of your billing cycle. Unused credits expire — they don't roll over.",
              },
              {
                q: "Can I use credits on any service?",
                a: "Yes. Credits work on any service in your plan's included categories. Discounts apply automatically at checkout.",
              },
              {
                q: "What happens if I run out of credits?",
                a: "You can still book at standard PAYG rates. Your priority dispatch and other benefits stay active until your plan renews.",
              },
              {
                q: "How do I cancel?",
                a: "Cancel anytime from your profile page. Your plan stays active until the end of the billing period — we don't do partial refunds.",
              },
            ].map((faq) => (
              <details key={faq.q} className="group">
                <summary className="cursor-pointer font-semibold text-gray-900 list-none flex items-center justify-between">
                  {faq.q}
                  <span className="text-gray-400 group-open:rotate-180 transition-transform">
                    ▼
                  </span>
                </summary>
                <p className="mt-2 text-sm text-gray-500 leading-relaxed">
                  {faq.a}
                </p>
              </details>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
