import { NextResponse } from "next/server";
import { google } from "googleapis";
import { auth } from "@/lib/auth";
import { getCollections } from "@/lib/db";

function normalizeSiteUrl(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  const candidate = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const url = new URL(candidate);
    if (!url.hostname.includes(".")) return null;
    return url.origin;
  } catch {
    return null;
  }
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id || !session.access_token) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: {
    siteUrl?: string;
    propertyUrl?: string;
    permissionLevel?: string;
    product?: { type?: string; audience?: string; goal?: string };
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }

  const siteUrl = normalizeSiteUrl(body.siteUrl ?? "");
  if (!siteUrl) {
    return NextResponse.json({ error: "Enter a valid website URL, e.g. example.com" }, { status: 400 });
  }
  if (!body.propertyUrl) {
    return NextResponse.json({ error: "Select a Search Console property" }, { status: 400 });
  }

  // Verify the chosen property belongs to this Google account.
  try {
    const oauth2 = new google.auth.OAuth2();
    oauth2.setCredentials({ access_token: session.access_token });
    const searchconsole = google.searchconsole({ version: "v1", auth: oauth2 });
    const { data } = await searchconsole.sites.list();
    const entry = (data.siteEntry ?? []).find((s) => s.siteUrl === body.propertyUrl);
    if (!entry || !entry.permissionLevel || entry.permissionLevel === "siteUnverifiedUser") {
      return NextResponse.json({ error: "That property is not available on your Google account" }, { status: 403 });
    }

    const { users } = await getCollections();
    const now = new Date();
    await users.updateOne(
      { userId: session.user.id },
      {
        $set: {
          email: session.user.email ?? "",
          onboarded: true,
          siteUrl,
          product: {
            type: body.product?.type ?? "",
            audience: body.product?.audience ?? "",
            goal: body.product?.goal ?? "",
          },
          activeProperty: body.propertyUrl,
          updatedAt: now,
        },
        $setOnInsert: {
          userId: session.user.id,
          createdAt: now,
          properties: [
            { url: body.propertyUrl, permissionLevel: entry.permissionLevel, addedAt: now },
          ],
        },
      },
      { upsert: true }
    );

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[/api/onboarding] error:", err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
