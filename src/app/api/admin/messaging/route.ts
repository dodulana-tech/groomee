import { NextRequest, NextResponse } from "next/server";
import { getSession, hasPermission, formatPhone } from "@/lib/auth";
import { db } from "@/lib/db";
import { isValidNigerianPhone } from "@/lib/utils";

const SANDBOX = "+14155238886";
const mask = (v?: string) => (v ? `${v.slice(0, 4)}…${v.slice(-3)}` : null);

async function twilio(path: string, init?: RequestInit) {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  if (!sid || !token) return { status: 0, body: { message: "TWILIO_ACCOUNT_SID or TWILIO_AUTH_TOKEN is not set" } };
  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}${path}`, {
    ...init,
    headers: { Authorization: "Basic " + Buffer.from(`${sid}:${token}`).toString("base64"), ...(init?.headers ?? {}) },
  });
  return { status: res.status, body: await res.json().catch(() => ({})) };
}

/** Plain-English reading of Twilio's most common failure codes. */
function explain(code?: number | string | null): string | null {
  const c = Number(code);
  const known: Record<number, string> = {
    20003: "Twilio rejected the account SID / auth token. Copy the current Auth Token from the Twilio console into Render.",
    21211: "The phone number isn't valid.",
    21408: "SMS to this country isn't enabled. In Twilio: Messaging → Settings → Geo permissions → tick Nigeria.",
    21610: "This number has replied STOP to us, so Twilio blocks messages to it.",
    21612: "Twilio can't send from this sender to this number (often an international sender into Nigeria).",
    21614: "The number isn't a mobile number that can receive SMS.",
    63007: "The WhatsApp sender isn't set up on this account. Register a WhatsApp sender in Twilio, then set TWILIO_WHATSAPP_NUMBER.",
    63015: "Twilio's WhatsApp sandbox only delivers to numbers that joined it. Register a real WhatsApp sender.",
    63016: "WhatsApp only allows free text within 24 hours of the customer messaging us. Outside that window an approved template is needed.",
    63003: "WhatsApp couldn't deliver to this number (not on WhatsApp, or unreachable).",
    30003: "Handset unreachable (off or out of coverage).",
    30004: "Message blocked by the recipient or the network (DND).",
    30005: "Unknown number or it no longer exists.",
    30006: "The number can't receive SMS, or the network blocked it.",
    30007: "The network filtered the message as spam. A registered Nigerian sender ID is usually needed.",
    30008: "Unknown delivery error from the network.",
  };
  return known[c] ?? null;
}

// GET: configuration + credential check + recent sends
export async function GET() {
  const session = await getSession();
  if (!hasPermission(session, "settings.view")) {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }
  const wa = process.env.TWILIO_WHATSAPP_NUMBER ?? null;
  const account = await twilio(".json");
  const recent = await db.notification.findMany({
    orderBy: { createdAt: "desc" },
    take: 30,
    select: { id: true, recipient: true, channel: true, status: true, metadata: true, createdAt: true },
  });
  return NextResponse.json({
    success: true,
    data: {
      config: {
        accountSid: mask(process.env.TWILIO_ACCOUNT_SID),
        authToken: process.env.TWILIO_AUTH_TOKEN ? "set" : null,
        whatsappSender: wa ?? `${SANDBOX} (Twilio sandbox, default)`,
        whatsappIsSandbox: !wa || wa.replace(/\s/g, "") === SANDBOX,
        smsSender: process.env.TWILIO_PHONE_NUMBER ?? null,
        smsSenderIsInternational: !!process.env.TWILIO_PHONE_NUMBER && !process.env.TWILIO_PHONE_NUMBER.startsWith("+234"),
      },
      credentials:
        account.status === 200
          ? { ok: true, status: account.body.status, type: account.body.type, name: account.body.friendly_name }
          : { ok: false, httpStatus: account.status, message: account.body.message, hint: explain(account.body.code) },
      recent: recent.map((n) => {
        const m = (n.metadata ?? {}) as Record<string, any>;
        const code = m.error_code ?? m.code ?? null;
        return {
          id: n.id,
          to: n.recipient.replace(/(\+?\d{6})\d+(\d{2})/, "$1…$2"),
          channel: n.channel,
          status: n.status,
          twilioStatus: m.status ?? null,
          code,
          error: m.message ?? m.error_message ?? m.error ?? null,
          hint: explain(code),
          sid: m.sid ?? null,
          at: n.createdAt,
        };
      }),
    },
  });
}

// POST { phone, channel }: send a test and report Twilio's real answer,
// then check the delivery status a few seconds later.
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!hasPermission(session, "settings.manage_ops")) {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }
  const { phone: raw, channel } = await req.json();
  if (!isValidNigerianPhone(raw)) {
    return NextResponse.json({ success: false, error: "Enter a Nigerian phone number." }, { status: 400 });
  }
  const phone = formatPhone(raw);
  const isWa = channel !== "sms";
  const from = isWa ? `whatsapp:${process.env.TWILIO_WHATSAPP_NUMBER ?? SANDBOX}` : process.env.TWILIO_PHONE_NUMBER ?? "";
  const body = new URLSearchParams({
    To: isWa ? `whatsapp:${phone}` : phone,
    From: from,
    Body: "Groomee test message ✅ If you can read this, messages from the platform are reaching you.",
  });
  const sent = await twilio("/Messages.json", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!sent.body.sid) {
    return NextResponse.json({
      success: true,
      data: { accepted: false, httpStatus: sent.status, code: sent.body.code ?? null, message: sent.body.message ?? null, hint: explain(sent.body.code) },
    });
  }
  // Give the network a moment, then read back the delivery status.
  await new Promise((r) => setTimeout(r, 6000));
  const after = await twilio(`/Messages/${sent.body.sid}.json`);
  return NextResponse.json({
    success: true,
    data: {
      accepted: true,
      sid: sent.body.sid,
      status: after.body.status ?? sent.body.status,
      code: after.body.error_code ?? null,
      message: after.body.error_message ?? null,
      hint: explain(after.body.error_code),
    },
  });
}
