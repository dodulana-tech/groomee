/**
 * Fire-and-forget notifications when a city flips to LIVE.
 *
 * Reads the existing Waitlist rows for the city (matched on the legacy
 * Waitlist.city string column — Lagos / Abuja) and pings each one over
 * the cheapest available channel:
 *   - WhatsApp/SMS if the row has a phone
 *   - Email otherwise
 *
 * Never throws. Logs failures but doesn't block the admin response.
 */
import { db } from "@/lib/db";
import { sendMessage } from "@/lib/whatsapp";
import { fireEmail } from "@/lib/email-notify";

export async function notifyCityLive(
  citySlug: string,
  triggeredByUserId: string,
): Promise<void> {
  try {
    const city = await db.city.findUnique({ where: { slug: citySlug } });
    if (!city) return;

    // Waitlist.city is the legacy display-name column. Match by case-
    // insensitive name; we deliberately don't tie this to the new cityId
    // FK because waitlist rows pre-date the migration.
    const rows = await db.waitlist.findMany({
      where: {
        city: { equals: city.name, mode: "insensitive" },
      },
      select: { id: true, phone: true, email: true, name: true },
    });

    if (rows.length === 0) {
      console.log(
        `[city-notify] ${city.name} went LIVE — no waitlist rows to notify`,
      );
      return;
    }

    const appUrl =
      process.env.NEXT_PUBLIC_APP_URL ?? "https://groomee.onrender.com";
    const link = `${appUrl}/?utm_source=launch&utm_city=${city.slug}`;

    let smsSent = 0;
    let emailSent = 0;
    for (const r of rows) {
      const greeting = r.name ? `Hi ${r.name.split(" ")[0]}` : "Hi";
      const msg = `${greeting} 🌿 Great news — Groomee is now live in ${city.name}! Book a vetted beauty pro to your door in 60s: ${link}`;
      if (r.phone) {
        try {
          await sendMessage(r.phone, msg, "whatsapp");
          smsSent++;
        } catch (err) {
          console.error("[city-notify] phone send failed", r.phone, err);
        }
      } else if (r.email) {
        try {
          fireEmail(r.email, {
            subject: `Groomee is live in ${city.name} 🌿`,
            html: `<p>${greeting},</p><p>${city.name} is now live on Groomee. Book a vetted beauty pro to your door in under a minute.</p><p><a href="${link}">Book now →</a></p>`,
          });
          emailSent++;
        } catch (err) {
          console.error("[city-notify] email send failed", r.email, err);
        }
      }
    }
    console.log(
      `[city-notify] ${city.name} LIVE: ${rows.length} waitlist row(s) — ${smsSent} sms, ${emailSent} email (triggered by ${triggeredByUserId})`,
    );
  } catch (err) {
    // Top-level safety net — never let a notify error surface to the caller.
    console.error("[city-notify] fatal", err);
  }
}
