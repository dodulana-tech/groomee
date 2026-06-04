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

// ─── WALLET NOTIFICATIONS ────────────────────────────────────────────────────
// Posted by booking-lifecycle release helpers (after tx commit) and by
// admin manual adjustments. All amounts are positive NGN figures (caller
// passes the absolute value), the type of movement is communicated in copy.

export async function notifyProMobilizationCredited(
  phone: string,
  amount: number,
  bookingRef: string,
) {
  return sendMessage(
    phone,
    `💵 *Transport money credited*\n\n₦${amount.toLocaleString()} has been released to your wallet for booking *${bookingRef}* so you can mobilize. Safe travels - more comes through once you mark the job DONE. 💚`,
  );
}

export async function notifyProCompletionRelease(
  phone: string,
  amount: number,
  bookingRef: string,
) {
  return sendMessage(
    phone,
    `✨ *Earning released*\n\n₦${amount.toLocaleString()} has been credited to your wallet for booking *${bookingRef}* (job marked done). The final slice unlocks once the customer confirms. 💚`,
  );
}

export async function notifyProConfirmRelease(
  phone: string,
  amount: number,
  bookingRef: string,
) {
  return sendMessage(
    phone,
    `🎉 *Final earning released*\n\n₦${amount.toLocaleString()} is now in your wallet - the customer confirmed booking *${bookingRef}*. Great work. 💚`,
  );
}

export async function notifyProClawback(
  phone: string,
  amount: number,
  reason: string,
) {
  return sendMessage(
    phone,
    `↩️ *Wallet adjustment*\n\n₦${amount.toLocaleString()} has been clawed back from your wallet.\n\nReason: ${reason}\n\nContact admin if you have questions.`,
  );
}

export async function notifyProManualAdjustment(
  phone: string,
  amount: number,
  note: string,
) {
  const sign = amount >= 0 ? "credited to" : "deducted from";
  const abs = Math.abs(amount);
  return sendMessage(
    phone,
    `💼 *Admin adjustment*\n\n₦${abs.toLocaleString()} has been ${sign} your wallet.\n\nNote: ${note}\n\nContact admin if you have questions.`,
  );
}

export async function notifyProPayoutInitiated(phone: string, amount: number) {
  return sendMessage(
    phone,
    `🏦 *Payout on the way*\n\nWe've initiated a payout of ₦${amount.toLocaleString()} to your registered bank. Funds typically arrive within minutes.`,
  );
}

export async function notifyProPayoutReversed(phone: string, amount: number) {
  return sendMessage(
    phone,
    `⚠️ *Payout returned*\n\nYour bank rejected a payout of ₦${amount.toLocaleString()}. The amount has been returned to your wallet. Please update your bank details if they have changed.`,
  );
}

export async function notifyProAdvanceDisbursed(phone: string, amount: number) {
  return sendMessage(
    phone,
    `🤝 *Advance disbursed*\n\nAn advance of ₦${amount.toLocaleString()} has been credited to your wallet. Repayment is automatic - up to 30% of each future payout will be applied until cleared.`,
  );
}

export async function notifyProAdvanceRepayment(
  phone: string,
  amount: number,
  remaining: number,
) {
  return sendMessage(
    phone,
    `📉 *Advance repayment*\n\n₦${amount.toLocaleString()} from your latest payout has been applied to your advance.\n\nRemaining balance owed: ₦${remaining.toLocaleString()}.`,
  );
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
    `Your apprenticeship invitation to *${apprenticeName}* was declined.\n\nNo stress - you can invite someone else any time from your partner portal.`,
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
    `📘 Your master signed off another module: *${moduleTitle}*.\n\nKeep going - every module brings you closer to independence and Freedom. Track progress in your portal:\n${process.env.NEXT_PUBLIC_APP_URL ?? "https://groomee.ng"}/partner`,
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
    `🎓 *${apprenticeName}* has met every Freedom requirement - curriculum complete, jobs and ratings on track.\n\nWhen you're ready, bestow Freedom from your partner portal:\n${process.env.NEXT_PUBLIC_APP_URL ?? "https://groomee.ng"}/partner/team`,
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
    `🎓 Freedom complete - *${apprenticeName}* is now an independent pro on Groomee.\n\nYou trained them up. The lineage stays with you forever - their cert reads "Freed under you".\n\nCert: *${certCode}*\nView: ${certUrl}\n\nFrom today, no more master commission on their bookings. But the bond - and the bragging rights - are permanent. 💚`,
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
    `🎓✨ *FREEDOM!*\n\nYou've done it. *${masterName}* has bestowed your Freedom - you are now a fully independent Groomee pro.\n\nYour Certificate of Freedom is permanent and verifiable:\n🪪 Code: *${certCode}*\n🌐 ${certUrl}\n\nShare it with the world. Print it. Frame it. You earned every line of it.\n\nFrom today: every naira from your bookings is yours alone. Stay sharp. Build your name. We're proud of you. 💚`,
  );
}

// ─── DEPLOYMENT (master → dependent on a live booking) ───────────────────────

export async function notifyApprenticeBookingDeployed({
  apprenticePhone,
  masterName,
  customerName,
  address,
  mapsLink,
  maskedCustomerPhone,
}: {
  apprenticePhone: string;
  masterName: string;
  customerName: string;
  address: string;
  mapsLink: string;
  maskedCustomerPhone: string;
}) {
  return sendMessage(
    apprenticePhone,
    `🎯 *${masterName}* has deployed you on a live booking - same booking, your hands now.\n\n👤 Customer: ${customerName}\n📍 Address: ${address}\n🗺️ Maps: ${mapsLink}\n📞 Contact: ${maskedCustomerPhone}\n\nCommands:\n• Text *OTWAY* when you leave\n• Text *ARRIVED* when you get there\n• Text *DONE* when finished\n• Text *CANCEL* to cancel (penalty applies)\n• Text *HELP* for admin assistance\n\nMake your master proud. 💚`,
  );
}

export async function notifyCustomerBookingDeployed({
  customerPhone,
  masterName,
  apprenticeName,
}: {
  customerPhone: string;
  masterName: string;
  apprenticeName: string;
}) {
  return sendMessage(
    customerPhone,
    `📣 Quick update on your booking:\n\n*${masterName}* has sent her trained pro *${apprenticeName}* - same booking, different hands. ${apprenticeName} is fully trained under ${masterName} and your booking is unchanged.\n\nYou'll get the usual notifications when ${apprenticeName} is on the way and when they arrive. 💚`,
  );
}

export async function notifyApprenticeDeploymentRescinded({
  apprenticePhone,
  masterName,
}: {
  apprenticePhone: string;
  masterName: string;
}) {
  return sendMessage(
    apprenticePhone,
    `↩️ Heads up - *${masterName}* has rescinded the booking deployment they sent you. The booking is back with them.\n\nYou are now back online and free to receive other jobs. No strike, no penalty.`,
  );
}

// ─── BENEFITS / INSURANCE NOTIFICATIONS ──────────────────────────────────────
//
// Pros enrol via admin (and soon self-service). The cron posts a monthly
// BENEFIT_PREMIUM debit; if the wallet can't cover it we cascade
// GRACE → PAUSED → CANCELLED. We never deduct from the savings Reserve.

export async function notifyProBenefitEnrolled(
  phone: string,
  planName: string,
  premium: number,
  nextDebitAt: Date,
) {
  return sendMessage(
    phone,
    `🛡️ *You're enrolled in ${planName}!*\n\nYour cover starts today. Monthly premium ₦${premium.toLocaleString()} will be debited from your Groomee wallet on the 1st of every month.\n\nNext debit: ${nextDebitAt.toDateString()}\n\nInsurance underwritten by Reliance HMO (NHIA) and Leadway (NAICOM). Groomee is not an insurer.`,
  );
}

export async function notifyProBenefitDebitSuccess(
  phone: string,
  planName: string,
  amount: number,
  period: string,
) {
  return sendMessage(
    phone,
    `✅ *Premium paid - ${planName}*\n\n₦${amount.toLocaleString()} debited from your wallet for ${period}. Your cover remains active. Stay safe out there. 💚`,
  );
}

export async function notifyProBenefitInsufficientFunds(
  phone: string,
  planName: string,
  amount: number,
  graceUntil: Date,
) {
  return sendMessage(
    phone,
    `⚠️ *Top up to keep your cover - ${planName}*\n\nWe couldn't debit ₦${amount.toLocaleString()} from your wallet today. Your cover is still active until *${graceUntil.toDateString()}*.\n\nTop up your wallet before then or your cover will pause. We never touch your Reserve savings.`,
  );
}

export async function notifyProBenefitGraceReminder(
  phone: string,
  planName: string,
  amount: number,
  daysLeft: number,
) {
  return sendMessage(
    phone,
    `🛟 *Grace period reminder - ${planName}*\n\n${daysLeft} day${daysLeft === 1 ? "" : "s"} left to top up. We need ₦${amount.toLocaleString()} in your wallet to keep your HMO + accident cover live.\n\nIf the wallet is still short after grace, cover pauses. Your savings Reserve is never touched.`,
  );
}

export async function notifyProBenefitPaused(
  phone: string,
  planName: string,
  daysToReactivate: number,
) {
  return sendMessage(
    phone,
    `⏸️ *Cover paused - ${planName}*\n\nYour grace window has passed and your cover is now paused. You have ${daysToReactivate} days to reactivate by paying back-premiums; after that, re-enrolment needs a fresh 30-day waiting period.`,
  );
}

export async function notifyProBenefitCancelled(phone: string, planName: string) {
  return sendMessage(
    phone,
    `❌ *Cover cancelled - ${planName}*\n\nYour benefit cover has been cancelled. You can re-enrol any time, but a fresh 30-day waiting period applies before cover starts again.`,
  );
}

export async function notifyProBenefitClaimOpened(
  phone: string,
  planName: string,
  externalRef: string | null,
) {
  const refLine = externalRef ? `\n\nClaim ref: *${externalRef}*` : "";
  return sendMessage(
    phone,
    `📝 *Claim logged - ${planName}*\n\nWe've logged a benefit claim on your file.${refLine}\n\nReminder: actual claim processing happens directly with the HMO / insurer. Groomee does not handle medical detail.`,
  );
}

// ─── INVENTORY NOTIFICATIONS ─────────────────────────────────────────────────
//
// Posted after a booking confirm tx commits, bundling every product that
// crossed its low-stock threshold into a single WhatsApp. Throttle is
// enforced on the inventory side via ProInventory.lastAlertSentAt.

export async function notifyProLowStock(
  phone: string,
  alerts: { productName: string; qtyLeft: number; threshold: number }[],
) {
  if (alerts.length === 0) return { success: false, error: "empty alerts" };
  const lines = alerts
    .map(
      (a) =>
        `- ${a.productName}: ${a.qtyLeft} left (threshold ${a.threshold})`,
    )
    .join("\n");
  return sendMessage(
    phone,
    `📦 *Low stock alert*\n\nThese products are running low:\n${lines}\n\nReady for restock? Reach out to admin or update your stock in the app. 💚`,
  );
}

export async function notifyProRestockLogged(
  phone: string,
  productName: string,
  newQty: number,
) {
  return sendMessage(
    phone,
    `📦 *Stock updated*\n\n${productName} is now ${newQty} on hand. Keep up the great work! 💚`,
  );
}

// ─── EARNINGS RESERVE / SAVINGS ──────────────────────────────────────────────
//
// "Earnings Reserve" is the customer-facing brand name. Never say "savings
// account" or "deposit" or "yield" — that would mislead. Match bonus is
// "Groomee loyalty top-up", not "interest".

export async function notifyProSavingsSkim(
  phone: string,
  amount: number,
  reserveBalance: number,
  bookingRef: string,
) {
  return sendMessage(
    phone,
    `🏦 Earnings Reserve update\n\nWe set aside *₦${amount.toLocaleString()}* from booking ${bookingRef} into your Reserve.\n\nReserve balance: *₦${reserveBalance.toLocaleString()}*\n\nYou chose this savings rate. Adjust it any time in the Groomee app. 💚`,
  );
}

export async function notifyProSavingsClawback(
  phone: string,
  amount: number,
  bookingRef: string,
) {
  return sendMessage(
    phone,
    `↩️ Earnings Reserve adjustment\n\nBooking ${bookingRef} was refunded within the clawback window, so we returned *₦${amount.toLocaleString()}* from your Reserve back to your wallet.\n\nNo penalty - this is part of how the Reserve protects you.`,
  );
}

export async function notifyProSavingsWithdrawalRequested(
  phone: string,
  amount: number,
  isInstant: boolean,
  noticeUntil?: Date | null,
) {
  if (isInstant) {
    return sendMessage(
      phone,
      `🏃🏿 Instant Reserve withdrawal received\n\nYou asked to take *₦${amount.toLocaleString()}* now (instant break). We'll process it shortly. The penalty was deducted up front.\n\nNeed a hand? Reply *HELP*.`,
    );
  }
  const noticeStr = noticeUntil
    ? `Eligible on ${noticeUntil.toDateString()}`
    : "Eligible after notice period";
  return sendMessage(
    phone,
    `📥 Reserve withdrawal scheduled\n\nWe got your request to withdraw *₦${amount.toLocaleString()}*.\n\n${noticeStr}.\n\nWhen the notice elapses we'll release the funds plus a Groomee loyalty top-up. 💚`,
  );
}

export async function notifyProSavingsWithdrawalEligible(
  phone: string,
  amount: number,
) {
  return sendMessage(
    phone,
    `✅ Your Reserve withdrawal of *₦${amount.toLocaleString()}* is now eligible\n\nGroomee will pay it out shortly. Watch this number for confirmation. 💚`,
  );
}

export async function notifyProSavingsWithdrawalPaid(
  phone: string,
  amount: number,
  matchBonus: number,
) {
  const bonusLine = matchBonus > 0
    ? `\n🎁 Groomee loyalty top-up: *₦${matchBonus.toLocaleString()}*`
    : "";
  return sendMessage(
    phone,
    `💸 Reserve payout complete\n\nWe sent *₦${amount.toLocaleString()}* to your bank.${bonusLine}\n\nThank you for saving with Groomee. 💚`,
  );
}

export async function notifyProSavingsOptIn(phone: string, rate: number) {
  return sendMessage(
    phone,
    `🏦 You're enrolled in Earnings Reserve\n\nWe'll set aside *${(rate * 100).toFixed(1)}%* of every confirmed booking into your private Reserve.\n\nYou can change the rate, withdraw, or opt out at any time. Reply *RESERVE* to check your balance.`,
  );
}

export async function notifyProSavingsOptOut(phone: string) {
  return sendMessage(
    phone,
    `📭 Earnings Reserve paused\n\nWe've stopped skimming from new bookings. Your existing Reserve balance is safe - you can still withdraw it at any time.\n\nWelcome back whenever you want to start again. 💚`,
  );
}

export async function notifyProSavingsMatchBonus(
  phone: string,
  amount: number,
  note: string,
) {
  return sendMessage(
    phone,
    `🎁 Groomee loyalty top-up\n\n*₦${amount.toLocaleString()}* added to your Earnings Reserve. ${note}\n\nThank you for saving with us. 💚`,
  );
}

export async function notifyProSavingsRateChange(
  phone: string,
  oldRate: number,
  newRate: number,
) {
  return sendMessage(
    phone,
    `🔧 Earnings Reserve rate updated\n\n*${(oldRate * 100).toFixed(1)}%* → *${(newRate * 100).toFixed(1)}%*\n\nFrom your next confirmed booking, we'll set aside the new amount.`,
  );
}

// ─── HEALTH CARE-NOTES PRE-BRIEF ─────────────────────────────────────────────
//
// Hint-only message — PHI never appears in WhatsApp logs. The pro must open
// the app to read the actual condition list.

export async function notifyProCareNotes({
  phone,
  bookingRef,
  briefHint,
}: {
  phone: string;
  bookingRef: string;
  briefHint?: string;
}) {
  const hint = briefHint ? `\n\n${briefHint}` : "";
  return sendMessage(
    phone,
    `⚠️ The customer for booking ${bookingRef} has care notes - please review in the app before arriving.${hint}`,
  );
}