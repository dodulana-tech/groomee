/**
 * Canonical public origin for links, canonical tags, sitemaps and schema.
 *
 * groomee.ng no longer resolves, so it is ignored even if an old
 * NEXT_PUBLIC_APP_URL still points at it — a canonical tag on a dead domain
 * tells Google to drop every page.
 */
const DEAD_HOSTS = ["groomee.ng"];

function resolveSiteUrl(): string {
  const env = process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/+$/, "");
  if (env && !DEAD_HOSTS.some((h) => env.includes(h))) return env;
  return "https://groomeeapp.com";
}

export const SITE_URL = resolveSiteUrl();
export const SITE_HOST = SITE_URL.replace(/^https?:\/\//, "");
