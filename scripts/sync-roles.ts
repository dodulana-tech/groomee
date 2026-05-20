/**
 * Idempotent role-permission sync.
 *
 * Run on every deploy. Reads DEFAULT_ROLES from src/lib/permissions.ts (the
 * source of truth) and refreshes the `permissions` array on each matching
 * admin_roles row.
 *
 * Why we don't reuse the full seed on deploy:
 *   - seed.ts also creates zones, services, demo pros, etc. — we want NONE
 *     of that running against production.
 *   - Permission changes are additive and safe to re-apply.
 *
 * Custom roles (not in DEFAULT_ROLES) are left untouched.
 */
import { PrismaClient } from "@prisma/client";
import { DEFAULT_ROLES } from "../src/lib/permissions";

const prisma = new PrismaClient();

async function main() {
  console.log("🔑 Syncing admin role permissions…");
  let synced = 0;
  let created = 0;
  for (const role of DEFAULT_ROLES) {
    const existing = await prisma.adminRole.findUnique({
      where: { slug: role.slug },
    });
    if (existing) {
      // Additive-only: union the seeded perms with whatever's already in
      // the DB. We never strip — a permission an op may have been granted
      // out-of-band (e.g. via /admin/team) shouldn't disappear on deploy.
      // Use the seeded `permissions.ts` as a floor, not a ceiling.
      const before = existing.permissions ?? [];
      const seeded = role.permissions;
      const merged = Array.from(new Set([...before, ...seeded]));
      const added = merged.length - before.length;
      if (added > 0) {
        await prisma.adminRole.update({
          where: { slug: role.slug },
          data: { permissions: merged, description: role.description },
        });
        synced++;
        const newOnes = seeded.filter((p) => !before.includes(p));
        console.log(
          `   ✏  ${role.name}: +${added} perm(s) (${newOnes.join(", ")})`,
        );
      }
    } else {
      await prisma.adminRole.create({ data: role });
      created++;
      console.log(`   ➕ ${role.name} created (${role.permissions.length} perms)`);
    }
  }
  console.log(
    `✅ Done — ${synced} role(s) updated, ${created} created, ${
      DEFAULT_ROLES.length - synced - created
    } already in sync.`,
  );
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error("❌ sync-roles failed:", err);
  process.exit(1);
});
