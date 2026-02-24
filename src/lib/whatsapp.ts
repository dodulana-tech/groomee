import { db } from "./db";

const TERMII_API_KEY = process.env.TERMII_API_KEY!;
const TERMII_BASE = "https://api.ng.termii.com/api";
const SENDER_ID = process.env.TERMII_SENDER_ID ?? "Groomee";

// ─── CORE SEND ────────────────────────────────────────────────────────────────

async function sendMessage(
  to: string,
  message: string,
  channel: "whatsapp" | "sms" = "whatsapp",
) {
  const body = {
    api_key: TERMII_API_KEY,
    to,
    from: SENDER_ID,
    sms: message,
    type: "plain",
    channel: channel === "whatsapp" ? "WhatsApp" : "generic",
  };

  try {
    const res = await fetch(`${TERMII_BASE}/sms/send`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();

    // Log notification
    await db.notification.create({
      data: {
        recipient: to,
        channel,
        message,
        status: data.code === "ok" ? "sent" : "failed",
        metadata: data,
        sentAt: data.code === "ok" ? new Date() : undefined,
      },
    });

    return { success: data.code === "ok", data };
  } catch (err) {
    await db.notification.create({
      data: {
        recipient: to,
        channel,
        message,
        status: "failed",
        metadata: { error: String(err) },
      },
    });
    return { success: false, error: err };
  }
}

async function sendOtpSms(phone: string, otp: string) {
  const message = `Your Groomee verification code is: ${otp}. Valid for 10 minutes. Do not share this code.`;

  const accountSid = process.env.TWILIO_ACCOUNT_SID!;
  const authToken = process.env.TWILIO_AUTH_TOKEN!;
  const from = process.env.TWILIO_PHONE_NUMBER!;

  try {
    const res = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
      {
        method: "POST",
        headers: {
          Authorization:
            "Basic " +
            Buffer.from(`${accountSid}:${authToken}`).toString("base64"),
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({ To: phone, From: from, Body: message }),
      },
    );
    const data = await res.json();
    await db.notification.create({
      data: {
        recipient: phone,
        channel: "sms",
        message,
        status: data.sid ? "sent" : "failed",
        metadata: data,
        sentAt: data.sid ? new Date() : undefined,
      },
    });
    return { success: !!data.sid, data };
  } catch (err) {
    await db.notification.create({
      data: {
        recipient: phone,
        channel: "sms",
        message,
        status: "failed",
        metadata: { error: String(err) },
      },
    });
    return { success: false, error: err };
  }
}

// ─── CUSTOMER NOTIFICATIONS ───────────────────────────────────────────────────

export async function notifyCustomerBookingConfirmed(
  phone: string,
  groomerName: string,
  eta: string,
) {
  const msg = `✅ Booking confirmed!\n\nYour groomer *${groomerName}* has accepted and will arrive in approximately ${eta}.\n\nYou'll get another message when they're on the way. 💚`;
  return sendMessage(phone, msg);
}

export async function notifyCustomerGroomerEnRoute(
  phone: string,
  groomerName: string,
  etaMins: number,
) {
  const msg = `🚗 *${groomerName}* is on the way!\n\nEstimated arrival: ~${etaMins} minutes.\n\nPlease be ready to receive them.`;
  return sendMessage(phone, msg);
}

export async function notifyCustomerGroomerArrived(
  phone: string,
  groomerName: string,
) {
  const msg = `📍 Your groomer *${groomerName}* has arrived!\n\nEnjoyyour session. 💅`;
  return sendMessage(phone, msg);
}

export async function notifyCustomerServiceComplete(
  phone: string,
  bookingRef: string,
  amount: number,
) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  const msg = `✨ Service complete!\n\nPlease confirm your service was completed to release payment of ₦${amount.toLocaleString()}.\n\nConfirm here: ${appUrl}/booking/${bookingRef}\n\nPayment auto-releases in 2 hours if not confirmed.`;
  return sendMessage(phone, msg);
}

export async function notifyCustomerNoGroomer(phone: string) {
  const msg = `⚠️ We couldn't find an available groomer for your booking right now.\n\nYou have not been charged. Please try again or contact support.\n\nWe're sorry for the inconvenience!`;
  return sendMessage(phone, msg);
}

export async function notifyCustomerBookingCancelled(
  phone: string,
  reason: string,
) {
  const msg = `❌ Your booking has been cancelled.\n\nReason: ${reason}\n\nAny payment will be refunded within 24–48 hours. Contact support if you need help.`;
  return sendMessage(phone, msg);
}

export async function notifyCustomerOtp(phone: string, otp: string) {
  return sendOtpSms(phone, otp);
}

// ─── GROOMER NOTIFICATIONS (WhatsApp) ────────────────────────────────────────

export async function sendGroomerJobOffer({
  phone,
  groomerName,
  customerArea,
  serviceName,
  bookingTime,
  fee,
  timeoutMins = 3,
  profileBrief = "",
}: {
  phone: string;
  groomerName: string;
  customerArea: string;
  serviceName: string;
  bookingTime: string;
  fee: number;
  timeoutMins?: number;
  profileBrief?: string;
}) {
  const msg = `Hi ${groomerName}! 👋 New booking request:\n\n📍 *${customerArea}*\n💅 *${serviceName}*\n🕙 *${bookingTime}*\n💰 *Your fee: ₦${fee.toLocaleString()}*${profileBrief}\n\nReply *YES* to accept or *NO* to decline.\n⏳ You have ${timeoutMins} minutes.`;
  return sendMessage(phone, msg);
}

export async function sendGroomerBookingDetails({
  phone,
  customerName,
  address,
  mapsLink,
  maskedPhone,
}: {
  phone: string;
  customerName: string;
  address: string;
  mapsLink: string;
  maskedPhone: string;
}) {
  const msg = `✅ *Booking confirmed!*\n\n👤 Customer: ${customerName}\n📍 Address: ${address}\n🗺️ Maps: ${mapsLink}\n📞 Contact: ${maskedPhone}\n\nCommands:\n• Text *OTWAY* when you leave\n• Text *ARRIVED* when you get there\n• Text *DONE* when finished\n• Text *CANCEL* to cancel (penalty applies)\n• Text *HELP* for admin assistance`;
  return sendMessage(phone, msg);
}

export async function sendGroomerStatusAck(
  phone: string,
  status: "OTWAY" | "ARRIVED" | "DONE" | "CANCEL" | "ON" | "OFF",
) {
  const messages: Record<string, string> = {
    OTWAY: `🚗 Got it! Customer has been notified you're on the way. Drive safe!`,
    ARRIVED: `📍 Arrival noted! Customer has been notified. Enjoy your session 💚`,
    DONE: `✨ Great work! Customer has been prompted to confirm. Payment will be processed shortly.`,
    CANCEL: `❌ Booking cancelled. Admin has been notified and a replacement groomer will be found. Note: this cancellation has been logged.`,
    ON: `✅ You're now *online*! We'll start sending you bookings. Text *OFF* when you want to stop.`,
    OFF: `⏸️ You're now *offline*. You won't receive new bookings until you text *ON*.`,
  };
  return sendMessage(phone, messages[status] ?? "Command received.");
}

export async function sendGroomerBalanceInfo(
  phone: string,
  pending: number,
  nextPayout: string,
) {
  const msg = `💰 *Your Groomee Balance*\n\nPending earnings: ₦${pending.toLocaleString()}\nNext payout: ${nextPayout}\n\nPayouts are sent every Friday. Contact admin if you have questions.`;
  return sendMessage(phone, msg);
}

export async function sendGroomerWelcome(phone: string, groomerName: string) {
  const msg = `🎉 Welcome to Groomee, ${groomerName}!\n\nYour account is now active. Here's how to use the platform:\n\n• Text *ON* to go online and receive bookings\n• Text *OFF* to go offline\n• Text *BALANCE* to check your earnings\n• Text *HELP* for admin assistance\n\nText *ON* now to start receiving jobs! 💚`;
  return sendMessage(phone, msg);
}

export async function sendGroomerStrikeNotice(
  phone: string,
  strikeCount: number,
  reason: string,
) {
  const msg = `⚠️ *Strike Notice*\n\nYou've received a strike (${strikeCount}/3).\nReason: ${reason}\n\n${strikeCount >= 3 ? "Your account has been suspended pending review. Contact admin." : "Please ensure you accept bookings promptly and fulfil all commitments."}`;
  return sendMessage(phone, msg);
}

export { sendMessage };
