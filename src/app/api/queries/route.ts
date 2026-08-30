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

/** Paged full export of a site's queries — mirrors the GSC rowLimit/startRow semantics. */
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
  const days = Math.min(Math.max(Number(req.nextUrl.searchParams.get("days") ?? 28), 1), 90);
  const offset = Math.min(Math.max(Number(req.nextUrl.searchParams.get("offset") ?? 0), 0), 25000);
  const limit = Math.min(Math.max(Number(req.nextUrl.searchParams.get("limit") ?? 100), 1), 300);

  const end = addDays(new Date(), -3);
  const start = addDays(end, -(days - 1));

  try {
    const { data } = await google.searchconsole({ version: "v1", auth: oauth2 }).searchanalytics.query({
      siteUrl: site,
      requestBody: {
        startDate: iso(start),
        endDate: iso(end),
        dimensions: ["query"],
        rowLimit: limit,
        startRow: offset,
      },
    });
    const queries = toMetricRows((data.rows ?? []) as GscRow[]).sort((a, b) => b.clicks - a.clicks);

    return NextResponse.json({
      site,
      range: { start: iso(start), end: iso(end) },
      offset,
      limit,
      count: queries.length,
      hasMore: queries.length === limit,
      queries,
    });
  } catch (err) {
    console.error("[/api/queries] GSC error:", err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}