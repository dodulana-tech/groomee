import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST ?? "smtp.zoho.com",
  port: parseInt(process.env.SMTP_PORT ?? "465"),
  secure: true,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

export async function sendEmail({
  to,
  subject,
  html,
}: {
  to: string;
  subject: string;
  html: string;
}) {
  const from = process.env.SMTP_FROM ?? process.env.SMTP_USER ?? "noreply@groomee.ng";

  const info = await transporter.sendMail({
    from: `Groomee <${from}>`,
    to,
    subject,
    html,
  });

  console.log(`[email] sent to ${to}: ${info.messageId}`);
  return info;
}
