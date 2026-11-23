/**
 * Acquisition attribution: which channel brought a visitor (Google, ChatGPT,
 * Instagram, a referral link...). Edge-safe (used from middleware).
 *
 * First touch is kept for 90 days and never overwritten; last touch updates
 * on every arrival that carries a signal. The WhatsApp redirect reads both
 * so the Growth page can say where enquiries really come from.
 */
export const FIRST_TOUCH_COOKIE = "gm_ft";
export const LAST_TOUCH_COOKIE = "gm_lt";
export const ATTRIBUTION_MAX_AGE = 90 * 24 * 60 * 60;

export type Channel =
  | "chatgpt" | "perplexity" | "gemini" | "claude" | "copilot"
  | "google" | "bing" | "other-search"
  | "instagram" | "tiktok" | "facebook" | "x" | "whatsapp"
  | "referral" | "email" | "other-site" | "direct";

/** AI assistants are grouped on the Growth page. */
export const AI_CHANNELS: Channel[] = ["chatgpt", "perplexity", "gemini", "claude", "copilot"];

export const CHANNEL_LABEL: Record<Channel, string> = {
  chatgpt: "ChatGPT", perplexity: "Perplexity", gemini: "Gemini", claude: "Claude", copilot: "Copilot",
  google: "Google search", bing: "Bing", "other-search": "Other search",
  instagram: "Instagram", tiktok: "TikTok", facebook: "Facebook", x: "X (Twitter)", whatsapp: "WhatsApp share",
  referral: "Customer referral", email: "Email", "other-site": "Other website", direct: "Direct / typed",
};

// Order matters: specific hosts before broad ones (gemini.google before google).
const HOST_RULES: [RegExp, Channel][] = [
  [/(^|\.)chatgpt\.com$|(^|\.)chat\.openai\.com$|(^|\.)openai\.com$/, "chatgpt"],
  [/(^|\.)perplexity\.ai$/, "perplexity"],
  [/^gemini\.google\.com$|^bard\.google\.com$/, "gemini"],
  [/(^|\.)claude\.ai$/, "claude"],
  [/^copilot\.microsoft\.com$|(^|\.)copilot\.com$/, "copilot"],
  [/(^|\.)google\.[a-z.]+$/, "google"],
  [/(^|\.)bing\.com$/, "bing"],
  [/(^|\.)(duckduckgo\.com|yahoo\.com|yandex\.[a-z]+|ecosia\.org|brave\.com)$/, "other-search"],
  [/(^|\.)instagram\.com$/, "instagram"],
  [/(^|\.)tiktok\.com$/, "tiktok"],
  [/(^|\.)(facebook\.com|fb\.com|fb\.me|messenger\.com)$/, "facebook"],
  [/(^|\.)(t\.co|x\.com|twitter\.com)$/, "x"],
  [/(^|\.)(wa\.me|whatsapp\.com)$/, "whatsapp"],
];

const UTM_RULES: [RegExp, Channel][] = [
  [/chatgpt|openai/, "chatgpt"],
  [/perplexity/, "perplexity"],
  [/gemini|bard/, "gemini"],
  [/claude|anthropic/, "claude"],
  [/copilot/, "copilot"],
  [/^google|^gbp|business\.google|maps/, "google"],
  [/bing/, "bing"],
  [/^ig$|instagram/, "instagram"],
  [/tiktok/, "tiktok"],
  [/^fb$|facebook|meta/, "facebook"],
  [/twitter|^x$/, "x"],
  [/whatsapp|^wa$/, "whatsapp"],
  [/referral|refer|friend/, "referral"],
  [/email|newsletter|zoho/, "email"],
];

export function channelFromUtm(source: string | null): Channel | null {
  if (!source) return null;
  const s = source.toLowerCase().trim();
  for (const [re, ch] of UTM_RULES) if (re.test(s)) return ch;
  return "other-site";
}

export function channelFromReferrer(referrer: string | null, ownHost: string): Channel | null {
  if (!referrer) return null;
  let host: string;
  try {
    host = new URL(referrer).hostname.toLowerCase();
  } catch {
    return null;
  }
  if (host === ownHost || host.endsWith("." + ownHost) || host.endsWith("onrender.com")) return null;
  for (const [re, ch] of HOST_RULES) if (re.test(host)) return ch;
  return "other-site";
}

/** Signal carried by this request, or null when it says nothing new. */
export function touchFromRequest(url: URL, referrer: string | null, ownHost: string): { channel: Channel; detail: string } | null {
  const utm = url.searchParams.get("utm_source");
  const ref = url.searchParams.get("ref");
  if (ref) return { channel: "referral", detail: `ref:${ref.slice(0, 24)}` };
  const fromUtm = channelFromUtm(utm);
  if (fromUtm) {
    const campaign = url.searchParams.get("utm_campaign");
    return { channel: fromUtm, detail: [utm, campaign].filter(Boolean).join("/").slice(0, 60) };
  }
  const fromRef = channelFromReferrer(referrer, ownHost);
  if (fromRef) return { channel: fromRef, detail: (() => { try { return new URL(referrer!).hostname; } catch { return ""; } })() };
  return null;
}

/** Cookie value: "<channel>|<landing path>|<detail>" (short, no PII). */
export function encodeTouch(t: { channel: Channel; detail: string }, landing: string) {
  return [t.channel, landing.slice(0, 80), t.detail].map((v) => v.replace(/\|/g, "")).join("|");
}

export function decodeTouch(v: string | undefined | null): { channel: Channel; landing: string; detail: string } | null {
  if (!v) return null;
  const [channel, landing = "", detail = ""] = decodeURIComponent(v).split("|");
  if (!channel || !(channel in CHANNEL_LABEL)) return null;
  return { channel: channel as Channel, landing, detail };
}
