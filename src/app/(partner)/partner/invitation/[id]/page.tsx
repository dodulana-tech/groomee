import Link from "next/link";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import InvitationActions from "./InvitationActions";

export const revalidate = 0;

export default async function ApprenticeInvitationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const session = await getSession();
  if (!session) {
    redirect(`/auth?next=/partner/invitation/${id}`);
  }

  const apprenticeship = await db.apprenticeship.findUnique({
    where: { id },
    include: {
      master: {
        select: {
          id: true,
          name: true,
          phone: true,
          photo: true,
          totalJobs: true,
          avgRating: true,
          reviewCount: true,
        },
      },
      apprentice: {
        select: { id: true, name: true, phone: true, userId: true },
      },
      modules: {
        orderBy: { sortOrder: "asc" },
        select: {
          id: true,
          title: true,
          description: true,
          required: true,
          gatesIndependence: true,
        },
      },
    },
  });

  if (!apprenticeship) {
    return (
      <div className="p-6 lg:p-8">
        <div className="glass rounded-2xl border border-white/20 p-10 text-center max-w-xl mx-auto">
          <h1 className="text-xl font-bold text-gray-900 mb-2">Invitation not found</h1>
          <p className="text-sm text-gray-500">
            This invitation link is invalid or has been removed. Please ask your master to resend it.
          </p>
          <Link href="/" className="btn-secondary btn-sm mt-4 inline-block">
            Back home
          </Link>
        </div>
      </div>
    );
  }

  // Auth gate: this invitation must belong to the logged-in user, either by
  // linked Pro.userId or by phone match.
  const matchesByUser =
    apprenticeship.apprentice.userId !== null &&
    apprenticeship.apprentice.userId === session.userId;
  const matchesByPhone =
    session.phone !== null && session.phone === apprenticeship.apprentice.phone;
  if (!matchesByUser && !matchesByPhone) {
    return (
      <div className="p-6 lg:p-8">
        <div className="glass rounded-2xl border border-white/20 p-10 text-center max-w-xl mx-auto">
          <div className="text-5xl mb-3">🔒</div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">Different account</h1>
          <p className="text-sm text-gray-500 mb-2">
            This invitation was sent to{" "}
            <span className="font-semibold">{apprenticeship.apprentice.phone}</span>.
          </p>
          <p className="text-sm text-gray-500">
            Sign in with that phone number to review it.
          </p>
        </div>
      </div>
    );
  }

  if (apprenticeship.status !== "PENDING_ACCEPT") {
    const messages: Record<string, { title: string; body: string; emoji: string }> = {
      IN_TRAINING: {
        emoji: "🎓",
        title: "You're in training",
        body: `You accepted ${apprenticeship.master.name}'s invitation. Welcome aboard.`,
      },
      READY_FOR_FREEDOM: {
        emoji: "✨",
        title: "Ready for Freedom",
        body: "You've completed the curriculum. Your Freedom ceremony is next.",
      },
      FREED: {
        emoji: "🕊️",
        title: "Freed",
        body: "You've graduated. Independent practice is yours.",
      },
      TERMINATED: {
        emoji: "❌",
        title: "Invitation closed",
        body:
          apprenticeship.terminationReason === "declined by apprentice"
            ? "You already declined this invitation."
            : apprenticeship.terminationReason === "cancelled by master"
              ? "This invitation was cancelled by the master."
              : "This invitation was closed.",
      },
    };
    const m = messages[apprenticeship.status];
    return (
      <div className="p-6 lg:p-8">
        <div className="glass rounded-2xl border border-white/20 p-10 text-center max-w-xl mx-auto">
          <div className="text-5xl mb-3">{m.emoji}</div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">{m.title}</h1>
          <p className="text-sm text-gray-500 mb-4">{m.body}</p>
          <Link href="/partner" className="btn-primary btn-sm">
            Go to partner portal
          </Link>
        </div>
      </div>
    );
  }

  const masterInitials = apprenticeship.master.name
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  const gatingModules = apprenticeship.modules.filter((m) => m.gatesIndependence);
  const advancedModules = apprenticeship.modules.filter((m) => !m.gatesIndependence);
  const commissionPct = Math.round(apprenticeship.masterCommission * 100);

  return (
    <div className="p-6 lg:p-8 max-w-2xl mx-auto space-y-6">
      <div className="glass rounded-2xl border border-white/20 p-6 shadow-lg">
        <div className="flex items-start gap-4">
          {apprenticeship.master.photo ? (
            <img
              src={apprenticeship.master.photo}
              alt={apprenticeship.master.name}
              className="h-16 w-16 rounded-full object-cover border-2 border-white shadow-md"
            />
          ) : (
            <div className="h-16 w-16 rounded-full bg-brand-100 border-2 border-white shadow-md flex items-center justify-center text-xl font-bold text-brand-700 select-none">
              {masterInitials}
            </div>
          )}
          <div className="flex-1">
            <p className="text-xs uppercase tracking-wider text-brand-600 font-bold">
              Apprenticeship invitation
            </p>
            <h1 className="text-2xl font-bold text-gray-900 mt-1">
              {apprenticeship.master.name} wants to train you
            </h1>
            <div className="flex items-center gap-3 mt-1.5 text-xs text-gray-500">
              <span>★ {apprenticeship.master.avgRating.toFixed(1)}</span>
              <span>•</span>
              <span>{apprenticeship.master.totalJobs} jobs completed</span>
              <span>•</span>
              <span>{apprenticeship.master.reviewCount} reviews</span>
            </div>
          </div>
        </div>
      </div>

      <div className="glass rounded-2xl border border-white/20 p-6 shadow-lg">
        <h2 className="font-bold text-gray-900 mb-3">The terms</h2>
        <div className="space-y-3">
          <div className="flex items-start gap-3">
            <span className="text-2xl">💰</span>
            <div>
              <p className="text-sm font-semibold text-gray-900">
                {commissionPct}% master&apos;s cut
              </p>
              <p className="text-xs text-gray-500">
                Your master takes {commissionPct}% of your earnings (after Groomee&apos;s platform fee). The rest is yours.
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <span className="text-2xl">🛡️</span>
            <div>
              <p className="text-sm font-semibold text-gray-900">
                Bookings flow through your master at first
              </p>
              <p className="text-xs text-gray-500">
                You can&apos;t take independent customer bookings until your master signs you off and approves your independence.
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <span className="text-2xl">🎓</span>
            <div>
              <p className="text-sm font-semibold text-gray-900">
                Graduate to Freedom
              </p>
              <p className="text-xs text-gray-500">
                Once you&apos;ve completed the full curriculum, hit the milestone thresholds, and your master signs off, you graduate with a verified Freedom certificate — fully independent.
              </p>
            </div>
          </div>
          {apprenticeship.expectedFreedom && (
            <div className="flex items-start gap-3">
              <span className="text-2xl">📅</span>
              <div>
                <p className="text-sm font-semibold text-gray-900">
                  Expected Freedom date
                </p>
                <p className="text-xs text-gray-500">
                  {new Date(apprenticeship.expectedFreedom).toLocaleDateString("en-NG", {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="glass rounded-2xl border border-white/20 p-6 shadow-lg">
        <h2 className="font-bold text-gray-900 mb-3">
          Your curriculum ({apprenticeship.modules.length} modules)
        </h2>
        <p className="text-xs text-gray-500 mb-4">
          Defaults from Groomee — your master can adjust these anytime to fit your specialty.
        </p>
        <div className="space-y-3">
          {gatingModules.length > 0 && (
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-amber-700 mb-2">
                Required for independent bookings
              </p>
              <div className="space-y-2">
                {gatingModules.map((m) => (
                  <div key={m.id} className="rounded-xl bg-white/60 p-3">
                    <p className="text-sm font-semibold text-gray-900">{m.title}</p>
                    {m.description && (
                      <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">
                        {m.description}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
          {advancedModules.length > 0 && (
            <div className="pt-3">
              <p className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">
                Required for Freedom
              </p>
              <div className="space-y-2">
                {advancedModules.map((m) => (
                  <div key={m.id} className="rounded-xl bg-white/60 p-3">
                    <p className="text-sm font-semibold text-gray-900">{m.title}</p>
                    {m.description && (
                      <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">
                        {m.description}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <InvitationActions id={apprenticeship.id} masterName={apprenticeship.master.name} />
    </div>
  );
}
