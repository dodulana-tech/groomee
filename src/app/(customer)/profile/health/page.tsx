import { redirect } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { getSession } from "@/lib/auth";
import { getProfileForUser } from "@/lib/health";
import HealthActions from "./HealthActions";

export const metadata: Metadata = { title: "Health & sensitivities" };
export const revalidate = 0;

const VISIBILITY_COPY: Record<
  "ALWAYS_SHARE" | "ASK_PER_BOOKING" | "PRIVATE",
  { pill: string; description: string; tone: string }
> = {
  ALWAYS_SHARE: {
    pill: "Always share",
    description:
      "Pros assigned to your bookings always see this profile (recommended).",
    tone: "bg-brand-100 text-brand-700",
  },
  ASK_PER_BOOKING: {
    pill: "Ask per booking",
    description:
      "We'll ask each time you book whether to share. Until you confirm, pros only see service details.",
    tone: "bg-amber-100 text-amber-700",
  },
  PRIVATE: {
    pill: "Private",
    description:
      "Nobody sees this profile. Use only if you're tracking your own info and don't want pros notified.",
    tone: "bg-gray-200 text-gray-700",
  },
};

export default async function HealthPage() {
  const session = await getSession();
  if (!session) redirect("/auth?redirect=/profile/health");

  const profile = await getProfileForUser(session.userId);
  const active = profile?.conditions.filter((c) => !c.resolved) ?? [];
  const resolved = profile?.conditions.filter((c) => c.resolved) ?? [];
  const visibility = profile?.visibility ?? "ALWAYS_SHARE";
  const vis = VISIBILITY_COPY[visibility];

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 pb-24">
      <div className="mb-6">
        <Link
          href="/profile"
          className="mb-3 inline-block text-sm text-gray-400 hover:text-brand-600"
        >
          ← Back to profile
        </Link>
        <h1 className="font-display text-2xl font-bold text-gray-900">
          Health & sensitivities
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          Conditions that affect how a pro should treat you — allergies,
          mobility, skin sensitivities, pregnancy, etc. Sharing this helps your
          pro arrive prepared and keeps you safe. It lives only on Groomee.
        </p>
      </div>

      {/* Visibility card */}
      <div className="card p-5 mb-4">
        <div className="flex items-center justify-between gap-3 mb-3">
          <div>
            <h2 className="font-semibold text-gray-900">Who can see this?</h2>
            <p className="text-xs text-gray-500 mt-0.5">{vis.description}</p>
          </div>
          <span
            className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-bold ${vis.tone}`}
          >
            {vis.pill}
          </span>
        </div>
        <HealthActions
          mode="visibility"
          initialVisibility={visibility}
        />
      </div>

      {/* Active conditions */}
      <div className="card p-5 mb-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-gray-900">
            Active conditions{" "}
            <span className="ml-1 text-sm font-normal text-gray-400">
              ({active.length})
            </span>
          </h2>
          <HealthActions mode="add-trigger" />
        </div>

        {active.length === 0 ? (
          <p className="rounded-xl bg-gray-50 px-4 py-6 text-center text-sm text-gray-500">
            You haven't added any conditions yet. Pros assume no known
            sensitivities until you tell them otherwise.
          </p>
        ) : (
          <ul className="space-y-2">
            {active.map((c) => (
              <li
                key={c.id}
                className="rounded-2xl border border-gray-100 bg-white p-3"
              >
                <HealthActions
                  mode="condition-row"
                  condition={{
                    id: c.id,
                    code: c.code,
                    label: c.label,
                    category: c.category,
                    severity: c.severity,
                    notes: c.notes,
                    startedAt: c.startedAt
                      ? c.startedAt.toISOString().slice(0, 10)
                      : null,
                    resolved: c.resolved,
                  }}
                />
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Free-text notes */}
      <div className="card p-5 mb-4">
        <h2 className="font-semibold text-gray-900 mb-1">
          Anything else we should know?
        </h2>
        <p className="text-xs text-gray-500 mb-3">
          Free-form notes — habits, recent procedures, anything that doesn't
          fit a tag above.
        </p>
        <HealthActions mode="notes" initialNotes={profile?.notes ?? ""} />
      </div>

      {/* Resolved (historical) */}
      {resolved.length > 0 && (
        <div className="card p-5 mb-4">
          <h2 className="font-semibold text-gray-900 mb-3">
            Resolved / no longer relevant{" "}
            <span className="ml-1 text-sm font-normal text-gray-400">
              ({resolved.length})
            </span>
          </h2>
          <ul className="space-y-2">
            {resolved.map((c) => (
              <li
                key={c.id}
                className="rounded-2xl border border-gray-100 bg-gray-50 p-3"
              >
                <HealthActions
                  mode="condition-row"
                  condition={{
                    id: c.id,
                    code: c.code,
                    label: c.label,
                    category: c.category,
                    severity: c.severity,
                    notes: c.notes,
                    startedAt: c.startedAt
                      ? c.startedAt.toISOString().slice(0, 10)
                      : null,
                    resolved: c.resolved,
                  }}
                />
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="rounded-2xl bg-brand-50 p-5 text-sm text-brand-800">
        <p className="font-semibold mb-2">Your privacy</p>
        <ul className="space-y-1.5">
          <li>
            ↪ Only the pro assigned to your booking sees this — never the whole
            marketplace.
          </li>
          <li>
            ↪ Every read is logged. You'll be able to see who saw what in a
            future update.
          </li>
          <li>
            ↪ You can change visibility or delete anything here, anytime.
          </li>
        </ul>
      </div>
    </div>
  );
}
