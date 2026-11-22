// Deprecated: middleware limits /api/partner/* to PRO/ADMIN sessions, so
// applicants (CUSTOMER role) could never reach this route and every public
// application failed with 403. The application API now lives at
// /api/applications/pro; this alias stays for any cached client bundles.
export { POST } from "@/app/api/applications/pro/route";
