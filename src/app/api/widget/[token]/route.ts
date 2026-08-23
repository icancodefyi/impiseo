import { NextResponse } from "next/server";
import { google } from "googleapis";
import { getCollections } from "@/lib/db";

export const dynamic = "force-dynamic";

function isoDaysAgo(days: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}

type Totals = { clicks: number; impressions: number };

async function fetchTotals(
  siteUrl: string,
  accessToken: string,
  startDate: string,
  endDate: string
): Promise<Totals> {
  const oauth2 = new google.auth.OAuth2();
  oauth2.setCredentials({ access_token: accessToken });
  const searchconsole = google.searchconsole({ version: "v1", auth: oauth2 });
  try {
    const { data } = await searchconsole.searchanalytics.query({
      siteUrl,
      requestBody: {
        startDate,
        endDate,
        rowLimit: 1,
      },
    });
    const row = data.rows?.[0];
    return {
      clicks: row?.clicks ?? 0,
      impressions: row?.impressions ?? 0,
    };
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as { code?: number }).code === 403
    ) {
      throw new Error("forbidden");
    }
    throw error;
  }
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  const { users } = await getCollections();
  const user = await users.findOne({ widgetToken: token });
  if (!user) {
    return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  }

  const site = user.activeProperty || user.siteUrl;
  if (!site) {
    return NextResponse.json(
      { ok: false, error: "no_property" },
      { status: 200 }
    );
  }

  const refreshToken = user.googleRefreshToken;
  if (!refreshToken) {
    return NextResponse.json(
      { ok: false, error: "gsc_not_connected", site },
      { status: 200 }
    );
  }

  try {
    const client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET
    );
    client.setCredentials({ refresh_token: refreshToken });
    const { credentials } = await client.refreshAccessToken();
    const accessToken = credentials.access_token ?? "";
    if (!accessToken) throw new Error("no_access_token");

    // Use fully settled days only — GSC publishes with a ~3-day lag.
    const current = await fetchTotals(
      site,
      accessToken,
      isoDaysAgo(9),
      isoDaysAgo(3)
    );
    const previous = await fetchTotals(
      site,
      accessToken,
      isoDaysAgo(16),
      isoDaysAgo(10)
    );

    const deltaPct =
      previous.clicks > 0
        ? Math.round(((current.clicks - previous.clicks) / previous.clicks) * 100)
        : null;

    return NextResponse.json(
      {
        ok: true,
        site,
        window: "week vs prior week",
        clicks: current.clicks,
        impressions: current.impressions,
        prevClicks: previous.clicks,
        prevImpressions: previous.impressions,
        deltaPct,
        updatedAt: new Date().toISOString(),
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "error";
    return NextResponse.json(
      { ok: false, error: message === "forbidden" ? "forbidden" : "gsc_error", site },
      { status: 200 }
    );
  }
}
