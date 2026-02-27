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
      select: { id: true, name: true, phone: true, email: true, createdAt: true },
    }),
    db.booking.count({ where: { customerId: session.userId } }),
    db.booking.count({ where: { customerId: session.userId, status: 'CONFIRMED' } }),
  ]);

  const profileComplete = !!(user?.name && user?.phone);
  const referralCode    = session.userId.slice(-8).toUpperCase();
  const appUrl          = process.env.NEXT_PUBLIC_APP_URL ?? 'https://groomee.ng';
  const whatsappMsg     = encodeURIComponent(
    `Book professional beauty services at home in Lagos! Use my code ${referralCode} for ₦2,000 off your first booking 💅 → ${appUrl}/?ref=${referralCode}`
  );

  return (
    <div className="mx-auto max-w-lg px-4 py-8 pb-24">
      <h1 className="mb-5 font-display text-2xl font-bold">My Profile</h1>

      {/* Identity card */}
      <div className="card p-5 mb-4">
        <div className="flex items-center gap-4 mb-4 pb-4 border-b border-gray-100">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-brand-100 text-2xl font-bold text-brand-700">
            {user?.name?.[0]?.toUpperCase() ?? '👤'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-gray-900">{user?.name ?? 'Name not set'}</p>
            <p className="text-sm text-gray-500">{user?.phone}</p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 text-center text-sm">
          {[
            { val: bookingCount,   label: 'Bookings' },
            { val: completedCount, label: 'Completed', green: true },
          ].map(s => (
            <div key={s.label} className="rounded-xl bg-gray-50 p-2.5">
              <p className={`text-xl font-extrabold ${s.green ? 'text-brand-600' : 'text-gray-900'}`}>{s.val}</p>
              <p className="text-xs text-gray-400 mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Menu items */}
      <div className="space-y-2 mb-4">
        {[
          { href: '/bookings',       icon: '📋', label: 'My bookings',   badge: bookingCount > 0 ? `${bookingCount}` : null, bc: 'gray' },
          { href: '/profile/beauty', icon: '✨', label: 'Beauty profile', badge: profileComplete ? '✓ Complete' : 'Incomplete', bc: profileComplete ? 'green' : 'orange' },
          { href: '/gift',           icon: '🎁', label: 'Gift a session', badge: null, bc: 'gray' },
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
                    'bg-gray-100 text-gray-500'
                  }`}>{item.badge}</span>
                )}
                <span className="text-gray-300">→</span>
              </div>
            </div>
          </Link>
        ))}
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