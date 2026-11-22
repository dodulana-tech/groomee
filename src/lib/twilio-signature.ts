import crypto from "crypto";

/**
 * Twilio request validation: base64(HMAC-SHA1(authToken, url + sorted
 * key/value pairs of the POST params)). Twilio signs the exact public URL
 * it posted to; behind Render's proxy the request URL can carry an
 * internal host or scheme, so the public origin is tried as well.
 * Fails closed when the token or signature is missing.
 */
export function isValidTwilioSignature(o: {
  authToken: string | undefined;
  signature: string | null;
  requestUrl: string;
  siteUrl: string;
  params: Record<string, unknown>;
}): boolean {
  if (!o.authToken || !o.signature) return false;
  const u = new URL(o.requestUrl);
  const candidates = Array.from(new Set([o.requestUrl, `${o.siteUrl}${u.pathname}${u.search}`]));
  const sorted = Object.keys(o.params)
    .sort()
    .reduce((acc, key) => acc + key + String(o.params[key]), "");
  const given = Buffer.from(o.signature);
  return candidates.some((url) => {
    const expected = Buffer.from(crypto.createHmac("sha1", o.authToken!).update(url + sorted).digest("base64"));
    return expected.length === given.length && crypto.timingSafeEqual(expected, given);
  });
}
