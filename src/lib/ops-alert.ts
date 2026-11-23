/**
 * Alert the ops team (ADMIN_PHONES on WhatsApp, ADMIN_EMAILS by email) about
 * something a person must act on. Never throws: an alert failing must not
 * break the flow that raised it.
 */
import { envAdminEmails, envAdminPhones } from "@/lib/admin-bootstrap";
import { sendMessage } from "@/lib/whatsapp";

export async function alertOps(subject: string, message: string, link?: string) {
  const text = `⚠️ *${subject}*\n\n${message}${link ? `\n\n${link}` : ""}`;
  const html = `<p><strong>${escape(subject)}</strong></p><p>${escape(message).replace(/\n/g, "<br>")}</p>${
    link ? `<p><a href="${escape(link)}">${escape(link)}</a></p>` : ""
  }`;
  await Promise.allSettled([
    ...envAdminPhones().map((p) => sendMessage(p, text)),
    ...envAdminEmails().map(async (to) => {
      const { sendEmail } = await import("@/lib/email");
      return sendEmail({ to, subject: `Groomee: ${subject}`, html });
    }),
  ]).then((rs) => rs.forEach((r) => r.status === "rejected" && console.error("[ops-alert] send failed", r.reason)));
}

const escape = (s: string) =>
  s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
