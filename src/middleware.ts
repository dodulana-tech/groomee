import { NextResponse, type NextRequest } from "next/server";
import { getSessionFromRequestEdge } from "@/lib/auth-edge";

// Exact-match public paths
const PUBLIC_EXACT = new Set(["/", "/search", "/auth", "/partner/login", "/partner/onboarding"]);
// Prefix-match public paths (these use startsWith)
const PUBLIC_PREFIX = [
  "/pro/",      // /pro/[slug] pages — NOT /profile
  "/groomer/",  // legacy redirect to /pro/[slug]
  "/api/auth",
  "/api/webhooks",
  "/api/services",
  "/api/pros",
  "/api/zones",
  "/api/surveys",
  "/api/waitlist",
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
    return NextResponse.next();
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
    // Redirect partner paths to partner login
    const loginPath = PRO_PATHS.some((p) => pathname.startsWith(p))
      ? "/partner/login"
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
    return NextResponse.redirect(new URL("/", request.url));
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
    "/((?!_next/static|_next/image|favicon\\.ico|favicon\\.png|assets/|apple-touch-icon|manifest\\.json|icons/).*)",
  ],
};
