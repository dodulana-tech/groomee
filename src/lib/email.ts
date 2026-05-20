import nodemailer from "nodemailer";

export async function sendEmail({
  to,
  subject,
  html,
}: {
  to: string;
  subject: string;
  html: string;
}) {
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const host = process.env.SMTP_HOST ?? "smtp.zoho.com";
  const port = parseInt(process.env.SMTP_PORT ?? "465");
  const from = process.env.SMTP_FROM ?? user ?? "noreply@groomee.ng";

  if (!user || !pass) {
    console.warn("[email] SMTP_USER or SMTP_PASS not set — skipping email");
    return null;
  }

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });

  const info = await transporter.sendMail({
    from: `Groomee <${from}>`,
    to,
    subject,
    html,
  });

  console.log(`[email] sent to ${to}: ${info.messageId}`);
  return info;
}
