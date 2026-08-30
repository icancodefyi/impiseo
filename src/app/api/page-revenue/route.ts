import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { getCollections } from "@/lib/db";
import { normalizePath } from "@/lib/url";

export async function GET(req: NextRequest) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const site = req.nextUrl.searchParams.get("site");
  if (!site) {
    return NextResponse.json({ error: "missing site param" }, { status: 400 });
  }

  const { page_revenue } = await getCollections();
  const rows = await page_revenue
    .find({ userId, siteUrl: site })
    .project({ path: 1, monthlyRevenue: 1, updatedAt: 1 })
    .toArray();

  return NextResponse.json({
    site,
    monthly: rows.map((r) => ({
      path: r.path,
      monthlyRevenue: r.monthlyRevenue,
      updatedAt: r.updatedAt,
    })),
  });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: { site?: string; path?: string; monthlyRevenue?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }

  const site = body.site?.trim();
  const path = normalizePath(body.path ?? "");
  const value = Number(body.monthlyRevenue);
  if (!site || !path) {
    return NextResponse.json({ error: "missing site or path" }, { status: 400 });
  }
  if (!Number.isFinite(value) || value < 0) {
    return NextResponse.json({ error: "monthlyRevenue must be a non-negative number" }, { status: 400 });
  }

  const { page_revenue } = await getCollections();
  if (value === 0) {
    await page_revenue.deleteOne({ userId, siteUrl: site, path });
  } else {
    await page_revenue.updateOne(
      { userId, siteUrl: site, path },
      { $set: { monthlyRevenue: value, updatedAt: new Date() } },
      { upsert: true }
    );
  }

  return NextResponse.json({ ok: true, path, monthlyRevenue: value });
}