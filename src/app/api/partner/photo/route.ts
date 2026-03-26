import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { writeFile, mkdir } from "fs/promises";
import path from "path";

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const pro = await db.pro.findFirst({ where: { phone: session.phone } });
    if (!pro) return NextResponse.json({ error: "Not a pro" }, { status: 403 });

    const formData = await req.formData();
    const file = formData.get("photo") as File;
    if (!file) return NextResponse.json({ error: "No file" }, { status: 400 });

    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize)
      return NextResponse.json({ error: "File too large (max 5MB)" }, { status: 400 });

    const ext = file.name.split(".").pop()?.toLowerCase();
    if (!["jpg", "jpeg", "png", "webp"].includes(ext ?? "")) {
      return NextResponse.json({ error: "Only jpg, png, webp allowed" }, { status: 400 });
    }

    const uploadDir = path.join(process.cwd(), "public/uploads/pros");
    await mkdir(uploadDir, { recursive: true });

    const filename = `${pro.id}-${Date.now()}.${ext}`;
    const filepath = path.join(uploadDir, filename);
    const buffer = Buffer.from(await file.arrayBuffer());
    await writeFile(filepath, buffer);

    const photoUrl = `/uploads/pros/${filename}`;
    await db.pro.update({ where: { id: pro.id }, data: { photo: photoUrl } });

    return NextResponse.json({ success: true, url: photoUrl });
  } catch (err) {
    console.error("partner photo upload error:", err);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}
