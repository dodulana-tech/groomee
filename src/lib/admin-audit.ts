import { db } from "./db";

/**
 * Persist an admin action to ActivityLog. Best-effort — we never want a
 * logging failure to break the underlying mutation, so all errors are
 * swallowed (with a console.error breadcrumb).
 */
export async function logAdminAction({
  adminId,
  action,
  entityType,
  entityId,
  metadata,
}: {
  adminId: string;
  action: string;
  entityType: string;
  entityId: string;
  metadata?: Record<string, unknown>;
}) {
  try {
    await db.activityLog.create({
      data: {
        adminId,
        action,
        entityType,
        entityId,
        metadata: metadata ? (metadata as object) : undefined,
      },
    });
  } catch (err) {
    console.error("[audit] failed to record admin action", { action, entityType, entityId, err });
  }
}

/**
 * Best-effort touch of an admin's lastActiveAt timestamp. Cheap, but only
 * worth running for ADMIN users — non-admin lastActive isn't surfaced
 * anywhere yet.
 *
 * Gated by an in-memory throttle so we don't hit the DB on every request.
 */
const lastTouch = new Map<string, number>();
const TOUCH_THROTTLE_MS = 60_000;

export async function touchAdminActivity(userId: string, role: string | undefined) {
  if (role !== "ADMIN") return;
  const now = Date.now();
  const last = lastTouch.get(userId) ?? 0;
  if (now - last < TOUCH_THROTTLE_MS) return;
  lastTouch.set(userId, now);
  try {
    await db.user.update({
      where: { id: userId },
      data: { lastActiveAt: new Date() },
    });
  } catch (err) {
    console.error("[audit] lastActiveAt touch failed", err);
  }
}

export const ADMIN_CAP = 4;

/**
 * Count current ADMIN users. Used to enforce the team-size cap.
 */
export async function countAdmins(): Promise<number> {
  return db.user.count({ where: { role: "ADMIN" } });
}
