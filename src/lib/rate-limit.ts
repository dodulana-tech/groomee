/**
 * In-memory rate limiter for OTP and auth endpoints.
 *
 * NOTE: In serverless (Vercel), each instance has its own memory,
 * so this is a per-instance limit. For production at scale, replace
 * with Redis-backed limiter (@upstash/ratelimit).
 * Even per-instance, this blocks automated attacks from single IPs.
 */

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const store = new Map<string, RateLimitEntry>();

// Clean up stale entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of store) {
    if (entry.resetAt < now) store.delete(key);
  }
}, 5 * 60 * 1000);

export function rateLimit(
  key: string,
  maxAttempts: number,
  windowMs: number,
): { success: boolean; remaining: number; resetIn: number } {
  const now = Date.now();
  const entry = store.get(key);

  if (!entry || entry.resetAt < now) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    return { success: true, remaining: maxAttempts - 1, resetIn: windowMs };
  }

  entry.count++;

  if (entry.count > maxAttempts) {
    return {
      success: false,
      remaining: 0,
      resetIn: entry.resetAt - now,
    };
  }

  return {
    success: true,
    remaining: maxAttempts - entry.count,
    resetIn: entry.resetAt - now,
  };
}

/** 3 OTP sends per phone/email per 15 minutes */
export function checkSendLimit(identifier: string, ip: string): boolean {
  const byId = rateLimit(`otp-send:${identifier}`, 3, 15 * 60 * 1000);
  const byIp = rateLimit(`otp-send-ip:${ip}`, 10, 15 * 60 * 1000);
  return byId.success && byIp.success;
}

/** 5 OTP verify attempts per phone/email per 15 minutes */
export function checkVerifyLimit(identifier: string, ip: string): boolean {
  const byId = rateLimit(`otp-verify:${identifier}`, 5, 15 * 60 * 1000);
  const byIp = rateLimit(`otp-verify-ip:${ip}`, 15, 15 * 60 * 1000);
  return byId.success && byIp.success;
}
