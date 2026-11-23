import { NextResponse, type NextRequest } from "next/server";
import { getSessionFromRequestEdge } from "@/lib/auth-edge";
import {
  ATTRIBUTION_MAX_AGE,
  FIRST_TOUCH_COOKIE,
  LAST_TOUCH_COOKIE,
  encodeTouch,
  touchFromRequest,
} from "@/lib/attribution";

// Exact-match public paths
const PUBLIC_EXACT = new Set([
  "/",
  "/search",
  "/auth",
  "/partner/login",
  "/partner/onboarding",
  "/abuja",
  "/api/wa", // tracked WhatsApp CTA redirect
  // Crawlers must reach these without a session.
  "/robots.txt",
  "/sitemap.xml",
  "/opengraph-image",
  "/464cb6d1b7ad2c38abfd2db9e4014216.txt", // IndexNow key file (Bing, which ChatGPT Search runs on)
]);
// Prefix-match public paths (these use startsWith)
const PUBLIC_PREFIX = [
  "/pro/",      // /pro/[slug] pages — NOT /profile
  "/groomer/",  // legacy redirect to /pro/[slug]
  "/api/auth",
  "/admin/login", // admin OTP sign-in (lives outside the admin layout)
  "/api/health",
  "/api/webhooks",
  "/api/payments/verify", // Paystack return; verifies with Paystack itself, works signed out
  "/api/services",
  "/api/pros",
  "/api/zones",
  "/api/cities",
  "/api/surveys",
  "/api/waitlist",
  "/api/cron/", // routes verify CRON_SECRET themselves
  "/cert/",   // public Freedom certificate verification pages
  // SEO landing pages (service x city, areas, price list, FAQ)
  "/lagos",
  "/abuja/",
  "/prices",
  "/faq",
  "/detty-december",
  "/gift",
  "/subscriptions",
  "/become-a-pro",
  "/llms.txt",
  "/favicon.ico",
  "/_next",
];
const ADMIN_PATHS = ["/admin", "/api/admin"];
const PRO_PATHS = ["/partner", "/api/partner"];

// Redirect old groomer URLs to new pro URLs
const REDIRECTS: Record<string, string> = {
  "/admin/groomers": "/admin/pros",
  "/api/admin/groomers": "/api/admin/pros",
  "/api/groomers": "/api/pros",
  "/api/groomer": "/api/pro",
};

// Remember which channel brought the visitor (first touch kept 90 days,
// last touch refreshed) so WhatsApp enquiries can be credited to Google,
// ChatGPT, Instagram, referrals... See lib/attribution.
function recordTouch(request: NextRequest, res: NextResponse) {
  const url = request.nextUrl;
  const touch = touchFromRequest(url, request.headers.get("referer"), url.hostname);
  const hasFirst = request.cookies.has(FIRST_TOUCH_COOKIE);
  if (!touch && hasFirst) return;
  const value = encodeTouch(touch ?? { channel: "direct", detail: "" }, url.pathname);
  const opts = { maxAge: ATTRIBUTION_MAX_AGE, path: "/", sameSite: "lax" as const, secure: url.protocol === "https:", httpOnly: true };
  if (!hasFirst) res.cookies.set(FIRST_TOUCH_COOKIE, value, opts);
  if (touch || !request.cookies.has(LAST_TOUCH_COOKIE)) res.cookies.set(LAST_TOUCH_COOKIE, value, opts);
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Handle legacy URL redirects
  for (const [from, to] of Object.entries(REDIRECTS)) {
    if (pathname.startsWith(from)) {
      const newPath = pathname.replace(from, to);
      return NextResponse.redirect(new URL(newPath, request.url), 301);
    }
  }

  // Allow public paths (exact match or prefix match)
  if (PUBLIC_EXACT.has(pathname) || PUBLIC_PREFIX.some((p) => pathname.startsWith(p))) {
    const res = NextResponse.next();
    if (request.method === "GET" && !pathname.startsWith("/api/")) recordTouch(request, res);
    return res;
  }

  const session = await getSessionFromRequestEdge(request);

  // Require auth for protected paths
  if (!session) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 },
      );
    }
    // Partner and admin paths have their own login pages
    const loginPath = PRO_PATHS.some((p) => pathname.startsWith(p))
      ? "/partner/login"
      : ADMIN_PATHS.some((p) => pathname.startsWith(p))
        ? "/admin/login"
        : "/auth";
    const url = new URL(loginPath, request.url);
    url.searchParams.set("redirect", pathname);
    return NextResponse.redirect(url);
  }

  // Admin-only paths
  if (
    ADMIN_PATHS.some((p) => pathname.startsWith(p)) &&
    session.role !== "ADMIN"
  ) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json(
        { success: false, error: "Forbidden" },
        { status: 403 },
      );
    }
    // Signed in, but not as an admin (e.g. a customer session): send them to
    // the admin login so they can switch accounts instead of bouncing home.
    return NextResponse.redirect(new URL("/admin/login", request.url));
  }

  // Pro/partner-only paths
  if (
    PRO_PATHS.some((p) => pathname.startsWith(p)) &&
    session.role !== "PRO" &&
    session.role !== "ADMIN"
  ) {
    // Apprenticeship invite flow: invitees may still be CUSTOMER role when they
    // arrive at the accept page. The page + API both enforce identity by
    // phone match against the apprenticeship row, so the middleware just
    // needs to require *a* session.
    const isApprenticeInvite =
      pathname.startsWith("/partner/invitation/") ||
      /^\/api\/partner\/apprentices\/[^/]+\/(accept|decline)$/.test(pathname);
    if (!isApprenticeInvite) {
      if (pathname.startsWith("/api/")) {
        return NextResponse.json(
          { success: false, error: "Forbidden" },
          { status: 403 },
        );
      }
      return NextResponse.redirect(new URL("/partner/login", request.url));
    }
  }

  // Attach user info to headers for server components
  const headers = new Headers(request.headers);
  headers.set("x-user-id", session.userId);
  headers.set("x-user-role", session.role);

  return NextResponse.next({ request: { headers } });
}

export const config = {
  matcher: [
    // Static public assets must bypass middleware entirely. The PWA service
    // worker (sw.js, workbox-*.js) was being redirected to /auth, so it
    // never installed and stale chunks kept getting served.
    "/((?!_next/static|_next/image|favicon\\.ico|favicon\\.png|assets/|apple-touch-icon|manifest\\.json|icons/|sw\\.js|workbox-).*)",
  ],
};
