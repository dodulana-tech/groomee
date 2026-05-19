/**
 * Helpers for resolving the primary + additional services on a Booking and
 * aggregating them into a single duration / price. Called from the booking
 * create flow, the availability endpoint, and the admin/customer detail
 * surfaces.
 */
import { db } from "@/lib/db";

export interface ResolvedService {
  id: string;
  name: string;
  basePrice: number;
  durationMins: number;
  customPrice: number | null;
}

export interface ResolvedItems {
  primary: ResolvedService;
  additional: ResolvedService[];
  totalDurationMins: number;
  totalBasePrice: number;
}

/**
 * Look up the primary service + any additional services chosen for a booking,
 * applying the requesting pro's customPrice when available. `proId` is
 * optional — when omitted, base prices are used.
 *
 * Throws if any service is missing or inactive, or if `additionalServiceIds`
 * contains the primary id (callers should not dedupe themselves so we catch
 * client mistakes).
 */
export async function resolveBookingServices(opts: {
  primaryServiceId: string;
  additionalServiceIds?: string[];
  proId?: string | null;
}): Promise<ResolvedItems> {
  const additional = (opts.additionalServiceIds ?? []).filter(
    (id) => id && id !== opts.primaryServiceId,
  );
  const allIds = [opts.primaryServiceId, ...additional];
  if (new Set(allIds).size !== allIds.length) {
    throw new Error("Duplicate service ids in booking.");
  }

  const services = await db.service.findMany({
    where: { id: { in: allIds }, isActive: true },
  });
  if (services.length !== allIds.length) {
    throw new Error("One or more services are unavailable.");
  }

  // Look up pro overrides in one query.
  const overrides = opts.proId
    ? await db.proService.findMany({
        where: { proId: opts.proId, serviceId: { in: allIds } },
      })
    : [];
  const overrideMap = new Map(overrides.map((o) => [o.serviceId, o.customPrice]));

  const byId = new Map(
    services.map((s) => [
      s.id,
      {
        id: s.id,
        name: s.name,
        basePrice: s.basePrice,
        durationMins: s.durationMins,
        customPrice: overrideMap.get(s.id) ?? null,
      } satisfies ResolvedService,
    ]),
  );

  const primary = byId.get(opts.primaryServiceId);
  if (!primary) throw new Error("Primary service not found.");

  const additionalResolved = additional.map((id) => {
    const r = byId.get(id);
    if (!r) throw new Error("Additional service missing.");
    return r;
  });

  const priceOf = (s: ResolvedService) => s.customPrice ?? s.basePrice;
  const totalDurationMins =
    primary.durationMins +
    additionalResolved.reduce((acc, s) => acc + s.durationMins, 0);
  const totalBasePrice =
    priceOf(primary) +
    additionalResolved.reduce((acc, s) => acc + priceOf(s), 0);

  return {
    primary,
    additional: additionalResolved,
    totalDurationMins,
    totalBasePrice,
  };
}
