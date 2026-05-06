import { db } from "./db";
import { awardPoints, POINTS } from "./points";
import { sendMessage } from "./whatsapp";

export default async function autoConfirm(bookingId: string) {
  const booking = await db.booking.findUnique({
    where: { id: bookingId },
    include: { payment: true, customer: true },
  });

  if (!booking || booking.status !== "COMPLETED") return;
  if (!booking.proId) return; // No pro assigned — can't confirm

  // Atomic: conditional update prevents double-confirm race
  const confirmed = await db.$transaction(async (tx) => {
    const updated = await tx.booking.updateMany({
      where: { id: bookingId, status: "COMPLETED" },
      data: { status: "CONFIRMED", confirmedAt: new Date() },
    });
    if (updated.count === 0) return false;

    // Only update payment if it exists
    if (booking.payment) {
      await tx.payment.update({
        where: { bookingId },
        data: { status: "CAPTURED", capturedAt: new Date() },
      });
    }

    await tx.earning.upsert({
      where: {
        bookingId_proId_type: {
          bookingId,
          proId: booking.proId!,
          type: "SERVICE",
        },
      },
      update: {},
      create: {
        proId: booking.proId!,
        bookingId,
        amount: booking.proEarning,
        type: "SERVICE",
      },
    });

    await tx.pro.update({
      where: { id: booking.proId! },
      data: {
        availability: "ONLINE",
        currentBookingId: null,
        totalJobs: { increment: 1 },
      },
    });

    return true;
  });

  if (!confirmed) return; // Already confirmed by another path

  await awardPoints(
    booking.customerId,
    POINTS.BOOKING_COMPLETION,
    "Booking confirmed",
    bookingId,
  ).catch(console.error);

  if (booking.customer.phone) {
    await sendMessage(
      booking.customer.phone,
      `✅ Your booking has been auto-confirmed and payment of ₦${booking.totalAmount.toLocaleString()} released.\n\nThank you for using Groomee! We hope you enjoyed your service. 💚\n\nYou've earned ${POINTS.BOOKING_COMPLETION} Groomee Points.`,
    ).catch(console.error);
  }

  console.log(`[auto-confirm] Booking ${bookingId} auto-confirmed.`);
}
