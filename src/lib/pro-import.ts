/**
 * Bulk import of beauty professionals the team already works with (by phone
 * / WhatsApp). Built for a non-technical ops person: paste rows from a
 * spreadsheet or upload a CSV, preview per-row problems, then confirm.
 *
 * Rules:
 *  - phone is the identity: normalised to +234…, never two Pro rows per phone
 *  - an existing User with that phone is linked, not duplicated
 *  - existing Pros are skipped or updated (merge), never re-created
 *  - every created row gets applicationSource = "imported"
 */
import type { ServiceCategory } from "@prisma/client";
import { db } from "./db";
import { formatPhone } from "./auth";
import { isValidNigerianPhone } from "./utils";
import { sendMessage } from "./whatsapp";
import { logAdminAction } from "./admin-audit";
import { APP_URL, CATEGORY_LABEL } from "./pro-onboarding";

export const IMPORT_SOURCE = "imported";
export const MAX_IMPORT_ROWS = 300;

export const IMPORT_COLUMNS = ["name", "phone", "city", "areas", "services", "instagram", "note"] as const;

export const IMPORT_TEMPLATE_CSV =
  [
    IMPORT_COLUMNS.join(","),
    `Amaka Obi,0803 123 4567,Abuja,"Wuse; Maitama","Hair; Lashes",@amakabraids,Does knotless braids for our Maitama regulars`,
    `Tunde Bello,08091234567,Lagos,"Lekki Phase 1; Victoria Island",Barbing,,Weekend availability only`,
    `Ngozi Eze,+2348123456789,Lagos,Yaba,"Gel polish; Nails",@nailsbyngozi,`,
  ].join("\n") + "\n";

// ─── Parsing ─────────────────────────────────────────────────────────────────

/** Minimal CSV/TSV parser with quote support. Tabs win when present (spreadsheet paste). */
export function parseTable(text: string): string[][] {
  const clean = text.replace(/^﻿/, "").replace(/\r\n?/g, "\n");
  const firstLine = clean.split("\n", 1)[0] ?? "";
  const delim = firstLine.includes("\t") ? "\t" : firstLine.includes(";") && !firstLine.includes(",") ? ";" : ",";
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;
  for (let i = 0; i < clean.length; i++) {
    const ch = clean[i];
    if (inQuotes) {
      if (ch === '"') {
        if (clean[i + 1] === '"') {
          cell += '"';
          i++;
        } else inQuotes = false;
      } else cell += ch;
    } else if (ch === '"' && cell === "") inQuotes = true;
    else if (ch === delim) {
      row.push(cell.trim());
      cell = "";
    } else if (ch === "\n") {
      row.push(cell.trim());
      rows.push(row);
      row = [];
      cell = "";
    } else cell += ch;
  }
  if (cell !== "" || row.length > 0) {
    row.push(cell.trim());
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c !== ""));
}

const HEADER_ALIASES: Record<string, (typeof IMPORT_COLUMNS)[number]> = {
  name: "name",
  "full name": "name",
  "pro name": "name",
  phone: "phone",
  "phone number": "phone",
  whatsapp: "phone",
  "whatsapp number": "phone",
  number: "phone",
  city: "city",
  areas: "areas",
  area: "areas",
  zones: "areas",
  zone: "areas",
  services: "services",
  service: "services",
  categories: "services",
  category: "services",
  instagram: "instagram",
  ig: "instagram",
  "instagram handle": "instagram",
  note: "note",
  notes: "note",
  comment: "note",
};

export interface RawImportRow {
  line: number;
  name: string;
  phone: string;
  city: string;
  areas: string;
  services: string;
  instagram: string;
  note: string;
}

export function toRawRows(text: string): { rows: RawImportRow[]; error?: string } {
  const table = parseTable(text);
  if (table.length === 0) return { rows: [], error: "Nothing to import. Paste some rows or upload a CSV." };
  const header = table[0].map((h) => HEADER_ALIASES[h.toLowerCase().trim()]);
  const hasHeader = header.includes("name") && header.includes("phone");
  const cols = hasHeader ? header : [...IMPORT_COLUMNS];
  const body = hasHeader ? table.slice(1) : table;
  if (body.length > MAX_IMPORT_ROWS) {
    return { rows: [], error: `That's ${body.length} rows. Please import at most ${MAX_IMPORT_ROWS} at a time.` };
  }
  const rows = body.map((cells, i) => {
    const r: RawImportRow = { line: i + (hasHeader ? 2 : 1), name: "", phone: "", city: "", areas: "", services: "", instagram: "", note: "" };
    cells.forEach((v, idx) => {
      const key = cols[idx];
      if (key) r[key] = v;
    });
    return r;
  });
  return { rows };
}

/** formatPhone, plus the leading zero Excel strips from 0803… numbers. */
export function normaliseImportPhone(raw: string): string | null {
  let digits = raw.replace(/\D/g, "");
  if (/^[789]\d{9}$/.test(digits)) digits = "0" + digits;
  if (!isValidNigerianPhone(digits)) return null;
  return formatPhone(digits);
}

function splitList(v: string): string[] {
  return v
    .split(/[;|,/]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function normInstagram(v: string): string | null {
  const t = v.trim();
  if (!t) return null;
  if (/^https?:\/\//i.test(t)) return t.slice(0, 200);
  const handle = t.replace(/^@/, "").replace(/[^A-Za-z0-9._]/g, "");
  return handle ? `@${handle}` : null;
}

// ─── Validation / preview ────────────────────────────────────────────────────

export type DuplicateMode = "skip" | "update";

export interface PreviewRow {
  line: number;
  name: string;
  phone: string | null;
  rawPhone: string;
  city: string | null;
  zones: { id: string; name: string }[];
  serviceIds: string[];
  serviceLabels: string[];
  instagram: string | null;
  note: string | null;
  action: "create" | "update" | "skip" | "error";
  errors: string[];
  warnings: string[];
  existingProId?: string;
  existingProStatus?: string;
  existingUserId?: string;
}

export async function buildPreview(raw: RawImportRow[], duplicates: DuplicateMode): Promise<PreviewRow[]> {
  const [cities, zones, services] = await Promise.all([
    db.city.findMany({ select: { id: true, name: true, slug: true } }),
    db.zone.findMany({ select: { id: true, name: true, slug: true, cityId: true, city: true } }),
    db.service.findMany({ where: { isActive: true }, select: { id: true, name: true, category: true } }),
  ]);

  const phones = raw.map((r) => normaliseImportPhone(r.phone)).filter((p): p is string => !!p);
  const [pros, users] = await Promise.all([
    db.pro.findMany({ where: { phone: { in: phones } }, select: { id: true, phone: true, status: true, name: true } }),
    db.user.findMany({ where: { phone: { in: phones } }, select: { id: true, phone: true } }),
  ]);
  const proByPhone = new Map(pros.map((p) => [p.phone, p]));
  const userByPhone = new Map(users.map((u) => [u.phone!, u]));
  const seen = new Map<string, number>();

  const catByToken = new Map<string, ServiceCategory>();
  for (const [cat, label] of Object.entries(CATEGORY_LABEL)) {
    catByToken.set(cat.toLowerCase(), cat as ServiceCategory);
    catByToken.set(label.toLowerCase(), cat as ServiceCategory);
  }
  catByToken.set("hair", "HAIR");
  catByToken.set("braids", "HAIR");
  catByToken.set("barber", "BARBING");
  catByToken.set("lash", "LASHES");
  catByToken.set("nail", "NAILS");
  catByToken.set("skin", "SKINCARE");

  return raw.map((r) => {
    const errors: string[] = [];
    const warnings: string[] = [];
    const name = r.name.trim();
    if (name.length < 2) errors.push("Name is missing.");

    const phone = normaliseImportPhone(r.phone);
    if (!r.phone.trim()) errors.push("Phone is missing.");
    else if (!phone) errors.push(`“${r.phone}” isn't a valid Nigerian phone number.`);

    // City (optional) narrows zone matching.
    let city: (typeof cities)[number] | null = null;
    if (r.city.trim()) {
      const c = r.city.trim().toLowerCase();
      city = cities.find((x) => x.name.toLowerCase() === c || x.slug === c) ?? null;
      if (!city) errors.push(`Unknown city “${r.city}”.`);
    }

    const zoneMatches: { id: string; name: string }[] = [];
    const areaTokens = splitList(r.areas);
    if (areaTokens.length === 0) errors.push("Add at least one area (zone).");
    for (const t of areaTokens) {
      const key = t.toLowerCase();
      const candidates = zones.filter(
        (z) => (z.name.toLowerCase() === key || z.slug === key.replace(/\s+/g, "-")) && (!city || z.cityId === city.id),
      );
      if (candidates.length === 1) {
        if (!zoneMatches.some((m) => m.id === candidates[0].id)) zoneMatches.push({ id: candidates[0].id, name: candidates[0].name });
      } else if (candidates.length > 1) errors.push(`Area “${t}” exists in more than one city. Fill in the city column.`);
      else errors.push(`Unknown area “${t}”${city ? ` in ${city.name}` : ""}.`);
    }
    if (!city && zoneMatches.length > 0) {
      const z = zones.find((x) => x.id === zoneMatches[0].id);
      city = cities.find((c) => c.id === z?.cityId) ?? null;
    }

    const serviceIds = new Set<string>();
    const serviceLabels: string[] = [];
    const svcTokens = splitList(r.services);
    if (svcTokens.length === 0) errors.push("Add at least one service or category.");
    for (const t of svcTokens) {
      const key = t.toLowerCase();
      const cat = catByToken.get(key) ?? catByToken.get(key.replace(/s$/, ""));
      if (cat) {
        const inCat = services.filter((s) => s.category === cat);
        if (inCat.length === 0) errors.push(`No active services in “${t}”.`);
        inCat.forEach((s) => serviceIds.add(s.id));
        serviceLabels.push(CATEGORY_LABEL[cat] ?? cat);
        continue;
      }
      const svc = services.find((s) => s.name.toLowerCase() === key);
      if (svc) {
        serviceIds.add(svc.id);
        serviceLabels.push(svc.name);
      } else errors.push(`Unknown service “${t}”.`);
    }

    let action: PreviewRow["action"] = "create";
    const existingPro = phone ? proByPhone.get(phone) : undefined;
    const existingUser = phone ? userByPhone.get(phone) : undefined;
    if (phone) {
      const prev = seen.get(phone);
      if (prev) errors.push(`Same phone as line ${prev} in this file.`);
      else seen.set(phone, r.line);
    }
    if (errors.length > 0) action = "error";
    else if (existingPro) {
      action = duplicates === "update" ? "update" : "skip";
      warnings.push(
        `Already on Groomee as “${existingPro.name}” (${existingPro.status}). ${
          duplicates === "update" ? "New areas and services will be added; status is unchanged." : "Will be skipped."
        }`,
      );
    } else if (existingUser) {
      warnings.push("Has a Groomee customer account with this phone. It will be linked, not duplicated.");
    }

    return {
      line: r.line,
      name,
      phone,
      rawPhone: r.phone,
      city: city?.name ?? null,
      zones: zoneMatches,
      serviceIds: [...serviceIds],
      serviceLabels,
      instagram: normInstagram(r.instagram),
      note: r.note.trim() ? r.note.trim().slice(0, 1000) : null,
      action,
      errors,
      warnings,
      existingProId: existingPro?.id,
      existingProStatus: existingPro?.status,
      existingUserId: existingUser?.id,
    };
  });
}

// ─── Commit ──────────────────────────────────────────────────────────────────

export type ImportStatus = "ACTIVE" | "PENDING";

export interface CommitResult {
  line: number;
  name: string;
  phone: string | null;
  outcome: "created" | "updated" | "skipped" | "error";
  message?: string;
  proId?: string;
  invited?: boolean;
}

function inviteMessage(name: string, phone: string, status: ImportStatus) {
  const first = name.split(" ")[0] || name;
  if (status === "ACTIVE") {
    return (
      `Hi ${first}! 💚 You've been added to *Groomee* as a beauty professional.\n\n` +
      `Sign in to your partner portal with this number (${phone}):\n${APP_URL}/partner/login\n\n` +
      `Then finish your profile so customers can book you: add your photo, confirm your prices and verify your bank account. ` +
      `Text *ON* here when you're ready for jobs.`
    );
  }
  return (
    `Hi ${first}! 💚 The Groomee team has started your beauty professional profile.\n\n` +
    `We'll confirm it shortly. In the meantime, check it and fill in anything missing here (sign in with ${phone}):\n` +
    `${APP_URL}/partner/onboarding`
  );
}

export async function commitImport(args: {
  rows: PreviewRow[];
  status: ImportStatus;
  adminId: string;
  sendInvites: boolean;
}): Promise<CommitResult[]> {
  const { rows, status, adminId, sendInvites } = args;
  const results: CommitResult[] = [];
  const now = new Date();

  for (const r of rows) {
    const base = { line: r.line, name: r.name, phone: r.phone };
    if (r.action === "error") {
      results.push({ ...base, outcome: "error", message: r.errors.join(" ") });
      continue;
    }
    if (r.action === "skip") {
      results.push({ ...base, outcome: "skipped", message: "Already on Groomee." });
      continue;
    }
    const phone = r.phone!;
    try {
      if (r.action === "update" && r.existingProId) {
        const existing = await db.pro.findUnique({
          where: { id: r.existingProId },
          select: { id: true, portfolioUrl: true, userId: true },
        });
        if (!existing) throw new Error("Pro disappeared during import.");
        await db.$transaction([
          db.pro.update({
            where: { id: existing.id },
            data: { ...(existing.portfolioUrl ? {} : r.instagram ? { portfolioUrl: r.instagram } : {}) },
          }),
          db.proService.createMany({
            data: r.serviceIds.map((serviceId) => ({ proId: existing.id, serviceId })),
            skipDuplicates: true,
          }),
          db.proZone.createMany({
            data: r.zones.map((z) => ({ proId: existing.id, zoneId: z.id })),
            skipDuplicates: true,
          }),
          ...(r.note
            ? [db.note.create({ data: { entityType: "Pro", entityId: existing.id, authorId: adminId, content: `Import note: ${r.note}` } })]
            : []),
        ]);
        results.push({ ...base, outcome: "updated", proId: existing.id });
        continue;
      }

      // Create: link or create the User by phone, then the Pro.
      const pro = await db.$transaction(async (tx) => {
        const again = await tx.pro.findUnique({ where: { phone }, select: { id: true } });
        if (again) throw new Error("A pro with this phone was created meanwhile. Re-run the preview.");
        let user = await tx.user.findUnique({ where: { phone }, select: { id: true, role: true, name: true, pro: { select: { id: true } } } });
        if (user?.pro) throw new Error("This phone's account is already linked to another pro.");
        if (!user) {
          user = await tx.user.create({
            data: { phone, name: r.name, role: status === "ACTIVE" ? "PRO" : "CUSTOMER" },
            select: { id: true, role: true, name: true, pro: { select: { id: true } } },
          });
        } else {
          await tx.user.update({
            where: { id: user.id },
            data: {
              ...(user.name ? {} : { name: r.name }),
              ...(status === "ACTIVE" && user.role === "CUSTOMER" ? { role: "PRO" as const } : {}),
            },
          });
        }
        const created = await tx.pro.create({
          data: {
            name: r.name,
            phone,
            userId: user.id,
            status,
            availability: "OFFLINE",
            portfolioUrl: r.instagram,
            applicationSource: IMPORT_SOURCE,
            appliedAt: now,
            ...(status === "ACTIVE" ? { approvedAt: now, reviewedById: adminId } : {}),
            services: { create: r.serviceIds.map((serviceId) => ({ serviceId })) },
            zones: { create: r.zones.map((z) => ({ zoneId: z.id })) },
          },
          select: { id: true },
        });
        if (r.note) {
          await tx.note.create({
            data: { entityType: "Pro", entityId: created.id, authorId: adminId, content: `Import note: ${r.note}` },
          });
        }
        return created;
      });

      let invited = false;
      if (sendInvites) {
        try {
          const res = await sendMessage(phone, inviteMessage(r.name, phone, status));
          invited = Boolean(res?.success);
        } catch (err) {
          console.error("[pro-import] invite failed", phone, err);
        }
      }
      results.push({ ...base, outcome: "created", proId: pro.id, invited });
    } catch (err) {
      results.push({ ...base, outcome: "error", message: err instanceof Error ? err.message : "Failed to import row." });
    }
  }

  const created = results.filter((r) => r.outcome === "created").length;
  const updated = results.filter((r) => r.outcome === "updated").length;
  await logAdminAction({
    adminId,
    action: "pro.import",
    entityType: "Pro",
    entityId: "bulk",
    metadata: { created, updated, skipped: results.length - created - updated, status },
  });
  return results;
}
