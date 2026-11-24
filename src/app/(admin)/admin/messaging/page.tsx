"use client";

import { useEffect, useState } from "react";

type Data = {
  config: { accountSid: string | null; authToken: string | null; whatsappSender: string; whatsappIsSandbox: boolean; smsSender: string | null; smsSenderIsInternational: boolean };
  credentials: { ok: boolean; status?: string; type?: string; name?: string; httpStatus?: number; message?: string; hint?: string | null };
  recent: { id: string; to: string; channel: string; status: string; twilioStatus: string | null; code: string | number | null; error: string | null; hint: string | null; at: string }[];
};
type TestResult = { accepted: boolean; status?: string; code?: number | string | null; message?: string | null; hint?: string | null; httpStatus?: number };

function Check({ ok, warn, title, children }: { ok: boolean; warn?: boolean; title: string; children: React.ReactNode }) {
  const tone = ok ? "border-green-200 bg-green-50" : warn ? "border-amber-200 bg-amber-50" : "border-red-200 bg-red-50";
  return (
    <div className={`rounded-2xl border p-4 ${tone}`}>
      <p className="text-sm font-semibold text-gray-900">{ok ? "✅" : warn ? "⚠️" : "❌"} {title}</p>
      <div className="mt-1 text-sm text-gray-700">{children}</div>
    </div>
  );
}

export default function MessagingPage() {
  const [data, setData] = useState<Data | null>(null);
  const [err, setErr] = useState("");
  const [phone, setPhone] = useState("");
  const [testing, setTesting] = useState<"" | "whatsapp" | "sms">("");
  const [result, setResult] = useState<{ channel: string; r: TestResult } | null>(null);

  const load = () =>
    fetch("/api/admin/messaging").then((r) => r.json()).then((d) => (d.success ? setData(d.data) : setErr(d.error ?? "Couldn't load"))).catch(() => setErr("Couldn't load"));
  useEffect(() => { load(); }, []);

  async function test(channel: "whatsapp" | "sms") {
    setTesting(channel); setResult(null);
    try {
      const res = await fetch("/api/admin/messaging", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ phone, channel }) });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error ?? "Test failed");
      setResult({ channel, r: d.data });
      load();
    } catch (e: any) {
      setResult({ channel, r: { accepted: false, message: e.message } });
    } finally { setTesting(""); }
  }

  return (
    <div className="max-w-4xl p-6 lg:p-8">
      <h1 className="text-2xl font-bold text-gray-900">Messaging</h1>
      <p className="mt-1 text-sm text-gray-500">Is the platform able to send WhatsApp and SMS (sign-in codes, booking updates, review requests)? Send yourself a test to find out.</p>
      {err && <p className="mt-4 text-sm text-red-600">{err}</p>}

      {data && (
        <div className="mt-6 grid gap-3 md:grid-cols-3">
          <Check ok={data.credentials.ok} title="Twilio account">
            {data.credentials.ok ? <>Connected ({data.credentials.status}, {data.credentials.type}).</> : <>{data.credentials.hint ?? data.credentials.message}</>}
          </Check>
          <Check ok={!data.config.whatsappIsSandbox} title="WhatsApp sender">
            {data.config.whatsappIsSandbox
              ? <>Using Twilio&apos;s test sandbox ({data.config.whatsappSender}). It only reaches numbers that joined the sandbox, so customers get nothing. A real WhatsApp sender is needed.</>
              : <>Sending from {data.config.whatsappSender}.</>}
          </Check>
          <Check ok={!!data.config.smsSender && !data.config.smsSenderIsInternational} warn={data.config.smsSenderIsInternational} title="SMS sender">
            {!data.config.smsSender ? <>No SMS number set.</> : data.config.smsSenderIsInternational
              ? <>Sending from {data.config.smsSender}, a foreign number. Nigerian networks often block these, and DND lines never get them.</>
              : <>Sending from {data.config.smsSender}.</>}
          </Check>
        </div>
      )}

      <section className="mt-6 rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-gray-900">Send a test</h2>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <input aria-label="Phone number" className="w-56 rounded-lg border border-gray-200 px-3 py-2 text-sm" placeholder="0803 000 0000" value={phone} onChange={(e) => setPhone(e.target.value)} />
          <button disabled={!!testing || !phone} onClick={() => test("whatsapp")} className="rounded-lg bg-[#25D366] px-4 py-2 text-sm font-semibold text-gray-950 disabled:opacity-50">{testing === "whatsapp" ? "Sending…" : "Test WhatsApp"}</button>
          <button disabled={!!testing || !phone} onClick={() => test("sms")} className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{testing === "sms" ? "Sending…" : "Test SMS"}</button>
        </div>
        {result && (
          <div className={`mt-4 rounded-xl p-4 text-sm ${result.r.accepted && !result.r.code ? "bg-green-50 text-green-900" : "bg-red-50 text-red-900"}`}>
            <p className="font-semibold">
              {result.channel === "sms" ? "SMS" : "WhatsApp"}:{" "}
              {result.r.accepted ? `Twilio accepted it. Status after 6 seconds: ${result.r.status}.` : "Twilio refused it."}
            </p>
            {(result.r.code || result.r.message) && <p className="mt-1">Twilio says: {result.r.code ? `[${result.r.code}] ` : ""}{result.r.message}</p>}
            {result.r.hint && <p className="mt-1 font-medium">What to do: {result.r.hint}</p>}
            {result.r.accepted && !result.r.code && <p className="mt-1">If it still doesn&apos;t arrive, check the list below in a minute for the final status.</p>}
          </div>
        )}
      </section>

      {data && (
        <section className="mt-6 rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-gray-900">Recent messages</h2>
          {data.recent.length === 0 ? <p className="mt-3 text-sm text-gray-400">None yet.</p> : (
            <ul className="mt-3 divide-y divide-gray-100 text-sm">
              {data.recent.map((n) => (
                <li key={n.id} className="py-2.5">
                  <div className="flex flex-wrap gap-x-3">
                    <span className="w-32 text-gray-400">{new Date(n.at).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Africa/Lagos" })}</span>
                    <span className="font-medium text-gray-900">{n.channel === "sms" ? "SMS" : "WhatsApp"} → {n.to}</span>
                    <span className={n.status === "sent" ? "text-green-700" : "text-red-600"}>{n.status === "sent" ? `accepted${n.twilioStatus ? ` (${n.twilioStatus})` : ""}` : "failed"}</span>
                  </div>
                  {(n.error || n.code) && <p className="mt-0.5 text-xs text-gray-500">{n.code ? `[${n.code}] ` : ""}{n.error}{n.hint ? ` · ${n.hint}` : ""}</p>}
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}
