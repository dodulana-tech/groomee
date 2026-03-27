import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { db } from '@/lib/db';
import Link from 'next/link';
import LogoutButton from './LogoutButton';
import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'My Profile' };
export const revalidate = 0;

export default async function ProfilePage() {
  const session = await getSession();
  if (!session) redirect('/auth?redirect=/profile');

  const [user, bookingCount, completedCount] = await Promise.all([
    db.user.findUnique({
      where:  { id: session.userId },
      select: { id: true, name: true, phone: true, email: true, createdAt: true, points: true },
    }),
    db.booking.count({ where: { customerId: session.userId } }),
    db.booking.count({ where: { customerId: session.userId, status: 'CONFIRMED' } }),
  ]);

  // These features are coming soon - stubbed until models are added
  const subscription = null;
  const referrals:    any[] = [];
  const squadCount   = 0;

  const isTempPhone = user?.phone?.startsWith("+234_email_") ?? false;
  const profileComplete = !!(user?.name && !isTempPhone);
  const displayPhone = isTempPhone ? user?.email ?? "Email login" : user?.phone;
  const referralCode    = session.userId.slice(-8).toUpperCase();
  const appUrl          = process.env.NEXT_PUBLIC_APP_URL ?? 'https://groomee.ng';
  const whatsappMsg     = encodeURIComponent(
    `Book professional beauty services at home in Lagos! Use my code ${referralCode} for ₦2,000 off your first booking 💅🏿 → ${appUrl}/?ref=${referralCode}`
  );

  return (
    <div className="mx-auto max-w-lg px-4 py-8 pb-24">
      <h1 className="mb-5 font-display text-2xl font-bold">My Profile</h1>

      {/* Complete profile banner */}
      {!profileComplete && (
        <Link
          href="/profile/edit"
          className="mb-4 flex items-center gap-3 rounded-2xl border-2 border-amber-200 bg-amber-50 p-4 transition-all hover:border-amber-300 hover:shadow-sm"
        >
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-100 text-lg">⚠️</span>
          <div className="flex-1">
            <p className="text-sm font-bold text-amber-900">Complete your profile</p>
            <p className="text-xs text-amber-700">
              {!user?.name ? "Add your name" : ""}
              {!user?.name && isTempPhone ? " and " : ""}
              {isTempPhone ? "link your phone number" : ""}
              {" "}to book beauty pros.
            </p>
          </div>
          <span className="text-amber-400">→</span>
        </Link>
      )}

      {/* Identity card */}
      <div className="card p-5 mb-4">
        <div className="flex items-center gap-4 mb-4 pb-4 border-b border-gray-100">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-brand-100 text-2xl font-bold text-brand-700">
            {user?.name?.[0]?.toUpperCase() ?? '👤'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-gray-900">{user?.name ?? 'Name not set'}</p>
            <p className="text-sm text-gray-500">{displayPhone}</p>
            {subscription && (
              <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-brand-100 px-2 py-0.5 text-xs font-bold text-brand-700">
                🌿 {(subscription as any).plan.name}
              </span>
            )}
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3 text-center text-sm">
          {[
            { val: bookingCount,   label: 'Bookings' },
            { val: completedCount, label: 'Completed', green: true },
            { val: referrals.filter((r: any) => r.referredUserId).length, label: 'Referrals' },
          ].map(s => (
            <div key={s.label} className="rounded-xl bg-gray-50 p-2.5">
              <p className={`text-xl font-extrabold ${s.green ? 'text-brand-600' : 'text-gray-900'}`}>{s.val}</p>
              <p className="text-xs text-gray-400 mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Beauty profile nudge */}
      {!profileComplete && (
        <Link href="/profile/beauty">
          <div className="mb-4 flex items-center gap-3 rounded-2xl border border-pink-200 bg-gradient-to-r from-pink-50 to-orange-50 p-4">
            <span className="text-2xl">✨</span>
            <div className="flex-1">
              <p className="text-sm font-bold text-gray-900">Complete your Beauty Profile</p>
              <p className="text-xs text-gray-500 mt-0.5">Pros arrive prepared when they know your hair type, skin tone and allergies.</p>
            </div>
            <span className="shrink-0 rounded-full bg-accent px-3 py-1 text-xs font-bold text-white">Set up →</span>
          </div>
        </Link>
      )}

      {/* Menu items */}
      <div className="space-y-2 mb-4">
        {[
          { href: '/bookings',       icon: '📋', label: 'My bookings',        badge: bookingCount > 0 ? `${bookingCount}` : null, bc: 'gray' },
          { href: '/profile/beauty', icon: '✨', label: 'Beauty profile',      badge: profileComplete ? '✓ Complete' : 'Incomplete', bc: profileComplete ? 'green' : 'orange' },
          { href: '/profile/squad',  icon: '💇', label: 'My Squad',            badge: `${squadCount}/3`, bc: squadCount > 0 ? 'green' : 'gray' },
          { href: '/subscriptions',  icon: '🌿', label: 'Subscription plans',  badge: 'Save 15%', bc: 'brand' },
          { href: '/gift',           icon: '🎁', label: 'Gift a Glow-up',       badge: null, bc: 'gray' },
        ].map(item => (
          <Link key={item.href} href={item.href}>
            <div className="card flex items-center justify-between p-4 hover:bg-gray-50/80 transition-colors">
              <div className="flex items-center gap-3">
                <span className="text-xl">{item.icon}</span>
                <span className="font-medium text-gray-800">{item.label}</span>
              </div>
              <div className="flex items-center gap-2">
                {item.badge && (
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${
                    item.bc === 'green'  ? 'bg-brand-100 text-brand-700' :
                    item.bc === 'orange' ? 'bg-orange-100 text-orange-600' :
                    item.bc === 'brand'  ? 'bg-brand-600 text-white' :
                    'bg-gray-100 text-gray-500'
                  }`}>{item.badge}</span>
                )}
                <span className="text-gray-300">→</span>
              </div>
            </div>
          </Link>
        ))}
      </div>

      {/* Points balance card */}
      <div className="card p-4 mb-4">
        <div className="flex items-center justify-between mb-2">
          <p className="font-semibold text-gray-900 text-sm">⭐ Loyalty Points</p>
          <Link href="/profile/points" className="text-xs text-brand-600 font-medium hover:underline">
            View history →
          </Link>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex flex-col">
            <span className="text-3xl font-extrabold text-brand-600">{user?.points ?? 0}</span>
            <span className="text-xs text-gray-400 mt-0.5">points</span>
          </div>
          <div className="flex-1 rounded-xl bg-brand-50 px-3 py-2.5">
            <p className="text-xs font-medium text-brand-700">100 pts = ₦500 off your next booking</p>
            <p className="text-xs text-gray-500 mt-0.5">Earn points by completing bookings & referrals.</p>
          </div>
        </div>
      </div>

      {/* Referral card */}
      <div className="card p-4 mb-4">
        <p className="font-semibold text-gray-900 mb-1 text-sm">🤝 Refer a friend, earn ₦2,000</p>
        <p className="text-xs text-gray-500 mb-3">
          Share your code. When a friend completes their first booking, you both get ₦2,000 credit.
        </p>
        <div className="flex items-center gap-2">
          <div className="flex-1 rounded-xl bg-gray-100 px-3 py-2.5 font-mono text-base font-bold tracking-[0.2em] text-gray-800 text-center">
            {referralCode}
          </div>
          <a
            href={`https://wa.me/?text=${whatsappMsg}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 rounded-xl bg-[#25D366] px-4 py-2.5 text-xs font-bold text-white shadow-sm"
          >
            <span>📲</span> Share
          </a>
        </div>
      </div>

      <LogoutButton />
    </div>
  );
}