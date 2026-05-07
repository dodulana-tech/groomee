import { db } from './db';

const accountSid = process.env.TWILIO_ACCOUNT_SID!;
const authToken  = process.env.TWILIO_AUTH_TOKEN!;
const fromWA     = `whatsapp:${process.env.TWILIO_WHATSAPP_NUMBER ?? '+14155238886'}`;
const fromSMS    = process.env.TWILIO_PHONE_NUMBER!;

// ─── CORE SEND ────────────────────────────────────────────────────────────────

export async function sendMessage(to: string, message: string, channel: 'whatsapp' | 'sms' = 'whatsapp') {
  const toFormatted = channel === 'whatsapp' ? `whatsapp:${to}` : to;
  const from        = channel === 'whatsapp' ? fromWA : fromSMS;

  try {
    const res = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
      {
        method:  'POST',
        headers: {
          Authorization:  'Basic ' + Buffer.from(`${accountSid}:${authToken}`).toString('base64'),
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({ To: toFormatted, From: from, Body: message }),
      }
    );

    const data = await res.json();
    const success = !!data.sid;

    console.log(`[whatsapp] ${channel} → ${to}: ${success ? 'sent ' + data.sid : 'FAILED ' + JSON.stringify(data)}`);

    await db.notification.create({
      data: {
        recipient: to,
        channel,
        message,
        status:   success ? 'sent' : 'failed',
        metadata: data,
        sentAt:   success ? new Date() : undefined,
      },
    });

    return { success, data };
  } catch (err: any) {
    console.error('[whatsapp] error:', err.message);
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
  const whatsappMsg = `Your Groomee verification code is: *${otp}*\n\nValid for 10 minutes. Do not share this code.`;
  const smsMsg      = `Your Groomee verification code is: ${otp}. Valid for 10 minutes. Do not share this code.`;
  // Send both - SMS guaranteed delivery, WhatsApp for sandbox testers
  await Promise.allSettled([
    sendMessage(phone, whatsappMsg, 'whatsapp'),
    sendMessage(phone, smsMsg, 'sms'),
  ]);
}

// ─── CUSTOMER NOTIFICATIONS ───────────────────────────────────────────────────

export async function notifyCustomerBookingConfirmed(phone: string, proName: string, eta: string) {
  return sendMessage(phone, `✅ Booking confirmed!\n\nYour pro *${proName}* has accepted and will arrive in approximately ${eta}.\n\nYou'll get another message when they're on the way. 💚`);
}

export async function notifyCustomerProEnRoute(phone: string, proName: string, etaMins: number) {
  return sendMessage(phone, `🚗 *${proName}* is on the way!\n\nEstimated arrival: ~${etaMins} minutes.\n\nPlease be ready to receive them.`);
}

export async function notifyCustomerProArrived(phone: string, proName: string) {
  return sendMessage(phone, `📍 Your pro *${proName}* has arrived!\n\nEnjoy your session. 💅🏿`);
}

export async function notifyCustomerServiceComplete(phone: string, bookingRef: string, amount: number) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  return sendMessage(phone, `✨ Service complete!\n\nPlease confirm your service was completed to release payment of ₦${amount.toLocaleString()}.\n\nConfirm here: ${appUrl}/booking/${bookingRef}\n\nPayment auto-releases in 2 hours if not confirmed.`);
}

export async function notifyCustomerNoPro(phone: string) {
  return sendMessage(phone, `⚠️ We couldn't find an available pro for your booking right now.\n\nYou have not been charged. Please try again or contact support.`);
}

export async function notifyCustomerBookingCancelled(phone: string, reason: string) {
  return sendMessage(phone, `❌ Your booking has been cancelled.\n\nReason: ${reason}\n\nAny payment will be refunded within 24–48 hours. Contact support if you need help.`);
}

// ─── PRO NOTIFICATIONS ───────────────────────────────────────────────────────

export async function sendProJobOffer({
  phone, proName, customerArea, serviceName, bookingTime, fee, timeoutMins = 3, profileBrief = '',
}: {
  phone: string; proName: string; customerArea: string; serviceName: string;
  bookingTime: string; fee: number; timeoutMins?: number; profileBrief?: string;
}) {
  return sendMessage(phone, `Hi ${proName}! 👋 New booking request:\n\n📍 *${customerArea}*\n💅🏿 *${serviceName}*\n🕙 *${bookingTime}*\n💰 *Your fee: ₦${fee.toLocaleString()}*${profileBrief}\n\nReply *YES* to accept or *NO* to decline.\n⏳ You have ${timeoutMins} minutes.`);
}

export async function sendProBookingDetails({
  phone, customerName, address, mapsLink, maskedPhone,
}: {
  phone: string; customerName: string; address: string; mapsLink: string; maskedPhone: string;
}) {
  return sendMessage(phone, `✅ *Booking confirmed!*\n\n👤 Customer: ${customerName}\n📍 Address: ${address}\n🗺️ Maps: ${mapsLink}\n📞 Contact: ${maskedPhone}\n\nCommands:\n• Text *OTWAY* when you leave\n• Text *ARRIVED* when you get there\n• Text *DONE* when finished\n• Text *CANCEL* to cancel (penalty applies)\n• Text *HELP* for admin assistance`);
}

export async function sendProStatusAck(phone: string, status: 'OTWAY' | 'ARRIVED' | 'DONE' | 'CANCEL' | 'ON' | 'OFF') {
  const messages: Record<string, string> = {
    OTWAY:   `🚗 Got it! Customer has been notified you're on the way. Drive safe!`,
    ARRIVED: `📍 Arrival noted! Customer has been notified. Enjoy your session 💚`,
    DONE:    `✨ Great work! Customer has been prompted to confirm. Payment will be processed shortly.`,
    CANCEL:  `❌ Booking cancelled. Admin has been notified and a replacement pro will be found.`,
    ON:      `✅ You're now *online*! We'll start sending you bookings. Text *OFF* when you want to stop.`,
    OFF:     `⏸️ You're now *offline*. You won't receive new bookings until you text *ON*.`,
  };
  return sendMessage(phone, messages[status] ?? 'Command received.');
}

export async function sendProWelcome(phone: string, proName: string) {
  return sendMessage(phone, `🎉 Welcome to Groomee, ${proName}!\n\nYour account is now active.\n\n• Text *ON* to go online and receive bookings\n• Text *OFF* to go offline\n• Text *BALANCE* to check your earnings\n• Text *HELP* for admin assistance\n\nText *ON* now to start receiving jobs! 💚`);
}

export async function sendProStrikeNotice(phone: string, strikeCount: number, reason: string) {
  return sendMessage(phone, `⚠️ *Strike Notice*\n\nYou've received a strike (${strikeCount}/3).\nReason: ${reason}\n\n${strikeCount >= 3 ? 'Your account has been suspended pending review. Contact admin.' : 'Please ensure you accept bookings promptly and fulfil all commitments.'}`);
}

export async function sendProBalanceInfo(phone: string, pending: number, nextPayout: string) {
  return sendMessage(phone, `💰 *Your Groomee Balance*\n\nPending earnings: ₦${pending.toLocaleString()}\nNext payout: ${nextPayout}\n\nPayouts are sent every Friday. Contact admin if you have questions.`);
}

// ─── APPRENTICESHIP NOTIFICATIONS ────────────────────────────────────────────

export async function notifyApprenticeInvited(phone: string, masterName: string, acceptUrl: string) {
  return sendMessage(
    phone,
    `🎓 *${masterName}* has invited you to become their apprentice on Groomee.\n\nUnder their wing you'll learn the trade, earn while you learn, and one day graduate to your own independent practice.\n\nReview the offer and accept here:\n${acceptUrl}\n\nIf this wasn't expected, you can safely ignore this message.`,
  );
}

export async function notifyMasterInviteAccepted(masterPhone: string, apprenticeName: string) {
  return sendMessage(
    masterPhone,
    `🎉 *${apprenticeName}* has accepted your apprenticeship invitation!\n\nThey are now in training under you. Track their progress, sign off on curriculum modules, and grow your team from the partner portal:\n\n${process.env.NEXT_PUBLIC_APP_URL ?? "https://groomee.ng"}/partner/team`,
  );
}

export async function notifyMasterInviteDeclined(masterPhone: string, apprenticeName: string) {
  return sendMessage(
    masterPhone,
    `Your apprenticeship invitation to *${apprenticeName}* was declined.\n\nNo stress — you can invite someone else any time from your partner portal.`,
  );
}

export async function notifyApprenticeInviteCancelled(apprenticePhone: string, masterName: string) {
  return sendMessage(
    apprenticePhone,
    `*${masterName}* has cancelled the apprenticeship invitation they sent you.\n\nIf this is unexpected, please reach out to them directly.`,
  );
}

export async function notifyApprenticeModuleCompleted(
  apprenticePhone: string,
  moduleTitle: string,
) {
  return sendMessage(
    apprenticePhone,
    `📘 Your master signed off another module: *${moduleTitle}*.\n\nKeep going — every module brings you closer to independence and Freedom. Track progress in your portal:\n${process.env.NEXT_PUBLIC_APP_URL ?? "https://groomee.ng"}/partner`,
  );
}

export async function notifyApprenticeIndependenceGranted(
  apprenticePhone: string,
  masterName: string,
) {
  return sendMessage(
    apprenticePhone,
    `🎉 Big step: *${masterName}* has approved you to take your own customer bookings on Groomee!\n\nYou'll still split commission with your master until Freedom, but the trust is yours now. Stay sharp out there. 💚`,
  );
}

export async function notifyMasterApprenticeReadyForFreedom(
  masterPhone: string,
  apprenticeName: string,
) {
  return sendMessage(
    masterPhone,
    `🎓 *${apprenticeName}* has met every Freedom requirement — curriculum complete, jobs and ratings on track.\n\nWhen you're ready, bestow Freedom from your partner portal:\n${process.env.NEXT_PUBLIC_APP_URL ?? "https://groomee.ng"}/partner/team`,
  );
}

// ─── FREEDOM CEREMONY ────────────────────────────────────────────────────────

export async function notifyMasterFreedomComplete(
  masterPhone: string,
  apprenticeName: string,
  certCode: string,
  certUrl: string,
) {
  return sendMessage(
    masterPhone,
    `🎓 Freedom complete — *${apprenticeName}* is now an independent pro on Groomee.\n\nYou trained them up. The lineage stays with you forever — their cert reads "Freed under you".\n\nCert: *${certCode}*\nView: ${certUrl}\n\nFrom today, no more master commission on their bookings. But the bond — and the bragging rights — are permanent. 💚`,
  );
}

export async function notifyApprenticeFreedomGranted(
  apprenticePhone: string,
  masterName: string,
  certCode: string,
  certUrl: string,
) {
  return sendMessage(
    apprenticePhone,
    `🎓✨ *FREEDOM!*\n\nYou've done it. *${masterName}* has bestowed your Freedom — you are now a fully independent Groomee pro.\n\nYour Certificate of Freedom is permanent and verifiable:\n🪪 Code: *${certCode}*\n🌐 ${certUrl}\n\nShare it with the world. Print it. Frame it. You earned every line of it.\n\nFrom today: every naira from your bookings is yours alone. Stay sharp. Build your name. We're proud of you. 💚`,
  );
}