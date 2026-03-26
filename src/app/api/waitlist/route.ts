import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { awardPoints, POINTS } from "@/lib/points";
import { sendMessage } from "@/lib/whatsapp";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, phone, email, city, role, area } = body;

    if (!phone && !email) {
      return NextResponse.json(
        { success: false, error: "Phone or email is required." },
        { status: 400 },
      );
    }

    // Check for duplicate by phone or email
    if (phone) {
      const existing = await db.waitlist.findFirst({
        where: { phone, city: city ?? "Abuja" },
      });
      if (existing) {
        return NextResponse.json(
          { success: false, error: "You are already on the waitlist!" },
          { status: 409 },
        );
      }
    }

    const entry = await db.waitlist.create({
      data: {
        name: name || null,
        phone: phone || null,
        email: email || null,
        city: city ?? "Abuja",
        role: role ?? "customer",
      },
    });

    // Award points if the user is logged in (matched by phone)
    if (phone) {
      const user = await db.user.findUnique({ where: { phone } });
      if (user) {
        await awardPoints(user.id, POINTS.JOIN_WAITLIST, "Joined waitlist", entry.id).catch(() => {});
      }
    }

    // Send WhatsApp confirmation if a phone number was provided
    if (phone) {
      const cityLabel = entry.city ?? "your city";
      sendMessage(
        phone,
        `🎉 You're on the Groomee waitlist for ${cityLabel}!\n\nWe'll notify you as soon as we launch in your area. Meanwhile, earn Groomee Points by completing our quick survey at groomee.ng\n\n💚 The Groomee Team`,
        "whatsapp",
      ).catch(() => {}); // fire-and-forget — don't block the response
    }

    return NextResponse.json({ success: true, data: { id: entry.id } });
  } catch (err) {
    console.error("waitlist submission error:", err);
    return NextResponse.json(
      { success: false, error: "Failed to join waitlist." },
      { status: 500 },
    );
  }
}
