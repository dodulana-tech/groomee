const ZEPTO_URL = "https://api.zeptomail.com/v1.1/email";

export async function sendEmail({
  to,
  subject,
  html,
}: {
  to: string;
  subject: string;
  html: string;
}) {
  const token = process.env.ZEPTO_TOKEN;
  const from = process.env.EMAIL_FROM ?? process.env.SMTP_USER ?? "noreply@groomee.ng";
  const fromName = process.env.EMAIL_FROM_NAME ?? "Groomee";

  if (!token) {
    console.warn("[email] No ZEPTO_TOKEN set — email not sent");
    return null;
  }

  const res = await fetch(ZEPTO_URL, {
    method: "POST",
    headers: {
      Authorization: token,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: { address: from, name: fromName },
      to: [{ email_address: { address: to } }],
      subject,
      htmlbody: html,
    }),
  });

  const data = await res.json();

  if (!res.ok) {
    console.error("[email] ZeptoMail error:", JSON.stringify(data));
    throw new Error(data.message ?? "Email send failed");
  }

  console.log(`[email] sent to ${to} via ZeptoMail`);
  return data;
}
