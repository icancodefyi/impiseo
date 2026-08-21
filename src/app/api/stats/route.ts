import { NextResponse, type NextRequest } from "next/server";
import { google } from "googleapis";
import { auth } from "@/lib/auth";

type GscRow = {
  keys?: string[];
  clicks?: number;
  impressions?: number;
  ctr?: number;
  position?: number;
};

export type MetricRow = {
  key: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
};

export type Totals = {
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
};

function iso(d: Date) {
  return d.toISOString().slice(0, 10);
}

function addDays(d: Date, n: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

function toMetricRows(rows: GscRow[]): MetricRow[] {
  return rows.map((r) => ({
    key: r.keys?.[0] ?? "",
    clicks: r.clicks ?? 0,
    impressions: r.impressions ?? 0,
    ctr: r.ctr ?? 0,
    position: r.position ?? 0,
  }));
}

function sumTotals(rows: MetricRow[]): Totals {
  const clicks = rows.reduce((a, r) => a + r.clicks, 0);
  const impressions = rows.reduce((a, r) => a + r.impressions, 0);
  const weightedPos = rows.reduce((a, r) => a + r.position * r.impressions, 0);
  return {
    clicks,
    impressions,
    ctr: impressions ? clicks / impressions : 0,
    position: impressions ? weightedPos / impressions : 0,
  };
}

export async function GET(req: NextRequest) {
  const session = await auth();
  const accessToken = session?.access_token;
  if (!accessToken) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const oauth2 = new google.auth.OAuth2();
  oauth2.setCredentials({ access_token: accessToken });

  const site = req.nextUrl.searchParams.get("site");
  if (!site) {
    return NextResponse.json({ error: "missing site param" }, { status: 400 });
  }
  const days = Math.min(Math.max(Number(req.nextUrl.searchParams.get("days") ?? 28), 3), 90);

  const end = addDays(new Date(), -3);
  const start = addDays(end, -(days - 1));
  const prevEnd = addDays(start, -1);
  const prevStart = addDays(prevEnd, -(days - 1));

  try {
    const searchconsole = google.searchconsole({ version: "v1", auth: oauth2 });

    const query = async (startDate: string, endDate: string, dimensions: string[], rowLimit: number) => {
      const { data } = await searchconsole.searchanalytics.query({
        siteUrl: site,
        requestBody: { startDate, endDate, dimensions, rowLimit },
      });
      return toMetricRows((data.rows ?? []) as GscRow[]);
    };

    const [series, queries, pages, prevSeries] = await Promise.all([
      query(iso(start), iso(end), ["date"], 100),
      query(iso(start), iso(end), ["query"], 25),
      query(iso(start), iso(end), ["page"], 25),
      query(iso(prevStart), iso(prevEnd), ["date"], 100),
    ]);

    return NextResponse.json({
      range: { start: iso(start), end: iso(end), prevStart: iso(prevStart), prevEnd: iso(prevEnd) },
      totals: sumTotals(series),
      prevTotals: sumTotals(prevSeries),
      series: series.map((r) => ({ date: r.key, clicks: r.clicks, impressions: r.impressions })),
      queries: [...queries].sort((a, b) => b.clicks - a.clicks),
      pages: [...pages].sort((a, b) => b.clicks - a.clicks),
    });
  } catch (err) {
    console.error("[/api/stats] GSC error:", err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
