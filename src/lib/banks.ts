/**
 * Nigerian bank list + account-name resolution via Paystack. The list is
 * cached in memory for a day; if Paystack is unreachable we fall back to a
 * static list of the banks most of our pros use so the form never dead-ends.
 */
import { listBanks, resolveAccount } from "./paystack";

export interface Bank {
  name: string;
  code: string;
}

const FALLBACK_BANKS: Bank[] = [
  { name: "Access Bank", code: "044" },
  { name: "Ecobank Nigeria", code: "050" },
  { name: "Fidelity Bank", code: "070" },
  { name: "First Bank of Nigeria", code: "011" },
  { name: "First City Monument Bank", code: "214" },
  { name: "Guaranty Trust Bank", code: "058" },
  { name: "Keystone Bank", code: "082" },
  { name: "Kuda Bank", code: "50211" },
  { name: "Moniepoint MFB", code: "50515" },
  { name: "OPay Digital Services Limited (OPay)", code: "999992" },
  { name: "PalmPay", code: "999991" },
  { name: "Polaris Bank", code: "076" },
  { name: "Stanbic IBTC Bank", code: "221" },
  { name: "Sterling Bank", code: "232" },
  { name: "Union Bank of Nigeria", code: "032" },
  { name: "United Bank For Africa", code: "033" },
  { name: "Wema Bank", code: "035" },
  { name: "Zenith Bank", code: "057" },
];

const TTL_MS = 24 * 60 * 60 * 1000;
let cache: { at: number; banks: Bank[] } | null = null;

export async function getBanks(): Promise<Bank[]> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.banks;
  try {
    const res = await listBanks();
    const seen = new Set<string>();
    const banks = (res.data ?? [])
      .filter((b) => b.code && b.name && !seen.has(b.code) && seen.add(b.code))
      .map((b) => ({ name: b.name, code: b.code }))
      .sort((a, b) => a.name.localeCompare(b.name));
    if (banks.length > 0) {
      cache = { at: Date.now(), banks };
      return banks;
    }
  } catch (err) {
    console.error("[banks] list failed, using fallback", err);
  }
  return FALLBACK_BANKS;
}

export async function bankNameForCode(code: string): Promise<string | null> {
  const banks = await getBanks();
  return banks.find((b) => b.code === code)?.name ?? null;
}

export type ResolveResult =
  | { ok: true; accountName: string }
  | { ok: false; error: string };

export async function resolveBankAccount(
  accountNumber: string,
  bankCode: string,
): Promise<ResolveResult> {
  if (!/^\d{10}$/.test(accountNumber)) {
    return { ok: false, error: "Account number must be exactly 10 digits." };
  }
  if (!/^\d{3,6}$/.test(bankCode)) {
    return { ok: false, error: "Please choose your bank from the list." };
  }
  try {
    const res = await resolveAccount(accountNumber, bankCode);
    if (res.status && res.data?.account_name) {
      return { ok: true, accountName: res.data.account_name };
    }
    return { ok: false, error: "We couldn't find that account. Please check the number and bank." };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "";
    console.error("[banks] resolve failed", msg);
    return {
      ok: false,
      error: "We couldn't confirm that account. Please check the number and bank, then try again.",
    };
  }
}
