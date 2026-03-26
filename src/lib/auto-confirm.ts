import { db } from "./db";
import { awardPoints, POINTS } from "./points";
import { sendMessage } from "./whatsapp";

export default async function autoConfirm(bookingId: string) {
  const booking = await db.booking.findUnique({
    where: { id: bookingId },
    include: { payment: true, customer: true },
  });

  if (!booking || booking.status !== "COMPLETED") return;

  await db.$transaction(async (tx) => {
    await tx.booking.update({
      where: { id: bookingId },
      data: { status: "CONFIRMED", confirmedAt: new Date() },
    });

    await tx.payment.update({
      where: { bookingId },
      data: { status: "CAPTURED", capturedAt: new Date() },
    });

    if (booking.proId) {
      await tx.earning.upsert({
        where: { bookingId },
        update: {},
        create: {
          proId: booking.proId,
          bookingId,
          amount: booking.proEarning,
        },
      });

      await tx.pro.update({
        where: { id: booking.proId },
        data: {
          availability: "ONLINE",
          currentBookingId: null,
          totalJobs: { increment: 1 },
        },
      });
    }
  });

  // Award booking completion points to the customer
  await awardPoints(
    booking.customerId,
    POINTS.BOOKING_COMPLETION,
    "Booking confirmed",
    bookingId,
  ).catch(console.error);

  // Notify the customer via WhatsApp that their booking was auto-confirmed
  await sendMessage(
    booking.customer.phone,
    `✅ Your booking has been auto-confirmed and payment of ₦${booking.totalAmount.toLocaleString()} released.\n\nThank you for using Groomee! We hope you enjoyed your service. 💚\n\nYou've earned ${POINTS.BOOKING_COMPLETION} Groomee Points.`,
  ).catch(console.error);

  console.log(`[auto-confirm] Booking ${bookingId} auto-confirmed.`);
}
