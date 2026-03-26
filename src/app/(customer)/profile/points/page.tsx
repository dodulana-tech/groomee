import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { db } from '@/lib/db';
import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Points History' };
export const revalidate = 0;

export default async function PointsHistoryPage() {
  const session = await getSession();
  if (!session) redirect('/auth?redirect=/profile/points');

  const [user, ledger] = await Promise.all([
    db.user.findUnique({
      where: { id: session.userId },
      select: { points: true },
    }),
    db.pointsLedger.findMany({
      where: { userId: session.userId },
      orderBy: { createdAt: 'desc' },
    }),
  ]);

  const balance = user?.points ?? 0;

  return (
    <div className="mx-auto max-w-lg px-4 py-8 pb-24">
      {/* Back link */}
      <Link href="/profile" className="mb-5 inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700">
        ← Back to Profile
      </Link>

      <h1 className="mb-5 font-display text-2xl font-bold">Loyalty Points</h1>

      {/* Balance hero */}
      <div className="card p-6 mb-4 text-center">
        <p className="text-xs uppercase tracking-widest text-gray-400 mb-1">Current balance</p>
        <p className="text-5xl font-extrabold text-brand-600">{balance}</p>
        <p className="text-sm text-gray-500 mt-1">points</p>
        <div className="mt-4 rounded-xl bg-brand-50 px-4 py-3">
          <p className="text-sm font-medium text-brand-700">100 pts = ₦500 off your next booking</p>
          <p className="text-xs text-gray-500 mt-0.5">
            Tick &ldquo;Redeem points&rdquo; when creating a booking to apply the discount.
          </p>
        </div>
      </div>

      {/* Ledger */}
      <div className="card overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100">
          <p className="font-semibold text-gray-900 text-sm">Transaction history</p>
        </div>

        {ledger.length === 0 ? (
          <div className="px-4 py-10 text-center">
            <p className="text-3xl mb-2">⭐</p>
            <p className="text-sm font-medium text-gray-700">No points yet</p>
            <p className="text-xs text-gray-400 mt-1">Complete bookings and refer friends to earn points.</p>
          </div>
        ) : (
          <ul className="divide-y divide-gray-100">
            {ledger.map((entry) => {
              const isPositive = entry.amount > 0;
              const date = new Date(entry.createdAt);
              const formatted = date.toLocaleDateString('en-NG', {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
              });
              return (
                <li key={entry.id} className="flex items-center justify-between px-4 py-3.5">
                  <div className="flex-1 min-w-0 pr-3">
                    <p className="text-sm font-medium text-gray-800 truncate">{entry.reason}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{formatted}</p>
                  </div>
                  <span
                    className={`shrink-0 text-sm font-bold tabular-nums ${
                      isPositive ? 'text-brand-600' : 'text-red-500'
                    }`}
                  >
                    {isPositive ? '+' : ''}{entry.amount} pts
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
