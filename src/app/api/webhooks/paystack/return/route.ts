/**
 * Paystack checkout return URL (callback_url on new transactions).
 *
 * Same handler as /api/payments/verify, mounted under /api/webhooks so it is
 * reachable without a Groomee session: a customer paying from a WhatsApp pay
 * link usually has never signed in on that browser, and middleware answers
 * 401 on /api/payments/* for anonymous requests. The handler verifies the
 * charge with Paystack server-to-server before touching anything.
 */
export { GET } from "@/app/api/payments/verify/route";
