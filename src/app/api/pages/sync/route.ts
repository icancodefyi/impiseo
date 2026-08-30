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
    const seenPaths = new Set<string>();
    let synced = 0;

    for (const row of rows) {
      const url = row.keys?.[0];
      if (!url) continue;
      const path = normalizePath(url);
      seenPaths.add(path);
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
            active: true,
          },
          $setOnInsert: { createdAt: syncedAt },
        },
        { upsert: true }
      );
      synced++;
    }

    // Deactivate pages that fell out of Search Console's top-300 over the last
    // 30 days AND have zero engagement — they are dead or unreachable, and must
    // stop being crawled and surfaced as recommendations. Pages with any last
    // known impressions stay active (a single top-300 miss isn't deactivation).
    const deactivated = await pages.updateMany(
      {
        userId,
        siteUrl: site,
        active: { $ne: false },
        path: { $nin: [...seenPaths] },
        clicks: 0,
        impressions: 0,
      },
      { $set: { active: false, syncedAt } }
    );

    const total = await pages.countDocuments({ userId, siteUrl: site, active: { $ne: false } });
    return NextResponse.json({ synced, total, deactivated: deactivated.modifiedCount });
  } catch (err) {
    console.error("[/api/pages/sync] error:", err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
