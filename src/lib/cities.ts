/**
 * City lifecycle helpers.
 *
 * Cities drive the landing page (which CTAs render, which waitlists appear)
 * AND gate booking acceptance - non-LIVE cities cannot accept new bookings.
 *
 * The CityStatus enum has three states (HIDDEN / WAITLIST / LIVE) chosen
 * deliberately small. A SOFT_LAUNCH state can be added later - adding states
 * is cheap; introducing one prematurely litters the codebase with branches
 * that mean nothing yet.
 */
import { db } from "@/lib/db";
import type { City, CityStatus } from "@prisma/client";

export type { City, CityStatus };

export const CITY_PERMISSIONS = {
  view: "cities.view",
  manage: "cities.manage",
} as const;

/**
 * All cities, sorted by sortOrder then name. Includes HIDDEN - callers that
 * only want what's visible to customers should use `getPublicCities`.
 */
export async function getAllCities(): Promise<City[]> {
  return db.city.findMany({
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });
}

/**
 * Cities the landing page should know about - LIVE and WAITLIST only.
 * HIDDEN cities never appear in public listings.
 */
export async function getPublicCities(): Promise<City[]> {
  return db.city.findMany({
    where: { status: { in: ["LIVE", "WAITLIST"] } },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });
}

/** Cities currently accepting bookings. */
export async function getLiveCities(): Promise<City[]> {
  return db.city.findMany({
    where: { status: "LIVE" },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });
}

/**
 * Look up the city that owns a given zone. Returns null when the zone has
 * no cityId backfilled (legacy rows) - callers should treat null as
 * "unknown, do not accept bookings" if they care about gating.
 */
export async function getCityForZone(zoneId: string): Promise<City | null> {
  const zone = await db.zone.findUnique({
    where: { id: zoneId },
    include: { cityRel: true },
  });
  return zone?.cityRel ?? null;
}

/**
 * Throws a typed sentinel when the given zone's city is not LIVE. Used by
 * booking-create paths to enforce the city gate. Returns the City on success
 * so callers can read launchedAt / tagline if useful.
 *
 * Why throw rather than return: keeps the booking-create transaction
 * readable. Callers convert to a 409 response.
 */
export class CityNotLiveError extends Error {
  constructor(public readonly city: City | null) {
    super(
      city
        ? `${city.name} isn't accepting bookings yet. Status: ${city.status}.`
        : "This zone doesn't belong to an active service city.",
    );
    this.name = "CityNotLiveError";
  }
}

export async function requireLiveCityForZone(
  zoneId: string | null | undefined,
): Promise<City | null> {
  if (!zoneId) return null;
  const city = await getCityForZone(zoneId);
  if (!city) throw new CityNotLiveError(null);
  if (city.status !== "LIVE") throw new CityNotLiveError(city);
  return city;
}
