import { db } from "@/lib/db";
import { sendEmail } from "@/lib/email";
import {
  bookingCreatedEmail,
  paymentConfirmedEmail,
  bookingCancelledEmail,
  serviceConfirmedEmail,
  reviewThankYouEmail,
  noProEmail,
  apprenticeInvitationEmail,
  apprenticeInviteAcceptedEmail,
} from "@/lib/email-templates";
import { formatNaira } from "@/lib/utils";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://groomee.ng";

async function getCustomerEmail(userId: string): Promise<string | null> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { email: true },
  });
  return user?.email ?? null;
}

/** Fire-and-forget email send. Never throws. */
function fireEmail(to: string, template: { subject: string; html: string }) {
  sendEmail({ to, subject: template.subject, html: template.html }).catch(
    (err) => console.error("[email-notify] send failed:", err),
  );
}

export async function emailBookingCreated(booking: {
  id: string;
  reference: string;
  totalAmount: number;
  isAsap: boolean;
  customerId: string;
  service: { name: string };
  pro?: { name: string } | null;
  authorizationUrl?: string;
}) {
  const email = await getCustomerEmail(booking.customerId);
  if (!email) return;
  const customer = await db.user.findUnique({
    where: { id: booking.customerId },
    select: { name: true },
  });
  fireEmail(
    email,
    bookingCreatedEmail({
      customerName: customer?.name ?? "there",
      serviceName: booking.service.name,
      proName: booking.pro?.name ?? null,
      reference: booking.reference,
      total: formatNaira(booking.totalAmount),
      isAsap: booking.isAsap,
      paymentUrl: booking.authorizationUrl,
    }),
  );
}

export async function emailPaymentConfirmed(booking: {
  id: string;
  reference: string;
  totalAmount: number;
  customerId: string;
  service: { name: string };
}) {
  const email = await getCustomerEmail(booking.customerId);
  if (!email) return;
  const customer = await db.user.findUnique({
    where: { id: booking.customerId },
    select: { name: true },
  });
  fireEmail(
    email,
    paymentConfirmedEmail({
      customerName: customer?.name ?? "there",
      serviceName: booking.service.name,
      total: formatNaira(booking.totalAmount),
      reference: booking.reference,
      bookingUrl: `${APP_URL}/booking/${booking.id}`,
    }),
  );
}

export async function emailBookingCancelled(booking: {
  reference: string;
  customerId: string;
  service: { name: string };
  refundAmount?: number;
}) {
  const email = await getCustomerEmail(booking.customerId);
  if (!email) return;
  const customer = await db.user.findUnique({
    where: { id: booking.customerId },
    select: { name: true },
  });
  fireEmail(
    email,
    bookingCancelledEmail({
      customerName: customer?.name ?? "there",
      serviceName: booking.service.name,
      reference: booking.reference,
      refundAmount: booking.refundAmount
        ? formatNaira(booking.refundAmount)
        : null,
    }),
  );
}

export async function emailServiceConfirmed(booking: {
  id: string;
  totalAmount: number;
  customerId: string;
  service: { name: string };
  pro: { name: string };
  pointsEarned: number;
}) {
  const email = await getCustomerEmail(booking.customerId);
  if (!email) return;
  const customer = await db.user.findUnique({
    where: { id: booking.customerId },
    select: { name: true },
  });
  fireEmail(
    email,
    serviceConfirmedEmail({
      customerName: customer?.name ?? "there",
      proName: booking.pro.name,
      serviceName: booking.service.name,
      total: formatNaira(booking.totalAmount),
      pointsEarned: booking.pointsEarned,
      bookingUrl: `${APP_URL}/booking/${booking.id}`,
    }),
  );
}

export async function emailReviewThankYou(data: {
  customerId: string;
  proName: string;
  rating: number;
  pointsEarned: number;
}) {
  const email = await getCustomerEmail(data.customerId);
  if (!email) return;
  const customer = await db.user.findUnique({
    where: { id: data.customerId },
    select: { name: true },
  });
  fireEmail(
    email,
    reviewThankYouEmail({
      customerName: customer?.name ?? "there",
      proName: data.proName,
      rating: data.rating,
      pointsEarned: data.pointsEarned,
    }),
  );
}

export async function emailNoPro(booking: {
  customerId: string;
  service: { name: string };
}) {
  const email = await getCustomerEmail(booking.customerId);
  if (!email) return;
  const customer = await db.user.findUnique({
    where: { id: booking.customerId },
    select: { name: true },
  });
  fireEmail(
    email,
    noProEmail({
      customerName: customer?.name ?? "there",
      serviceName: booking.service.name,
    }),
  );
}

// ─── APPRENTICESHIP ──────────────────────────────────────────────────────────

export async function emailApprenticeInvitation(data: {
  to: string;
  masterName: string;
  acceptUrl: string;
  commissionPct: number;
}) {
  if (!data.to) return;
  fireEmail(
    data.to,
    apprenticeInvitationEmail({
      masterName: data.masterName,
      acceptUrl: data.acceptUrl,
      commissionPct: data.commissionPct,
    }),
  );
}

export async function emailInviteAccepted(data: {
  to: string;
  apprenticeName: string;
}) {
  if (!data.to) return;
  fireEmail(
    data.to,
    apprenticeInviteAcceptedEmail({
      apprenticeName: data.apprenticeName,
    }),
  );
}
