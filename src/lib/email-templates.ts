const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://groomee.ng";

function layout(content: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="color-scheme" content="light" />
  <style>
    body { margin: 0; padding: 0; background: #f7f5f0; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #0a0a0a; -webkit-font-smoothing: antialiased; }
    .wrapper { max-width: 520px; margin: 0 auto; padding: 32px 20px; }
    .card { background: #ffffff; border-radius: 20px; padding: 32px 28px; box-shadow: 0 1px 8px rgba(0,0,0,0.06); }
    .logo { font-size: 22px; font-weight: 900; color: #014342; letter-spacing: -0.5px; text-decoration: none; }
    .logo span { color: #53eb64; }
    .hero-text { font-size: 22px; font-weight: 800; color: #014342; line-height: 1.25; margin: 20px 0 8px; }
    .body-text { font-size: 15px; line-height: 1.65; color: #3c4d3d; margin: 0 0 20px; }
    .cta { display: inline-block; background: #53eb64; color: #0a0a0a; font-size: 14px; font-weight: 700; padding: 14px 28px; border-radius: 12px; text-decoration: none; }
    .detail-row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #f3f4f6; font-size: 14px; }
    .detail-label { color: #7a9a7c; }
    .detail-value { font-weight: 600; color: #0a0a0a; text-align: right; }
    .divider { border: none; border-top: 1px solid #e8f5ea; margin: 24px 0; }
    .footer { text-align: center; padding: 24px 20px 8px; }
    .footer p { font-size: 12px; color: #9CA3AF; line-height: 1.6; margin: 0 0 6px; }
    .footer a { color: #014342; text-decoration: none; font-weight: 600; }
    .install-banner { background: #014342; border-radius: 14px; padding: 20px 24px; text-align: center; margin-top: 24px; }
    .install-banner p { color: rgba(255,255,255,0.7); font-size: 13px; margin: 0 0 12px; line-height: 1.5; }
    .install-banner a { display: inline-block; background: #53eb64; color: #0a0a0a; font-size: 13px; font-weight: 700; padding: 10px 22px; border-radius: 10px; text-decoration: none; }
    .muted { font-size: 13px; color: #9CA3AF; }
    .highlight { background: #e2fce5; color: #014342; font-weight: 700; padding: 2px 8px; border-radius: 6px; }
    @media (prefers-color-scheme: dark) {
      body { background: #0d1b12 !important; }
      .card { background: #1a2e1f !important; }
      .body-text { color: #b4c5b8 !important; }
      .detail-row { border-color: #2a3e2f !important; }
    }
  </style>
</head>
<body>
  <div class="wrapper">
    <div style="text-align: center; margin-bottom: 24px;">
      <a href="${APP_URL}" class="logo">groomee<span>.</span></a>
    </div>
    <div class="card">
      ${content}
    </div>
    <div class="install-banner">
      <p>Get instant access. No app store needed.</p>
      <a href="${APP_URL}/install">Add Groomee to your home screen</a>
    </div>
    <div class="footer">
      <p>
        <a href="${APP_URL}/search">Book a pro</a> &nbsp;&middot;&nbsp;
        <a href="${APP_URL}/bookings">My bookings</a> &nbsp;&middot;&nbsp;
        <a href="${APP_URL}/#about">Our story</a>
      </p>
      <p>Groomee &middot; Beauty at your door, right now.</p>
      <p style="margin-top: 12px;">Lagos, Nigeria &middot; <a href="mailto:hello@groomeeapp.com">hello@groomeeapp.com</a></p>
    </div>
  </div>
</body>
</html>`;
}

// ── OTP ──────────────────────────────────────────────────

export function otpEmail(otp: string): { subject: string; html: string } {
  return {
    subject: `${otp} is your Groomee code`,
    html: layout(`
      <p class="hero-text">Your verification code</p>
      <p class="body-text">Enter this code to sign in. It expires in 10 minutes.</p>
      <div style="text-align: center; margin: 24px 0;">
        <span style="font-family: 'Courier New', monospace; font-size: 36px; font-weight: 900; letter-spacing: 8px; color: #014342;">${otp}</span>
      </div>
      <p class="muted" style="text-align: center;">Didn't request this? Just ignore this email.</p>
    `),
  };
}

// ── BOOKING CREATED ──────────────────────────────────────

export function bookingCreatedEmail(data: {
  customerName: string;
  serviceName: string;
  proName: string | null;
  reference: string;
  total: string;
  isAsap: boolean;
  paymentUrl?: string;
}): { subject: string; html: string } {
  return {
    subject: `Booking confirmed! Your pro is on the way`,
    html: layout(`
      <p class="hero-text">You're booked, ${data.customerName.split(" ")[0]}!</p>
      <p class="body-text">
        ${data.isAsap
          ? "Your beauty pro is being dispatched right now. Sit tight."
          : "Your booking is confirmed. We'll notify you when your pro is ready."}
      </p>
      <table width="100%" cellpadding="0" cellspacing="0" style="margin: 20px 0;">
        <tr><td class="detail-label" style="padding: 10px 0; border-bottom: 1px solid #f3f4f6;">Service</td><td class="detail-value" style="padding: 10px 0; border-bottom: 1px solid #f3f4f6; text-align: right;">${data.serviceName}</td></tr>
        ${data.proName ? `<tr><td class="detail-label" style="padding: 10px 0; border-bottom: 1px solid #f3f4f6;">Pro</td><td class="detail-value" style="padding: 10px 0; border-bottom: 1px solid #f3f4f6; text-align: right;">${data.proName}</td></tr>` : ""}
        <tr><td class="detail-label" style="padding: 10px 0; border-bottom: 1px solid #f3f4f6;">Reference</td><td class="detail-value" style="padding: 10px 0; border-bottom: 1px solid #f3f4f6; text-align: right; font-family: monospace; font-size: 12px;">${data.reference}</td></tr>
        <tr><td class="detail-label" style="padding: 10px 0;">Total</td><td class="detail-value" style="padding: 10px 0; font-size: 18px;">${data.total}</td></tr>
      </table>
      ${data.paymentUrl ? `<div style="text-align: center; margin-top: 8px;"><a href="${data.paymentUrl}" class="cta">Complete payment</a></div>` : ""}
      <p class="muted" style="text-align: center; margin-top: 16px;">All pros are vetted &amp; ID-verified. Payment secured by Paystack.</p>
    `),
  };
}

// ── PAYMENT CONFIRMED ────────────────────────────────────

export function paymentConfirmedEmail(data: {
  customerName: string;
  serviceName: string;
  total: string;
  reference: string;
  bookingUrl: string;
}): { subject: string; html: string } {
  return {
    subject: `Payment received! We're finding your pro`,
    html: layout(`
      <p class="hero-text">Payment received!</p>
      <p class="body-text">
        ${data.total} for ${data.serviceName}. We're matching you with a vetted pro nearby. You'll get a notification the moment they accept.
      </p>
      <div style="text-align: center; margin: 20px 0;">
        <a href="${data.bookingUrl}" class="cta">Track your booking</a>
      </div>
      <p class="muted" style="text-align: center;">Ref: ${data.reference}</p>
    `),
  };
}

// ── BOOKING CANCELLED ────────────────────────────────────

export function bookingCancelledEmail(data: {
  customerName: string;
  serviceName: string;
  reference: string;
  refundAmount: string | null;
}): { subject: string; html: string } {
  return {
    subject: `Booking cancelled - ${data.reference}`,
    html: layout(`
      <p class="hero-text">Booking cancelled</p>
      <p class="body-text">
        Your ${data.serviceName} booking (${data.reference}) has been cancelled.
        ${data.refundAmount ? `A refund of ${data.refundAmount} will hit your account within 24-48 hours.` : "You have not been charged."}
      </p>
      <p class="body-text">
        No stress. When you're ready, we've got 50+ vetted pros standing by.
      </p>
      <div style="text-align: center;">
        <a href="${APP_URL}/search" class="cta">Book again</a>
      </div>
    `),
  };
}

// ── SERVICE CONFIRMED (payment released) ─────────────────

export function serviceConfirmedEmail(data: {
  customerName: string;
  proName: string;
  serviceName: string;
  total: string;
  pointsEarned: number;
  bookingUrl: string;
}): { subject: string; html: string } {
  return {
    subject: `Thanks for using Groomee! You earned ${data.pointsEarned} points`,
    html: layout(`
      <p class="hero-text">Looking good, ${data.customerName.split(" ")[0]}!</p>
      <p class="body-text">
        Your ${data.serviceName} with ${data.proName} is confirmed and complete. Payment of ${data.total} has been released.
      </p>
      ${data.pointsEarned > 0 ? `<p class="body-text"><span class="highlight">+${data.pointsEarned} points</span> added to your balance. 100 points = &#8358;500 off your next booking.</p>` : ""}
      <div style="text-align: center; margin: 20px 0;">
        <a href="${data.bookingUrl}" class="cta">Leave a review</a>
      </div>
      <p class="muted" style="text-align: center;">Reviews help other customers find great pros.</p>
    `),
  };
}

// ── REVIEW THANK YOU ─────────────────────────────────────

export function reviewThankYouEmail(data: {
  customerName: string;
  proName: string;
  rating: number;
  pointsEarned: number;
}): { subject: string; html: string } {
  return {
    subject: `Thanks for the ${"★".repeat(data.rating)} review!`,
    html: layout(`
      <p class="hero-text">Thanks for the feedback!</p>
      <p class="body-text">
        Your ${"★".repeat(data.rating)} review for ${data.proName} helps the community find great pros.
        ${data.pointsEarned > 0 ? `You earned <span class="highlight">+${data.pointsEarned} points</span> for reviewing.` : ""}
      </p>
      <div style="text-align: center; margin: 20px 0;">
        <a href="${APP_URL}/search" class="cta">Book your next glow-up</a>
      </div>
    `),
  };
}

// ── ADMIN INVITE ─────────────────────────────────────────

export function adminInviteEmail(data: {
  inviteeName: string;
  inviterName: string | null;
  roleName: string;
  loginUrl?: string;
}): { subject: string; html: string } {
  const url = data.loginUrl ?? `${APP_URL}/admin/login`;
  const greeting = data.inviteeName ? data.inviteeName.split(" ")[0] : "there";
  return {
    subject: `You've been added to the Groomee admin team`,
    html: layout(`
      <p class="hero-text">Welcome to the team, ${greeting}!</p>
      <p class="body-text">
        ${data.inviterName ? `${data.inviterName} added you` : "You were added"} to the Groomee admin
        team as <span class="highlight">${data.roleName}</span>.
      </p>
      <p class="body-text">
        Sign in with your phone or email to access the admin dashboard. We'll
        send you a one-time code to verify it's really you.
      </p>
      <div style="text-align: center; margin: 24px 0;">
        <a href="${url}" class="cta">Sign in to admin</a>
      </div>
      <p class="muted" style="text-align: center;">
        If you weren't expecting this, please contact ${data.inviterName ?? "the team"} or hello@groomeeapp.com.
      </p>
    `),
  };
}

// ── APPRENTICESHIP INVITATION ────────────────────────────

export function apprenticeInvitationEmail(data: {
  masterName: string;
  acceptUrl: string;
  commissionPct: number;
}): { subject: string; html: string } {
  return {
    subject: `${data.masterName} invited you to apprentice with them on Groomee`,
    html: layout(`
      <p class="hero-text">An invitation from ${data.masterName}</p>
      <p class="body-text">
        ${data.masterName} has invited you to become their apprentice on Groomee. Under their wing you'll learn the craft, earn while you learn, and graduate one day to your own independent practice.
      </p>
      <table width="100%" cellpadding="0" cellspacing="0" style="margin: 20px 0;">
        <tr><td class="detail-label" style="padding: 10px 0; border-bottom: 1px solid #f3f4f6;">Master</td><td class="detail-value" style="padding: 10px 0; border-bottom: 1px solid #f3f4f6; text-align: right;">${data.masterName}</td></tr>
        <tr><td class="detail-label" style="padding: 10px 0;">Master&rsquo;s commission</td><td class="detail-value" style="padding: 10px 0; text-align: right;">${data.commissionPct}% of your earnings</td></tr>
      </table>
      <p class="body-text">
        Tap the button below to review the full terms, then accept or decline. The invitation expires nothing — but the sooner you respond, the sooner you can begin.
      </p>
      <div style="text-align: center; margin: 24px 0;">
        <a href="${data.acceptUrl}" class="cta">Review invitation</a>
      </div>
      <p class="muted" style="text-align: center;">Didn&rsquo;t expect this? You can safely ignore this email.</p>
    `),
  };
}

export function apprenticeInviteAcceptedEmail(data: {
  apprenticeName: string;
}): { subject: string; html: string } {
  return {
    subject: `${data.apprenticeName} has joined your team`,
    html: layout(`
      <p class="hero-text">Your team is growing!</p>
      <p class="body-text">
        <strong>${data.apprenticeName}</strong> has accepted your apprenticeship invitation. They are now in training under you.
      </p>
      <p class="body-text">
        From your partner portal you can track their progress, edit their curriculum, sign off on completed modules, and approve them for independent bookings when the time comes.
      </p>
      <div style="text-align: center; margin: 24px 0;">
        <a href="${APP_URL}/partner/team" class="cta">View your team</a>
      </div>
    `),
  };
}

// ── NO PRO AVAILABLE ─────────────────────────────────────

export function noProEmail(data: {
  customerName: string;
  serviceName: string;
}): { subject: string; html: string } {
  return {
    subject: `We couldn't find a pro this time`,
    html: layout(`
      <p class="hero-text">No pros available right now</p>
      <p class="body-text">
        We couldn't match you with a ${data.serviceName} pro in your area. You have not been charged.
      </p>
      <p class="body-text">
        Our network is growing daily. Try again shortly, or schedule for a later time.
      </p>
      <div style="text-align: center;">
        <a href="${APP_URL}/search" class="cta">Try again</a>
      </div>
    `),
  };
}
