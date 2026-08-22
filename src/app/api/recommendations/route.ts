import { NextResponse, type NextRequest } from "next/server";
import { google } from "googleapis";
import { auth } from "@/lib/auth";
import { getConnections } from "@/lib/connections";
import { getCollections, type PageDoc } from "@/lib/db";
import { fetchPosthogStats } from "@/lib/providers/posthog";
import { generateRecommendations, type EnrichedContent, type PageQueryRow } from "@/lib/rules";
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

  try {
    const { pages, page_content } = await getCollections();

    const [pageDocs, contentDocs, connections] = await Promise.all([
      pages.find({ userId, siteUrl: site }).toArray(),
      page_content.find({ userId, siteUrl: site }).toArray(),
      getConnections(userId),
    ]);

    if (contentDocs.length === 0) {
      return NextResponse.json({
        ready: false,
        reason: "No crawled content yet. Run “Sync & analyze page content” on the Pages page first.",
        recommendations: [],
      });
    }

    const metricsByPath = new Map<string, PageDoc>(pageDocs.map((p) => [p.path, p]));
    const contents: EnrichedContent[] = contentDocs.map((c) => {
      const m = metricsByPath.get(c.path);
      return {
        ...c,
        clicks: m?.clicks ?? 0,
        impressions: m?.impressions ?? 0,
      };
    });

    const ph = connections.find((c) => c.provider === "posthog" && c.apiKey);
    let posthogConnected = false;
    const phViewsByPath = new Map<string, number>();
    if (ph) {
      try {
        const stats = await fetchPosthogStats({
          host: ph.host,
          apiKey: ph.apiKey!,
          projectId: ph.projectId,
          days: 28,
          limit: 50,
        });
        posthogConnected = true;
        for (const p of stats.topPages) phViewsByPath.set(normalizePath(p.path), p.views);
      } catch {
        // PostHog unreachable — skip tracking-gap rule
      }
    }

    const oauth2 = new google.auth.OAuth2();
    oauth2.setCredentials({ access_token: accessToken });
    const searchconsole = google.searchconsole({ version: "v1", auth: oauth2 });

    const end = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
    const start = new Date(end.getTime() - 27 * 24 * 60 * 60 * 1000);

    let pageQueries: PageQueryRow[] = [];
    try {
      const { data } = await searchconsole.searchanalytics.query({
        siteUrl: site,
        requestBody: {
          startDate: iso(start),
          endDate: iso(end),
          dimensions: ["page", "query"],
          rowLimit: 500,
        },
      });
      pageQueries = ((data.rows ?? []) as GscRow[])
        .map((r) => ({
          path: normalizePath(r.keys?.[0] ?? ""),
          query: r.keys?.[1] ?? "",
          clicks: r.clicks ?? 0,
          impressions: r.impressions ?? 0,
          position: r.position ?? 0,
        }))
        .filter((r) => r.path && r.query);
    } catch {
      // striking-distance rule degrades silently
    }

    const recommendations = generateRecommendations({
      contents,
      phViewsByPath,
      posthogConnected,
      pageQueries,
    });

    return NextResponse.json({
      ready: true,
      recommendations,
      stats: {
        pagesCrawled: contentDocs.length,
        rulesRun: 5,
      },
    });
  } catch (err) {
    console.error("[/api/recommendations] error:", err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
