import type { Prisma } from "@prisma/client";
import { db } from "./db";

// ─── INVENTORY (Concept #2) ──────────────────────────────────────────────────
//
// Real implementation of the inventory slice. The booking-confirm hook calls
// `decrementInventoryForBooking` inside its transaction so a failed decrement
// rolls back the confirm. Low-stock alerts are returned to the caller so they
// can be dispatched AFTER the tx commits (preventing alerts being fired when
// the confirm itself rolls back).
//
// Behaviour:
//   - Reads the booking's primary service + BookingItem service ids
//   - For each, looks up ServiceRecipe rows
//   - Find-or-creates ProInventory for the (proId, productId) pair
//   - Decrements ProInventory.qtyOnHand by qtyPerService
//   - Writes an InventoryTxn audit row per decrement (reason=BOOKING_DECREMENT)
//   - If qtyOnHand crosses the threshold (and recipe is not optional and
//     the throttle window has elapsed since the last alert), pushes a
//     LowStockAlert onto the return list
//
// Negative balances are allowed — the pro may not have logged real-world
// restocks. The system warns rather than blocks. Admin can correct via
// ADMIN_ADJUSTMENT.
//
// Idempotent: if a BOOKING_DECREMENT row already exists for this bookingId
// the function bails. The booking-confirm hook is itself race-safe via the
// conditional updateMany, but a retried call (e.g. webhook re-delivery)
// shouldn't double-decrement.

export const INVENTORY_SETTING_KEYS = {
  enabled: "INVENTORY_ENABLED",
  // Canonical key per Concept #2 spec. Legacy key
  // INVENTORY_ALERT_THROTTLE_HOURS still works as a fallback.
  alertCooldownHours: "INVENTORY_LOW_STOCK_ALERT_COOLDOWN_HOURS",
  alertThrottleHoursLegacy: "INVENTORY_ALERT_THROTTLE_HOURS",
  lowStockThresholdDefault: "INVENTORY_LOW_STOCK_THRESHOLD_DEFAULT",
} as const;

export const INVENTORY_DEFAULTS = {
  enabled: true,
  alertThrottleHours: 24,
  lowStockThreshold: 3,
} as const;

export interface LowStockAlert {
  proId: string;
  productId: string;
  productName: string;
  qtyLeft: number;
  threshold: number;
}

type Tx = Prisma.TransactionClient;

// ─── SETTINGS HELPERS ────────────────────────────────────────────────────────

async function readSetting(
  client: Tx | typeof db,
  key: string,
): Promise<string | null> {
  const row = await client.setting.findUnique({ where: { key } });
  return row?.value ?? null;
}

async function inventoryEnabled(client: Tx | typeof db): Promise<boolean> {
  const v = await readSetting(client, INVENTORY_SETTING_KEYS.enabled);
  if (v == null) return INVENTORY_DEFAULTS.enabled;
  return v === "true" || v === "1";
}

async function alertThrottleHours(client: Tx | typeof db): Promise<number> {
  // Prefer canonical key; fall back to legacy throttle key; finally default.
  const canonical = await readSetting(
    client,
    INVENTORY_SETTING_KEYS.alertCooldownHours,
  );
  const legacy = canonical
    ? null
    : await readSetting(client, INVENTORY_SETTING_KEYS.alertThrottleHoursLegacy);
  const v = canonical ?? legacy;
  const n = v ? Number(v) : NaN;
  return Number.isFinite(n) && n >= 0
    ? n
    : INVENTORY_DEFAULTS.alertThrottleHours;
}

async function lowStockThresholdDefault(
  client: Tx | typeof db,
): Promise<number> {
  const v = await readSetting(
    client,
    INVENTORY_SETTING_KEYS.lowStockThresholdDefault,
  );
  const n = v ? Number(v) : NaN;
  return Number.isFinite(n) && n >= 0
    ? n
    : INVENTORY_DEFAULTS.lowStockThreshold;
}

/**
 * Read all inventory config in one round-trip. Used by the settings page and
 * the admin settings save endpoint.
 */
export async function loadInventoryConfig() {
  const [enabled, cooldownHours, thresholdDefault] = await Promise.all([
    inventoryEnabled(db),
    alertThrottleHours(db),
    lowStockThresholdDefault(db),
  ]);
  return { enabled, cooldownHours, thresholdDefault };
}

// ─── BOOKING DECREMENT (called from auto-confirm + confirm route) ────────────

/**
 * Decrement per-pro stock for every recipe row attached to the booking's
 * services. Returns LowStockAlert[] for the caller to dispatch after commit.
 * No-op when INVENTORY_ENABLED is "false", when the booking has no pro, or
 * when none of the services have recipes.
 */
export async function decrementInventoryForBooking(
  bookingId: string,
  tx?: Tx,
): Promise<LowStockAlert[]> {
  const client = (tx ?? db) as Tx;
  if (!(await inventoryEnabled(client))) return [];

  const booking = await client.booking.findUnique({
    where: { id: bookingId },
    select: {
      id: true,
      proId: true,
      serviceId: true,
      items: { select: { serviceId: true } },
    },
  });
  if (!booking || !booking.proId) return [];

  // Idempotency: if we've already decremented for this booking, bail.
  const existing = await client.inventoryTxn.findFirst({
    where: { bookingId, reason: "BOOKING_DECREMENT" },
    select: { id: true },
  });
  if (existing) return [];

  const serviceIds = Array.from(
    new Set<string>(
      [booking.serviceId, ...booking.items.map((i) => i.serviceId)].filter(
        Boolean,
      ),
    ),
  );
  if (serviceIds.length === 0) return [];

  const recipes = await client.serviceRecipe.findMany({
    where: { serviceId: { in: serviceIds } },
    include: {
      product: { select: { id: true, name: true } },
      service: { select: { id: true, name: true } },
    },
  });
  if (recipes.length === 0) return [];

  // Aggregate multiple recipe rows for the same product across this booking
  // into a single decrement so we write one InventoryTxn per product rather
  // than per recipe (cleaner audit trail).
  const byProduct = new Map<
    string,
    { qty: number; productName: string; serviceNames: string[]; anyRequired: boolean }
  >();
  for (const r of recipes) {
    const cur = byProduct.get(r.productId) ?? {
      qty: 0,
      productName: r.product.name,
      serviceNames: [],
      anyRequired: false,
    };
    cur.qty += r.qtyPerService;
    cur.serviceNames.push(r.service.name);
    if (!r.isOptional) cur.anyRequired = true;
    byProduct.set(r.productId, cur);
  }

  const throttleHours = await alertThrottleHours(client);
  const now = new Date();
  const throttleCutoff = new Date(now.getTime() - throttleHours * 3600_000);

  const alerts: LowStockAlert[] = [];

  for (const [productId, agg] of byProduct.entries()) {
    // Find-or-create ProInventory for (proId, productId).
    let inv = await client.proInventory.findUnique({
      where: { proId_productId: { proId: booking.proId, productId } },
    });
    if (!inv) {
      inv = await client.proInventory.create({
        data: {
          proId: booking.proId,
          productId,
          qtyOnHand: 0,
          lowStockThreshold: INVENTORY_DEFAULTS.lowStockThreshold,
        },
      });
    }

    const newQty = inv.qtyOnHand - agg.qty;

    await client.inventoryTxn.create({
      data: {
        proId: booking.proId,
        productId,
        inventoryId: inv.id,
        delta: -agg.qty,
        qtyAfter: newQty,
        reason: "BOOKING_DECREMENT",
        bookingId,
        note: `Consumed by ${agg.serviceNames.join(", ")}`,
      },
    });

    // Decide if we should alert. We alert when:
    //  - new qty has dropped below threshold,
    //  - at least one of the recipe rows for this product is required
    //    (optional recipes never trigger alerts), and
    //  - we have not alerted in the throttle window.
    const shouldAlert =
      newQty < inv.lowStockThreshold &&
      agg.anyRequired &&
      (!inv.lastAlertSentAt || inv.lastAlertSentAt < throttleCutoff);

    await client.proInventory.update({
      where: { id: inv.id },
      data: {
        qtyOnHand: newQty,
        ...(shouldAlert ? { lastAlertSentAt: now } : {}),
      },
    });

    if (shouldAlert) {
      alerts.push({
        proId: booking.proId,
        productId,
        productName: agg.productName,
        qtyLeft: newQty,
        threshold: inv.lowStockThreshold,
      });
    }
  }

  return alerts;
}

// ─── ADMIN OPERATIONS ────────────────────────────────────────────────────────

/**
 * Restock a pro on a single product. Positive delta. Writes an InventoryTxn
 * with reason=RESTOCK, bumps ProInventory.qtyOnHand + lastRestockedAt, and
 * clears lastAlertSentAt so a future drop re-alerts.
 */
export async function restockProduct(opts: {
  proId: string;
  productId: string;
  qty: number;
  note?: string;
  adminId?: string;
}) {
  const { proId, productId, qty, note } = opts;
  if (qty <= 0) throw new Error("Restock qty must be positive");

  return db.$transaction(async (tx) => {
    let inv = await tx.proInventory.findUnique({
      where: { proId_productId: { proId, productId } },
    });
    if (!inv) {
      inv = await tx.proInventory.create({
        data: {
          proId,
          productId,
          qtyOnHand: 0,
          lowStockThreshold: INVENTORY_DEFAULTS.lowStockThreshold,
        },
      });
    }
    const newQty = inv.qtyOnHand + qty;
    const updated = await tx.proInventory.update({
      where: { id: inv.id },
      data: {
        qtyOnHand: newQty,
        lastRestockedAt: new Date(),
        lastAlertSentAt: null,
      },
    });
    const txn = await tx.inventoryTxn.create({
      data: {
        proId,
        productId,
        inventoryId: inv.id,
        delta: qty,
        qtyAfter: newQty,
        reason: "RESTOCK",
        note: note ?? null,
      },
    });
    return { inventory: updated, txn };
  });
}

/**
 * Set the pro's stock to an absolute target value. Writes a signed delta
 * InventoryTxn with the given reason (defaults to ADMIN_ADJUSTMENT) so the
 * audit trail captures the correction.
 */
export async function adjustProductInventory(opts: {
  proId: string;
  productId: string;
  newQty: number;
  reason?: "ADMIN_ADJUSTMENT" | "CORRECTION" | "WASTE";
  note?: string;
  adminId?: string;
}) {
  const { proId, productId, newQty } = opts;
  const reason = opts.reason ?? "ADMIN_ADJUSTMENT";

  return db.$transaction(async (tx) => {
    let inv = await tx.proInventory.findUnique({
      where: { proId_productId: { proId, productId } },
    });
    if (!inv) {
      inv = await tx.proInventory.create({
        data: {
          proId,
          productId,
          qtyOnHand: 0,
          lowStockThreshold: INVENTORY_DEFAULTS.lowStockThreshold,
        },
      });
    }
    const delta = newQty - inv.qtyOnHand;
    const updated = await tx.proInventory.update({
      where: { id: inv.id },
      data: { qtyOnHand: newQty },
    });
    const txn = await tx.inventoryTxn.create({
      data: {
        proId,
        productId,
        inventoryId: inv.id,
        delta,
        qtyAfter: newQty,
        reason,
        note: opts.note ?? null,
      },
    });
    return { inventory: updated, txn };
  });
}

/** Update the low-stock threshold for a (pro, product) pair. */
export async function setLowStockThreshold(opts: {
  proId: string;
  productId: string;
  threshold: number;
  adminId?: string;
}) {
  const { proId, productId, threshold } = opts;
  if (threshold < 0) throw new Error("Threshold must be ≥ 0");
  let inv = await db.proInventory.findUnique({
    where: { proId_productId: { proId, productId } },
  });
  if (!inv) {
    inv = await db.proInventory.create({
      data: { proId, productId, qtyOnHand: 0, lowStockThreshold: threshold },
    });
  } else {
    inv = await db.proInventory.update({
      where: { id: inv.id },
      data: { lowStockThreshold: threshold },
    });
  }
  return inv;
}

// ─── STATS HELPERS ────────────────────────────────────────────────────────────

/**
 * Usage stats for a single product over a recent window. Returns the daily
 * decrement totals and the top consumer pros (by absolute volume consumed).
 */
export async function getProductUsageStats(productId: string, days = 30) {
  const since = new Date(Date.now() - days * 86400_000);

  const txns = await db.inventoryTxn.findMany({
    where: {
      productId,
      reason: "BOOKING_DECREMENT",
      createdAt: { gte: since },
    },
    select: {
      delta: true,
      createdAt: true,
      proId: true,
      pro: { select: { name: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  const dailyMap = new Map<string, number>();
  const perProMap = new Map<string, { proId: string; proName: string; qty: number }>();
  let totalConsumed = 0;
  for (const t of txns) {
    const day = t.createdAt.toISOString().slice(0, 10);
    const consumed = Math.abs(t.delta);
    dailyMap.set(day, (dailyMap.get(day) ?? 0) + consumed);
    totalConsumed += consumed;
    const prev = perProMap.get(t.proId);
    if (prev) {
      prev.qty += consumed;
    } else {
      perProMap.set(t.proId, {
        proId: t.proId,
        proName: t.pro?.name ?? "—",
        qty: consumed,
      });
    }
  }

  const daily = Array.from(dailyMap.entries())
    .map(([day, qty]) => ({ day, qty }))
    .sort((a, b) => a.day.localeCompare(b.day));
  const topPros = Array.from(perProMap.values())
    .sort((a, b) => b.qty - a.qty)
    .slice(0, 10);

  return { totalConsumed, daily, topPros, days, txnCount: txns.length };
}

/**
 * System-wide low-stock list. If proId is provided, scopes to that pro.
 * Returns one row per (pro, product) under threshold, sorted by deficit.
 */
export async function lowStockSummary(proId?: string) {
  const rows = await db.proInventory.findMany({
    where: proId ? { proId } : {},
    include: {
      product: {
        select: { id: true, name: true, slug: true, unit: true, unitCost: true },
      },
      pro: { select: { id: true, name: true, phone: true } },
    },
  });
  return rows
    .filter((r) => r.qtyOnHand < r.lowStockThreshold)
    .map((r) => ({
      proId: r.proId,
      proName: r.pro?.name ?? "—",
      proPhone: r.pro?.phone ?? "",
      productId: r.productId,
      productName: r.product.name,
      productUnit: r.product.unit,
      productUnitCost: r.product.unitCost,
      qtyOnHand: r.qtyOnHand,
      lowStockThreshold: r.lowStockThreshold,
      deficit: r.lowStockThreshold - r.qtyOnHand,
      lastRestockedAt: r.lastRestockedAt,
    }))
    .sort((a, b) => b.deficit - a.deficit);
}

/** Snapshot of one pro's stock across every product they've ever held. */
export async function getProStockSummary(proId: string) {
  const rows = await db.proInventory.findMany({
    where: { proId },
    include: {
      product: {
        select: {
          id: true,
          name: true,
          slug: true,
          category: true,
          unit: true,
          unitCost: true,
        },
      },
      txns: {
        where: { reason: "BOOKING_DECREMENT" },
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { createdAt: true },
      },
    },
    orderBy: [{ qtyOnHand: "asc" }, { updatedAt: "desc" }],
  });
  return rows.map((r) => ({
    id: r.id,
    productId: r.productId,
    productName: r.product.name,
    productSlug: r.product.slug,
    category: r.product.category,
    unit: r.product.unit,
    unitCost: r.product.unitCost,
    qtyOnHand: r.qtyOnHand,
    lowStockThreshold: r.lowStockThreshold,
    isLow: r.qtyOnHand < r.lowStockThreshold,
    lastRestockedAt: r.lastRestockedAt,
    lastDecrementAt: r.txns[0]?.createdAt ?? null,
  }));
}
