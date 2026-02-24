import type { PaystackInitResponse, PaystackVerifyResponse } from "@/types";

const PAYSTACK_SECRET = process.env.PAYSTACK_SECRET_KEY!;
const BASE = "https://api.paystack.co";

async function paystackFetch<T>(
  endpoint: string,
  options: RequestInit = {},
): Promise<T> {
  const res = await fetch(`${BASE}${endpoint}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${PAYSTACK_SECRET}`,
      "Content-Type": "application/json",
      ...options.headers,
    },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message ?? `Paystack error ${res.status}`);
  }
  return res.json();
}

// ─── INITIALIZE TRANSACTION ───────────────────────────────────────────────────

export async function initializeTransaction({
  email,
  phone,
  amount, // in kobo (NGN * 100)
  reference,
  callbackUrl,
  metadata,
}: {
  email: string;
  phone: string;
  amount: number;
  reference: string;
  callbackUrl: string;
  metadata?: Record<string, unknown>;
}): Promise<PaystackInitResponse["data"]> {
  const res = await paystackFetch<PaystackInitResponse>(
    "/transaction/initialize",
    {
      method: "POST",
      body: JSON.stringify({
        email: email || `${phone.replace(/\+/g, "")}@groomee.ng`,
        amount: Math.round(amount * 100), // kobo
        reference,
        callback_url: callbackUrl,
        metadata: { ...metadata, phone },
      }),
    },
  );
  return res.data;
}

// ─── VERIFY TRANSACTION ───────────────────────────────────────────────────────

export async function verifyTransaction(
  reference: string,
): Promise<PaystackVerifyResponse["data"]> {
  const res = await paystackFetch<PaystackVerifyResponse>(
    `/transaction/verify/${reference}`,
  );
  return res.data;
}

// ─── CHARGE AUTHORIZATION (capture held payment) ──────────────────────────────

export async function chargeAuthorization({
  authorizationCode,
  email,
  amount,
  reference,
  metadata,
}: {
  authorizationCode: string;
  email: string;
  amount: number;
  reference: string;
  metadata?: Record<string, unknown>;
}) {
  return paystackFetch("/transaction/charge_authorization", {
    method: "POST",
    body: JSON.stringify({
      authorization_code: authorizationCode,
      email,
      amount: Math.round(amount * 100),
      reference,
      metadata,
    }),
  });
}

// ─── REFUND ───────────────────────────────────────────────────────────────────

export async function createRefund({
  transaction,
  amount,
  reason,
}: {
  transaction: string; // Paystack transaction reference
  amount?: number; // partial refund amount in NGN; if undefined, full refund
  reason?: string;
}) {
  return paystackFetch("/refund", {
    method: "POST",
    body: JSON.stringify({
      transaction,
      amount: amount ? Math.round(amount * 100) : undefined,
      merchant_note: reason ?? "Refund by Groomee",
    }),
  });
}

// ─── TRANSFER (groomer payouts) ───────────────────────────────────────────────

export async function createTransferRecipient({
  accountName,
  accountNumber,
  bankCode,
}: {
  accountName: string;
  accountNumber: string;
  bankCode: string;
}): Promise<string> {
  const res = await paystackFetch<{
    status: boolean;
    data: { recipient_code: string };
  }>("/transferrecipient", {
    method: "POST",
    body: JSON.stringify({
      type: "nuban",
      name: accountName,
      account_number: accountNumber,
      bank_code: bankCode,
      currency: "NGN",
    }),
  });
  return res.data.recipient_code;
}

export async function initiateTransfer({
  amount,
  recipientCode,
  reason,
  reference,
}: {
  amount: number;
  recipientCode: string;
  reason: string;
  reference: string;
}) {
  return paystackFetch("/transfer", {
    method: "POST",
    body: JSON.stringify({
      source: "balance",
      amount: Math.round(amount * 100),
      recipient: recipientCode,
      reason,
      reference,
    }),
  });
}

// ─── RESOLVE ACCOUNT ──────────────────────────────────────────────────────────

export async function resolveAccount(accountNumber: string, bankCode: string) {
  return paystackFetch<{
    status: boolean;
    data: { account_name: string; account_number: string };
  }>(`/bank/resolve?account_number=${accountNumber}&bank_code=${bankCode}`);
}

// ─── LIST BANKS ───────────────────────────────────────────────────────────────

export async function listBanks() {
  return paystackFetch<{
    status: boolean;
    data: Array<{ name: string; code: string }>;
  }>("/bank?country=nigeria");
}

// ─── WEBHOOK VALIDATION ───────────────────────────────────────────────────────

import crypto from "crypto";

export function validateWebhookSignature(
  body: string,
  signature: string,
): boolean {
  const hash = crypto
    .createHmac("sha512", process.env.PAYSTACK_WEBHOOK_SECRET!)
    .update(body)
    .digest("hex");
  return hash === signature;
}

// ─── BOOKING REFERENCE ────────────────────────────────────────────────────────

export function generateBookingReference(): string {
  const year = new Date().getFullYear();
  const rand = Math.floor(10000 + Math.random() * 90000);
  return `GRM-${year}-${rand}`;
}

export function generatePaymentReference(bookingRef: string): string {
  return `PAY-${bookingRef}-${Date.now()}`;
}
