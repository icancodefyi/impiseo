import { NextResponse, type NextRequest } from "next/server";
import { google } from "googleapis";
import { auth } from "@/lib/auth";
import { getConnections } from "@/lib/connections";
import { fetchPosthogStats } from "@/lib/providers/posthog";
import { normalizePath } from "@/lib/url";

type GscRow = {
  keys?: string[];
  clicks?: number;
  impressions?: number;
  ctr?: number;
  position?: number;
};

export type JoinedRow = {
  path: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
  views: number;
  visitors: number;
};

function iso(d: Date) {
  return d.toISOString().slice(0, 10);
}

function addDays(d: Date, n: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

export async function GET(req: NextRequest) {
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
  const days = Math.min(Math.max(Number(req.nextUrl.searchParams.get("days") ?? 28), 1), 90);

  const ph = (await getConnections(userId)).find(
    (c) => c.provider === "posthog" && c.apiKey
  );
  if (!ph) {
    return NextResponse.json({ connected: false }, { status: 200 });
  }

  const end = addDays(new Date(), -3);
  const start = addDays(end, -(days - 1));

  try {
    const oauth2 = new google.auth.OAuth2();
    oauth2.setCredentials({ access_token: accessToken });
    const searchconsole = google.searchconsole({ version: "v1", auth: oauth2 });

    const [gscRes, phStats] = await Promise.all([
      searchconsole.searchanalytics.query({
        siteUrl: site,
        requestBody: {
          startDate: iso(start),
          endDate: iso(end),
          dimensions: ["page"],
          rowLimit: 100,
        },
      }),
      fetchPosthogStats({
        host: ph.host,
        apiKey: ph.apiKey!,
        projectId: ph.projectId,
        days,
        limit: 50,
      }),
    ]);

    const byPath = new Map<string, JoinedRow>();

    for (const r of (gscRes.data.rows ?? []) as GscRow[]) {
      const path = normalizePath(r.keys?.[0] ?? "");
      const existing = byPath.get(path);
      const row: JoinedRow = existing ?? {
        path,
        clicks: 0,
        impressions: 0,
        ctr: 0,
        position: 0,
        views: 0,
        visitors: 0,
      };
      row.clicks += r.clicks ?? 0;
      row.impressions += r.impressions ?? 0;
      row.position += (r.position ?? 0) * (r.impressions ?? 0);
      byPath.set(path, row);
    }
    for (const row of byPath.values()) {
      row.ctr = row.impressions ? row.clicks / row.impressions : 0;
      row.position = row.impressions ? row.position / row.impressions : 0;
    }

    for (const p of phStats.topPages) {
      const path = normalizePath(p.path);
      const row = byPath.get(path);
      if (row) {
        row.views = p.views;
        row.visitors = p.visitors;
      } else {
        byPath.set(path, {
          path,
          clicks: 0,
          impressions: 0,
          ctr: 0,
          position: 0,
          views: p.views,
          visitors: p.visitors,
        });
      }
    }

    const rows = [...byPath.values()].sort(
      (a, b) => b.clicks - a.clicks || b.views - a.views
    );

    return NextResponse.json({
      connected: true,
      range: { start: iso(start), end: iso(end) },
      rows,
    });
  } catch (err) {
    console.error("[/api/insights] error:", err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
