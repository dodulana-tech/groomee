import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { isWhatsAppChannelCity } from "@/lib/whatsapp-channel";
import { getSession } from "@/lib/auth";
import { resolveBankAccount, bankNameForCode } from "@/lib/banks";
import {
  applicationState,
  CATEGORY_LABEL,
  notifyApplicationReceived,
  PRIORITY_ZONES,
} from "@/lib/pro-onboarding";

/**
 * Beauty-professional applications.
 *
 * Lives outside /api/partner on purpose: middleware restricts /api/partner/*
 * to PRO/ADMIN sessions, and applicants are still CUSTOMER until approved.
 * Middleware only requires *a* session here.
 */

async function findApplicantPro(userId: string, phone: string | null) {
  return db.pro.findFirst({
    where: { OR: [{ userId }, ...(phone ? [{ phone }] : [])] },
    include: {
      services: { include: { service: { select: { category: true } } } },
      zones: { include: { zone: { select: { id: true, name: true } } } },
    },
  });
}

async function formOptions() {
  const [zones, services] = await Promise.all([
    db.zone.findMany({
      where: { OR: [{ cityRel: { status: { in: ["LIVE", "WAITLIST"] } } }, { cityId: null }] },
      select: { id: true, name: true, city: true, cityRel: { select: { name: true, slug: true, status: true } } },
      orderBy: { name: "asc" },
    }),
    db.service.groupBy({ by: ["category"], where: { isActive: true }, _count: true }),
  ]);
  const priority = new Set<string>(PRIORITY_ZONES);
  return {
    zones: zones
      .map((z) => ({
        id: z.id,
        name: z.name,
        city: z.cityRel?.name ?? z.city,
        // WhatsApp-concierge cities (Abuja) take bookings by chat even while
        // WAITLIST, so their pros are needed now.
        cityLive: z.cityRel ? z.cityRel.status === "LIVE" || isWhatsAppChannelCity(z.cityRel.slug) : true,
        priority: priority.has(z.name) || isWhatsAppChannelCity(z.cityRel?.slug),
      }))
      .sort(
        (a, b) =>
          Number(b.cityLive) - Number(a.cityLive) ||
          a.city.localeCompare(b.city) ||
          Number(b.priority) - Number(a.priority) ||
          a.name.localeCompare(b.name),
      ),
    categories: services
      .filter((s) => s._count > 0)
      .map((s) => ({ id: s.category, label: CATEGORY_LABEL[s.category] ?? s.category })),
  };
}

// GET /api/applications/pro — current user's application state + form options.
export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }
  const user = await db.user.findUnique({
    where: { id: session.userId },
    select: { name: true, phone: true, email: true },
  });
  if (!user) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }
  const pro = await findApplicantPro(session.userId, user.phone);
  const options = await formOptions();

  return NextResponse.json({
    success: true,
    data: {
      state: applicationState(pro),
      // Session role lags behind approval until the next sign-in.
      sessionRole: session.role,
      user,
      application: pro
        ? {
            name: pro.name,
            bio: pro.bio,
            yearsExperience: pro.yearsExperience,
            portfolioUrl: pro.portfolioUrl,
            categories: [...new Set(pro.services.map((s) => s.service.category))],
            zoneIds: pro.zones.map((z) => z.zone.id),
            zoneNames: pro.zones.map((z) => z.zone.name),
            bankCode: pro.bankCode,
            bankAccount: pro.bankAccount,
            bankAccountName: pro.bankAccountName,
            appliedAt: (pro.appliedAt ?? pro.createdAt).toISOString(),
            rejectionReason: pro.rejectionReason,
          }
        : null,
      options,
    },
  });
}

const applySchema = z.object({
  name: z.string().trim().min(2, "Please enter your full name.").max(80),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email("That email doesn't look right.")
    .optional()
    .or(z.literal("")),
  bio: z.string().trim().max(500, "Keep your bio under 500 characters.").optional().or(z.literal("")),
  yearsExperience: z.coerce.number().int().min(0).max(60).optional().nullable(),
  portfolioUrl: z.string().trim().max(200).optional().or(z.literal("")),
  categories: z.array(z.string()).min(1, "Pick at least one service you offer."),
  zoneIds: z.array(z.string()).min(1, "Pick at least one area you can cover."),
  bankCode: z.string().trim().optional().or(z.literal("")),
  bankAccount: z.string().trim().optional().or(z.literal("")),
  source: z.string().trim().max(40).optional(),
});

// POST /api/applications/pro — submit, edit (while pending) or re-apply.
export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ success: false, error: "Please sign in to apply." }, { status: 401 });
    }

    const parsed = applySchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) {
      const issue = parsed.error.errors[0];
      return NextResponse.json(
        { success: false, error: issue.message, field: issue.path[0] },
        { status: 400 },
      );
    }
    const input = parsed.data;

    // Phone comes from the verified account, never the request body.
    const sessionUser = await db.user.findUnique({
      where: { id: session.userId },
      select: { phone: true, email: true },
    });
    if (!sessionUser?.phone) {
      return NextResponse.json(
        {
          success: false,
          error: "Please add a phone number to your account before applying. We need it to send booking alerts.",
          needsPhone: true,
        },
        { status: 400 },
      );
    }
    const phone = sessionUser.phone;

    const existing = await findApplicantPro(session.userId, phone);
    const state = applicationState(existing);
    if (state === "APPROVED") {
      return NextResponse.json(
        {
          success: false,
          state,
          error: "You're already an approved Groomee pro. Sign in to your partner portal to update your profile.",
        },
        { status: 409 },
      );
    }
    if (state === "SUSPENDED" || state === "CLOSED") {
      return NextResponse.json(
        {
          success: false,
          state,
          error: "Your partner account is on hold. Please message the Groomee team on WhatsApp and we'll help.",
        },
        { status: 409 },
      );
    }

    // Validate catalog references against the DB so nothing is silently dropped.
    const [serviceRecords, zoneRecords] = await Promise.all([
      db.service.findMany({
        where: { category: { in: input.categories as never[] }, isActive: true },
        select: { id: true, category: true },
      }),
      db.zone.findMany({ where: { id: { in: input.zoneIds } }, select: { id: true, name: true } }),
    ]);
    if (serviceRecords.length === 0) {
      return NextResponse.json(
        { success: false, error: "Pick at least one service you offer.", field: "categories" },
        { status: 400 },
      );
    }
    if (zoneRecords.length === 0) {
      return NextResponse.json(
        { success: false, error: "Pick at least one area you can cover.", field: "zoneIds" },
        { status: 400 },
      );
    }

    // Bank details are optional at application time. If given, they must
    // resolve — an unpayable account is worse than none.
    let bank: {
      bankCode: string;
      bankAccount: string;
      bankAccountNo: string;
      bankName: string;
      bankAccountName: string;
      bankVerifiedAt: Date;
    } | null = null;
    const bankCode = input.bankCode || "";
    const bankAccount = (input.bankAccount || "").replace(/\D/g, "");
    if (bankCode || bankAccount) {
      const resolved = await resolveBankAccount(bankAccount, bankCode);
      if (!resolved.ok) {
        return NextResponse.json(
          { success: false, error: `${resolved.error} You can also skip this step and add it after approval.`, field: "bank" },
          { status: 400 },
        );
      }
      bank = {
        bankCode,
        bankAccount,
        bankAccountNo: bankAccount,
        bankName: (await bankNameForCode(bankCode)) ?? bankCode,
        bankAccountName: resolved.accountName,
        bankVerifiedAt: new Date(),
      };
    }

    const now = new Date();
    const profile = {
      name: input.name,
      bio: input.bio || null,
      yearsExperience: input.yearsExperience ?? null,
      portfolioUrl: input.portfolioUrl || null,
      userId: session.userId,
      ...(bank ?? {}),
    };

    const isFresh = state === "NONE" || state === "REJECTED";
    const pro = existing
      ? await db.pro.update({
          where: { id: existing.id },
          data: {
            ...profile,
            ...(state === "REJECTED"
              ? {
                  status: "PENDING" as const,
                  rejectedAt: null,
                  rejectionReason: null,
                  reviewedById: null,
                  appliedAt: now,
                }
              : {}),
            ...(existing.appliedAt ? {} : { appliedAt: now }),
          },
        })
      : await db.pro.create({
          data: {
            ...profile,
            phone,
            status: "PENDING",
            availability: "OFFLINE",
            appliedAt: now,
            applicationSource: input.source || null,
          },
        });

    // Replace service/zone links. Keep any custom prices already set.
    const priorPrices = new Map(
      (existing?.services ?? []).map((s) => [s.serviceId, s.customPrice] as const),
    );
    await db.$transaction([
      db.proService.deleteMany({ where: { proId: pro.id } }),
      db.proZone.deleteMany({ where: { proId: pro.id } }),
      db.proService.createMany({
        data: serviceRecords.map((s) => ({
          proId: pro.id,
          serviceId: s.id,
          customPrice: priorPrices.get(s.id) ?? null,
        })),
        skipDuplicates: true,
      }),
      db.proZone.createMany({
        data: zoneRecords.map((z) => ({ proId: pro.id, zoneId: z.id })),
        skipDuplicates: true,
      }),
    ]);

    // Email: update when given and free; warn instead of silently swallowing.
    let emailWarning: string | null = null;
    let email = sessionUser.email;
    if (input.email && input.email !== sessionUser.email) {
      const taken = await db.user.findFirst({
        where: { email: input.email, id: { not: session.userId } },
        select: { id: true },
      });
      if (taken) {
        emailWarning = "We kept your existing email. The one you entered is already linked to another account.";
      } else {
        try {
          await db.user.update({ where: { id: session.userId }, data: { email: input.email } });
          email = input.email;
        } catch (err) {
          console.error("pro application: email update failed", err);
          emailWarning = "We couldn't update your email. You can change it later from your profile.";
        }
      }
    }
    // Give the account a name if it doesn't have one yet.
    await db.user
      .updateMany({ where: { id: session.userId, name: null }, data: { name: input.name } })
      .catch(() => {});

    if (isFresh) {
      const categories = [...new Set(serviceRecords.map((s) => s.category))];
      await notifyApplicationReceived({
        pro,
        email,
        services: categories.map((c) => CATEGORY_LABEL[c] ?? c),
        zones: zoneRecords.map((z) => z.name),
        resubmission: state === "REJECTED",
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        proId: pro.id,
        state: "PENDING",
        updated: !isFresh,
        appliedAt: (pro.appliedAt ?? now).toISOString(),
        ...(emailWarning ? { emailWarning } : {}),
      },
    });
  } catch (err) {
    console.error("pro application POST error:", err);
    return NextResponse.json(
      { success: false, error: "We couldn't submit your application. Please try again." },
      { status: 500 },
    );
  }
}
