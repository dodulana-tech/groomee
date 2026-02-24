import { db } from './db';
import twilio from 'twilio';

const client = twilio(
  process.env.TWILIO_ACCOUNT_SID!,
  process.env.TWILIO_AUTH_TOKEN!
);

const FROM = `whatsapp:${process.env.TWILIO_WHATSAPP_NUMBER ?? 'whatsapp:+14155238886'}`;

// ─── CORE SEND ────────────────────────────────────────────────────────────────

export async function sendMessage(to: string, message: string, channel: 'whatsapp' | 'sms' = 'whatsapp') {
  const toFormatted = channel === 'whatsapp' ? `whatsapp:${to}` : to;
  const from = channel === 'whatsapp' ? FROM : process.env.TWILIO_PHONE_NUMBER!;

  try {
    const msg = await client.messages.create({
      body: message,
      from,
      to: toFormatted,
    });

    await db.notification.create({
      data: {
        recipient: to,
        channel,
        message,
        status:   'sent',
        metadata: { sid: msg.sid },
        sentAt:   new Date(),
      },
    });

    return { success: true, data: msg };
  } catch (err: any) {
    console.error('Twilio send error:', err.message);
    try {
      await db.notification.create({
        data: { recipient: to, channel, message, status: 'failed', metadata: { error: err.message } },
      });
    } catch {}
    return { success: false, error: err.message };
  }
}

// ─── OTP ─────────────────────────────────────────────────────────────────────

export async function notifyCustomerOtp(phone: string, otp: string) {
  const message = `Your Groomee verification code is: *${otp}*\n\nValid for 10 minutes. Do not share this code.`;
  return sendMessage(phone, message, 'whatsapp');
}

// ─── CUSTOMER NOTIFICATIONS ───────────────────────────────────────────────────

export async function notifyCustomerBookingConfirmed(phone: string, groomerName: string, eta: string) {
  return sendMessage(phone, `✅ Booking confirmed!\n\nYour groomer *${groomerName}* has accepted and will arrive in approximately ${eta}.\n\nYou'll get another message when they're on the way. 💚`);
}

export async function notifyCustomerGroomerEnRoute(phone: string, groomerName: string, etaMins: number) {
  return sendMessage(phone, `🚗 *${groomerName}* is on the way!\n\nEstimated arrival: ~${etaMins} minutes.\n\nPlease be ready to receive them.`);
}

export async function notifyCustomerGroomerArrived(phone: string, groomerName: string) {
  return sendMessage(phone, `📍 Your groomer *${groomerName}* has arrived!\n\nEnjoy your session. 💅`);
}

export async function notifyCustomerServiceComplete(phone: string, bookingRef: string, amount: number) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  return sendMessage(phone, `✨ Service complete!\n\nPlease confirm your service was completed to release payment of ₦${amount.toLocaleString()}.\n\nConfirm here: ${appUrl}/booking/${bookingRef}\n\nPayment auto-releases in 2 hours if not confirmed.`);
}

export async function notifyCustomerNoGroomer(phone: string) {
  return sendMessage(phone, `⚠️ We couldn't find an available groomer for your booking right now.\n\nYou have not been charged. Please try again or contact support.\n\nWe're sorry for the inconvenience!`);
}

export async function notifyCustomerBookingCancelled(phone: string, reason: string) {
  return sendMessage(phone, `❌ Your booking has been cancelled.\n\nReason: ${reason}\n\nAny payment will be refunded within 24–48 hours. Contact support if you need help.`);
}

// ─── GROOMER NOTIFICATIONS ────────────────────────────────────────────────────

export async function sendGroomerJobOffer({
  phone, groomerName, customerArea, serviceName, bookingTime, fee, timeoutMins = 3, profileBrief = '',
}: {
  phone: string; groomerName: string; customerArea: string; serviceName: string;
  bookingTime: string; fee: number; timeoutMins?: number; profileBrief?: string;
}) {
  return sendMessage(phone, `Hi ${groomerName}! 👋 New booking request:\n\n📍 *${customerArea}*\n💅 *${serviceName}*\n🕙 *${bookingTime}*\n💰 *Your fee: ₦${fee.toLocaleString()}*${profileBrief}\n\nReply *YES* to accept or *NO* to decline.\n⏳ You have ${timeoutMins} minutes.`);
}

export async function sendGroomerBookingDetails({
  phone, customerName, address, mapsLink, maskedPhone,
}: {
  phone: string; customerName: string; address: string; mapsLink: string; maskedPhone: string;
}) {
  return sendMessage(phone, `✅ *Booking confirmed!*\n\n👤 Customer: ${customerName}\n📍 Address: ${address}\n🗺️ Maps: ${mapsLink}\n📞 Contact: ${maskedPhone}\n\nCommands:\n• Text *OTWAY* when you leave\n• Text *ARRIVED* when you get there\n• Text *DONE* when finished\n• Text *CANCEL* to cancel (penalty applies)\n• Text *HELP* for admin assistance`);
}

export async function sendGroomerStatusAck(phone: string, status: 'OTWAY' | 'ARRIVED' | 'DONE' | 'CANCEL' | 'ON' | 'OFF') {
  const messages: Record<string, string> = {
    OTWAY:   `🚗 Got it! Customer has been notified you're on the way. Drive safe!`,
    ARRIVED: `📍 Arrival noted! Customer has been notified. Enjoy your session 💚`,
    DONE:    `✨ Great work! Customer has been prompted to confirm. Payment will be processed shortly.`,
    CANCEL:  `❌ Booking cancelled. Admin has been notified and a replacement groomer will be found.`,
    ON:      `✅ You're now *online*! We'll start sending you bookings. Text *OFF* when you want to stop.`,
    OFF:     `⏸️ You're now *offline*. You won't receive new bookings until you text *ON*.`,
  };
  return sendMessage(phone, messages[status] ?? 'Command received.');
}

export async function sendGroomerWelcome(phone: string, groomerName: string) {
  return sendMessage(phone, `🎉 Welcome to Groomee, ${groomerName}!\n\nYour account is now active.\n\n• Text *ON* to go online and receive bookings\n• Text *OFF* to go offline\n• Text *BALANCE* to check your earnings\n• Text *HELP* for admin assistance\n\nText *ON* now to start receiving jobs! 💚`);
}

export async function sendGroomerStrikeNotice(phone: string, strikeCount: number, reason: string) {
  return sendMessage(phone, `⚠️ *Strike Notice*\n\nYou've received a strike (${strikeCount}/3).\nReason: ${reason}\n\n${strikeCount >= 3 ? 'Your account has been suspended pending review. Contact admin.' : 'Please ensure you accept bookings promptly and fulfil all commitments.'}`);
}

export async function sendGroomerBalanceInfo(phone: string, pending: number, nextPayout: string) {
  return sendMessage(phone, `💰 *Your Groomee Balance*\n\nPending earnings: ₦${pending.toLocaleString()}\nNext payout: ${nextPayout}\n\nPayouts are sent every Friday. Contact admin if you have questions.`);
}