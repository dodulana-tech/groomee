import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { handleProResponse, issueStrike } from "@/lib/dispatch";
import {
  sendProStatusAck,
  sendProBalanceInfo,
  sendProBookingDetails,
  notifyCustomerProEnRoute,
  notifyCustomerProArrived,
  notifyCustomerServiceComplete,
} from "@/lib/whatsapp";
import { generateMapsLinkFromAddress, maskPhone } from "@/lib/utils";
import { format, addWeeks, nextFriday } from "date-fns";
import crypto from "crypto";

// Validate Twilio webhook signature
function validateTwilioSignature(req: NextRequest, body: Record<string, any>): boolean {
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  if (!authToken) return false; // Fail closed if no token configured

  const signature = req.headers.get("x-twilio-signature");
  if (!signature) return false;

  // Build the validation URL and sorted params
  const url = req.url;
  const sortedParams = Object.keys(body)
    .sort()
    .reduce((acc, key) => acc + key + body[key], "");

  const expected = crypto
    .createHmac("sha1", authToken)
    .update(url + sortedParams)
    .digest("base64");

  try {
    return crypto.timingSafeEqual(
      Buffer.from(expected),
      Buffer.from(signature),
    );
  } catch {
    return false;
  }
}

export async function POST(req: NextRequest) {
  try {
    // Twilio sends form-encoded data; other providers may send JSON
    let body: Record<string, any>;
    const contentType = req.headers.get("content-type") ?? "";
    if (contentType.includes("application/x-www-form-urlencoded")) {
      const text = await req.text();
      const params = new URLSearchParams(text);
      body = Object.fromEntries(params.entries());
    } else {
      body = await req.json();
    }

    // SECURITY: Validate webhook signature to prevent spoofing
    if (process.env.NODE_ENV !== "development") {
      if (!validateTwilioSignature(req, body)) {
        console.warn("WhatsApp webhook: invalid signature");
        return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
      }
    }

    // Normalise across providers
    const from: string = body.from ?? body.sender ?? "";
    const rawMessage: string = (body.text ?? body.sms ?? body.message ?? "")
      .trim()
      .toUpperCase();

    if (!from) return NextResponse.json({ ok: true });

    // Find pro by phone
    const pro = await db.pro.findFirst({ where: { phone: from } });
    if (!pro) {
      // Unknown sender - ignore silently
      return NextResponse.json({ ok: true });
    }

    // ── YES / NO ──────────────────────────────────────────────────
    if (rawMessage === "YES" || rawMessage === "NO") {
      const result = await handleProResponse(
        pro.id,
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

          await sendProBookingDetails({
            phone: pro.phone,
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
            pro.name,
            "20–45 minutes",
          );
        }
      }
      return NextResponse.json({ ok: true });
    }

    // ── ON / OFF ──────────────────────────────────────────────────
    if (rawMessage === "ON" || rawMessage === "OFF") {
      const availability = rawMessage === "ON" ? "ONLINE" : "OFFLINE";
      await db.pro.update({
        where: { id: pro.id },
        data: { availability },
      });
      await sendProStatusAck(pro.phone, rawMessage as "ON" | "OFF");
      return NextResponse.json({ ok: true });
    }

    // ── OTWAY (On The Way) ────────────────────────────────────────
    if (rawMessage === "OTWAY") {
      const booking = await db.booking.findFirst({
        where: { proId: pro.id, status: "ACCEPTED" },
        include: { customer: true },
      });
      if (booking) {
        await db.booking.update({
          where: { id: booking.id },
          data: { status: "EN_ROUTE", enRouteAt: new Date() },
        });
        await sendProStatusAck(pro.phone, "OTWAY");
        await notifyCustomerProEnRoute(
          booking.customer.phone,
          pro.name,
          25,
        );
      }
      return NextResponse.json({ ok: true });
    }

    // ── ARRIVED ───────────────────────────────────────────────────
    if (rawMessage === "ARRIVED") {
      const booking = await db.booking.findFirst({
        where: {
          proId: pro.id,
          status: { in: ["EN_ROUTE", "ACCEPTED"] },
        },
        include: { customer: true },
      });
      if (booking) {
        await db.booking.update({
          where: { id: booking.id },
          data: { status: "ARRIVED", arrivedAt: new Date() },
        });
        await sendProStatusAck(pro.phone, "ARRIVED");
        await notifyCustomerProArrived(
          booking.customer.phone,
          pro.name,
        );
      }
      return NextResponse.json({ ok: true });
    }

    // ── DONE ──────────────────────────────────────────────────────
    if (rawMessage === "DONE") {
      const booking = await db.booking.findFirst({
        where: {
          proId: pro.id,
          status: { in: ["ARRIVED", "IN_SERVICE", "EN_ROUTE"] },
        },
        include: { customer: true },
      });
      if (booking) {
        await db.booking.update({
          where: { id: booking.id },
          data: { status: "COMPLETED", completedAt: new Date() },
        });
        await sendProStatusAck(pro.phone, "DONE");
        await notifyCustomerServiceComplete(
          booking.customer.phone,
          booking.id,
          booking.totalAmount,
        );

        // Auto-capture handled by cron job at /api/cron/tick
        // (setTimeout unreliable in serverless environments)
      }
      return NextResponse.json({ ok: true });
    }

    // ── CANCEL ────────────────────────────────────────────────────
    if (rawMessage === "CANCEL") {
      const booking = await db.booking.findFirst({
        where: {
          proId: pro.id,
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
          data: { status: "DISPATCHING", proId: null },
        });
        await db.pro.update({
          where: { id: pro.id },
          data: { availability: "ONLINE", currentBookingId: null },
        });
        await sendProStatusAck(pro.phone, "CANCEL");
        await issueStrike(pro.id, booking.id, strikeReason as never);

        // Attempt re-dispatch
        const { tryNextPro } = await import("@/lib/dispatch");
        await tryNextPro(booking.id);
      }
      return NextResponse.json({ ok: true });
    }

    // ── BALANCE ───────────────────────────────────────────────────
    if (rawMessage === "BALANCE") {
      const pendingEarnings = await db.earning.aggregate({
        where: { proId: pro.id, paid: false },
        _sum: { amount: true },
      });
      const nextFri = format(nextFriday(new Date()), "EEEE do MMMM");
      await sendProBalanceInfo(
        pro.phone,
        pendingEarnings._sum.amount ?? 0,
        nextFri,
      );
      return NextResponse.json({ ok: true });
    }

    // ── SCORE ─────────────────────────────────────────────────────
    if (rawMessage === "SCORE") {
      const { sendMessage } = await import("@/lib/whatsapp");
      const creditRes = await fetch(
        `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/api/pro/credit-score?proId=${pro.id}`,
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
          ? `✅ Advance eligible - up to ₦${data.maxAdvanceAmount.toLocaleString()}\nText ADVANCE [amount] [reason] to apply`
          : `❌ Not yet eligible for advance`;
        await sendMessage(
          pro.phone,
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
          pro.phone,
          `❌ Invalid amount. Minimum advance is ₦5,000.\n\nFormat: ADVANCE [amount] [reason]\nExample: ADVANCE 15000 Need new equipment`,
        );
        return NextResponse.json({ ok: true });
      }
      if (!reason || reason.length < 10) {
        await sendMessage(
          pro.phone,
          `❌ Please include a reason (at least 10 characters).\n\nFormat: ADVANCE [amount] [reason]\nExample: ADVANCE 15000 I need to buy new nail equipment for upcoming bookings`,
        );
        return NextResponse.json({ ok: true });
      }

      // Call advance API
      const advRes = await fetch(
        `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/api/pro/advance`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            proId: pro.id,
            amount: rawAmount,
            reason,
          }),
        },
      );
      const advData = await advRes.json();
      if (advRes.ok) {
        await sendMessage(
          pro.phone,
          `✅ *Advance Request Received*\n\n` +
            `Amount: ₦${rawAmount.toLocaleString()}\nReason: ${reason}\n\n` +
            `Our team will review and respond within 24 hours. Approved funds are disbursed directly to your bank account.\n\n` +
            `Repayment: 30% is deducted from each weekly payout until cleared.`,
        );
      } else {
        await sendMessage(
          pro.phone,
          `❌ ${advData.error ?? "Could not process advance request. Text SCORE to check eligibility."}`,
        );
      }
      return NextResponse.json({ ok: true });
    }

    // ── HELP ──────────────────────────────────────────────────────
    if (rawMessage === "HELP") {
      const { sendMessage } = await import("@/lib/whatsapp");
      await sendMessage(
        pro.phone,
        `📱 *Groomee Commands*\n\n` +
          `*Job management:*\n` +
          `YES - Accept a job offer\n` +
          `NO - Decline a job offer\n` +
          `OTWAY - Mark yourself en route\n` +
          `ARRIVED - Mark yourself arrived\n` +
          `DONE - Mark service complete\n` +
          `CANCEL - Cancel current job\n\n` +
          `*Availability:*\n` +
          `ON - Go online (receive jobs)\n` +
          `OFF - Go offline\n\n` +
          `*Earnings & Growth:*\n` +
          `BALANCE - Check pending earnings\n` +
          `SCORE - View your Groomee credit score\n` +
          `ADVANCE [amt] [reason] - Request salary advance\n\n` +
          `*Support:*\n` +
          `HELP - Show this menu\n\n` +
          `For urgent issues call: ${process.env.ADMIN_SUPPORT_PHONE ?? "07000000000"}`,
      );
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("WhatsApp webhook error:", err);
    return NextResponse.json({ error: "Webhook error" }, { status: 500 });
  }
}
