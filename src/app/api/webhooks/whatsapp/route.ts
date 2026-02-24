import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { handleGroomerResponse, issueStrike } from "@/lib/dispatch";
import {
  sendGroomerStatusAck,
  sendGroomerBalanceInfo,
  sendGroomerBookingDetails,
  notifyCustomerGroomerEnRoute,
  notifyCustomerGroomerArrived,
  notifyCustomerServiceComplete,
} from "@/lib/whatsapp";
import { generateMapsLinkFromAddress, maskPhone } from "@/lib/utils";
import { format, addWeeks, nextFriday } from "date-fns";

// Termii sends webhook on inbound messages
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // Normalise across providers
    const from: string = body.from ?? body.sender ?? "";
    const rawMessage: string = (body.text ?? body.sms ?? body.message ?? "")
      .trim()
      .toUpperCase();

    if (!from) return NextResponse.json({ ok: true });

    // Find groomer by phone
    const groomer = await db.groomer.findFirst({ where: { phone: from } });
    if (!groomer) {
      // Unknown sender — ignore silently
      return NextResponse.json({ ok: true });
    }

    // ── YES / NO ──────────────────────────────────────────────────
    if (rawMessage === "YES" || rawMessage === "NO") {
      const result = await handleGroomerResponse(
        groomer.id,
        rawMessage as "YES" | "NO",
      );

      if (rawMessage === "YES" && result.accepted && result.bookingId) {
        const booking = await db.booking.findUnique({
          where: { id: result.bookingId },
          include: { customer: true, zone: true },
        });
        if (booking) {
          const mapsLink =
            booking.latitude && booking.longitude
              ? `https://maps.google.com?q=${booking.latitude},${booking.longitude}`
              : generateMapsLinkFromAddress(booking.address);

          await sendGroomerBookingDetails({
            phone: groomer.phone,
            customerName: booking.customer.name ?? "Customer",
            address: booking.address,
            mapsLink,
            maskedPhone: maskPhone(booking.customer.phone),
          });

          // Notify customer
          const { notifyCustomerBookingConfirmed } =
            await import("@/lib/whatsapp");
          await notifyCustomerBookingConfirmed(
            booking.customer.phone,
            groomer.name,
            "20–45 minutes",
          );
        }
      }
      return NextResponse.json({ ok: true });
    }

    // ── ON / OFF ──────────────────────────────────────────────────
    if (rawMessage === "ON" || rawMessage === "OFF") {
      const availability = rawMessage === "ON" ? "ONLINE" : "OFFLINE";
      await db.groomer.update({
        where: { id: groomer.id },
        data: { availability },
      });
      await sendGroomerStatusAck(groomer.phone, rawMessage as "ON" | "OFF");
      return NextResponse.json({ ok: true });
    }

    // ── OTWAY (On The Way) ────────────────────────────────────────
    if (rawMessage === "OTWAY") {
      const booking = await db.booking.findFirst({
        where: { groomerId: groomer.id, status: "ACCEPTED" },
        include: { customer: true },
      });
      if (booking) {
        await db.booking.update({
          where: { id: booking.id },
          data: { status: "EN_ROUTE", enRouteAt: new Date() },
        });
        await sendGroomerStatusAck(groomer.phone, "OTWAY");
        await notifyCustomerGroomerEnRoute(
          booking.customer.phone,
          groomer.name,
          25,
        );
      }
      return NextResponse.json({ ok: true });
    }

    // ── ARRIVED ───────────────────────────────────────────────────
    if (rawMessage === "ARRIVED") {
      const booking = await db.booking.findFirst({
        where: {
          groomerId: groomer.id,
          status: { in: ["EN_ROUTE", "ACCEPTED"] },
        },
        include: { customer: true },
      });
      if (booking) {
        await db.booking.update({
          where: { id: booking.id },
          data: { status: "ARRIVED", arrivedAt: new Date() },
        });
        await sendGroomerStatusAck(groomer.phone, "ARRIVED");
        await notifyCustomerGroomerArrived(
          booking.customer.phone,
          groomer.name,
        );
      }
      return NextResponse.json({ ok: true });
    }

    // ── DONE ──────────────────────────────────────────────────────
    if (rawMessage === "DONE") {
      const booking = await db.booking.findFirst({
        where: {
          groomerId: groomer.id,
          status: { in: ["ARRIVED", "IN_SERVICE", "EN_ROUTE"] },
        },
        include: { customer: true },
      });
      if (booking) {
        await db.booking.update({
          where: { id: booking.id },
          data: { status: "COMPLETED", completedAt: new Date() },
        });
        await sendGroomerStatusAck(groomer.phone, "DONE");
        await notifyCustomerServiceComplete(
          booking.customer.phone,
          booking.id,
          booking.totalAmount,
        );

        // Schedule auto-capture after 2 hours
        const autoCaptureHours = 2;
        setTimeout(
          async () => {
            const latest = await db.booking.findUnique({
              where: { id: booking.id },
            });
            if (latest?.status === "COMPLETED") {
              const { default: confirmFn } = await import("@/lib/auto-confirm");
              await confirmFn(booking.id);
            }
          },
          autoCaptureHours * 60 * 60 * 1000,
        );
      }
      return NextResponse.json({ ok: true });
    }

    // ── CANCEL ────────────────────────────────────────────────────
    if (rawMessage === "CANCEL") {
      const booking = await db.booking.findFirst({
        where: {
          groomerId: groomer.id,
          status: { in: ["ACCEPTED", "EN_ROUTE"] },
        },
        include: { customer: true },
      });
      if (booking) {
        const strikeReason =
          booking.status === "EN_ROUTE"
            ? "CANCELLED_ENROUTE"
            : "CANCELLED_BEFORE";
        await db.booking.update({
          where: { id: booking.id },
          data: { status: "DISPATCHING", groomerId: null },
        });
        await db.groomer.update({
          where: { id: groomer.id },
          data: { availability: "ONLINE", currentBookingId: null },
        });
        await sendGroomerStatusAck(groomer.phone, "CANCEL");
        await issueStrike(groomer.id, booking.id, strikeReason as never);

        // Attempt re-dispatch
        const { tryNextGroomer } = await import("@/lib/dispatch");
        await tryNextGroomer(booking.id);
      }
      return NextResponse.json({ ok: true });
    }

    // ── BALANCE ───────────────────────────────────────────────────
    if (rawMessage === "BALANCE") {
      const pendingEarnings = await db.earning.aggregate({
        where: { groomerId: groomer.id, paid: false },
        _sum: { amount: true },
      });
      const nextFri = format(nextFriday(new Date()), "EEEE do MMMM");
      await sendGroomerBalanceInfo(
        groomer.phone,
        pendingEarnings._sum.amount ?? 0,
        nextFri,
      );
      return NextResponse.json({ ok: true });
    }

    // ── SCORE ─────────────────────────────────────────────────────
    if (rawMessage === "SCORE") {
      const { sendMessage } = await import("@/lib/whatsapp");
      const creditRes = await fetch(
        `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/api/groomer/credit-score?groomerId=${groomer.id}`,
      );
      if (creditRes.ok) {
        const { data } = await creditRes.json();
        const tierEmoji =
          data.tier === "platinum"
            ? "💎"
            : data.tier === "gold"
              ? "🥇"
              : data.tier === "silver"
                ? "🥈"
                : "🥉";
        const advanceText = data.advanceEligible
          ? `✅ Advance eligible — up to ₦${data.maxAdvanceAmount.toLocaleString()}\nText ADVANCE [amount] [reason] to apply`
          : `❌ Not yet eligible for advance`;
        await sendMessage(
          groomer.phone,
          `${tierEmoji} *Your Groomee Score*\n\n` +
            `Score: *${data.score}/850* (${data.tier.charAt(0).toUpperCase() + data.tier.slice(1)})\n\n` +
            `📋 Breakdown:\n` +
            `• Jobs completed: ${data.completedJobs}\n` +
            `• Rating: ★${data.avgRating.toFixed(1)}\n` +
            `• Months active: ${data.monthsActive}\n` +
            `• On-time rate: ${Math.round(data.onTimeRate * 100)}%\n\n` +
            `💳 ${advanceText}\n\n` +
            `Higher scores unlock larger advances and better rates.`,
        );
      }
      return NextResponse.json({ ok: true });
    }

    // ── ADVANCE ───────────────────────────────────────────────────
    // Format: ADVANCE 15000 Need equipment for upcoming jobs
    if (rawMessage.startsWith("ADVANCE ")) {
      const { sendMessage } = await import("@/lib/whatsapp");
      const parts = rawMessage.split(" ");
      const rawAmount = parseFloat(parts[1] ?? "");
      const reason = parts.slice(2).join(" ");

      if (isNaN(rawAmount) || rawAmount < 5000) {
        await sendMessage(
          groomer.phone,
          `❌ Invalid amount. Minimum advance is ₦5,000.\n\nFormat: ADVANCE [amount] [reason]\nExample: ADVANCE 15000 Need new equipment`,
        );
        return NextResponse.json({ ok: true });
      }
      if (!reason || reason.length < 10) {
        await sendMessage(
          groomer.phone,
          `❌ Please include a reason (at least 10 characters).\n\nFormat: ADVANCE [amount] [reason]\nExample: ADVANCE 15000 I need to buy new nail equipment for upcoming bookings`,
        );
        return NextResponse.json({ ok: true });
      }

      // Call advance API
      const advRes = await fetch(
        `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/api/groomer/advance`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            groomerId: groomer.id,
            amount: rawAmount,
            reason,
          }),
        },
      );
      const advData = await advRes.json();
      if (advRes.ok) {
        await sendMessage(
          groomer.phone,
          `✅ *Advance Request Received*\n\n` +
            `Amount: ₦${rawAmount.toLocaleString()}\nReason: ${reason}\n\n` +
            `Our team will review and respond within 24 hours. Approved funds are disbursed directly to your bank account.\n\n` +
            `Repayment: 30% is deducted from each weekly payout until cleared.`,
        );
      } else {
        await sendMessage(
          groomer.phone,
          `❌ ${advData.error ?? "Could not process advance request. Text SCORE to check eligibility."}`,
        );
      }
      return NextResponse.json({ ok: true });
    }

    // ── HELP ──────────────────────────────────────────────────────
    if (rawMessage === "HELP") {
      const { sendMessage } = await import("@/lib/whatsapp");
      await sendMessage(
        groomer.phone,
        `📱 *Groomee Commands*\n\n` +
          `*Job management:*\n` +
          `YES — Accept a job offer\n` +
          `NO — Decline a job offer\n` +
          `OTWAY — Mark yourself en route\n` +
          `ARRIVED — Mark yourself arrived\n` +
          `DONE — Mark service complete\n` +
          `CANCEL — Cancel current job\n\n` +
          `*Availability:*\n` +
          `ON — Go online (receive jobs)\n` +
          `OFF — Go offline\n\n` +
          `*Earnings & Growth:*\n` +
          `BALANCE — Check pending earnings\n` +
          `SCORE — View your Groomee credit score\n` +
          `ADVANCE [amt] [reason] — Request salary advance\n\n` +
          `*Support:*\n` +
          `HELP — Show this menu\n\n` +
          `For urgent issues call: ${process.env.ADMIN_SUPPORT_PHONE ?? "07000000000"}`,
      );
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("WhatsApp webhook error:", err);
    return NextResponse.json({ error: "Webhook error" }, { status: 500 });
  }
}
