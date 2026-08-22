import { NextResponse, type NextRequest } from "next/server";
import { google } from "googleapis";
import { auth } from "@/lib/auth";
import { getCollections } from "@/lib/db";
import { normalizePath } from "@/lib/url";

type GscRow = {
  keys?: string[];
  clicks?: number;
  impressions?: number;
  ctr?: number;
  position?: number;
};

function iso(d: Date) {
  return d.toISOString().slice(0, 10);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  const accessToken = session?.access_token;
  const userId = session?.user?.id;
  if (!accessToken || !userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const site = req.nextUrl.searchParams.get("site");
  if (!site) {
    return NextResponse.json({ error: "missing site param" }, { status: 400 });
  }

  try {
    const oauth2 = new google.auth.OAuth2();
    oauth2.setCredentials({ access_token: accessToken });
    const searchconsole = google.searchconsole({ version: "v1", auth: oauth2 });

    const end = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
    const start = new Date(end.getTime() - 27 * 24 * 60 * 60 * 1000);

    const { data } = await searchconsole.searchanalytics.query({
      siteUrl: site,
      requestBody: {
        startDate: iso(start),
        endDate: iso(end),
        dimensions: ["page"],
        rowLimit: 300,
      },
    });

    const rows = (data.rows ?? []) as GscRow[];
    const { pages } = await getCollections();
    const syncedAt = new Date();
    let synced = 0;

    for (const row of rows) {
      const url = row.keys?.[0];
      if (!url) continue;
      const path = normalizePath(url);
      await pages.updateOne(
        { userId, siteUrl: site, path },
        {
          $set: {
            url,
            clicks: row.clicks ?? 0,
            impressions: row.impressions ?? 0,
            ctr: row.ctr ?? 0,
            position: row.position ?? 0,
            syncedAt,
          },
          $setOnInsert: { createdAt: syncedAt },
        },
        { upsert: true }
      );
      synced++;
    }

    const total = await pages.countDocuments({ userId, siteUrl: site });
    return NextResponse.json({ synced, total });
  } catch (err) {
    console.error("[/api/pages/sync] error:", err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
