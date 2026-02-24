import { db } from "./db";

export default async function autoConfirm(bookingId: string) {
  const booking = await db.booking.findUnique({
    where: { id: bookingId },
    include: { payment: true },
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

    if (booking.groomerId) {
      await tx.earning.upsert({
        where: { bookingId },
        update: {},
        create: {
          groomerId: booking.groomerId,
          bookingId,
          amount: booking.groomerEarning,
        },
      });

      await tx.groomer.update({
        where: { id: booking.groomerId },
        data: {
          availability: "ONLINE",
          currentBookingId: null,
          totalJobs: { increment: 1 },
        },
      });
    }
  });

  console.log(`[auto-confirm] Booking ${bookingId} auto-confirmed.`);
}
