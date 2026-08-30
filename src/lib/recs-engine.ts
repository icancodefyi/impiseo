import { google } from "googleapis";
import type { WithId } from "mongodb";
import { getConnections } from "@/lib/connections";
import { getCollections, type PageContentDoc, type PageDoc } from "@/lib/db";
import { fetchPosthogStats } from "@/lib/providers/posthog";
import type { EnrichedContent, PageQueryRow, RuleInputs } from "@/lib/rules";
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

export async function loadRuleInputs(
  userId: string,
  site: string,
  accessToken: string
): Promise<{ inputs: RuleInputs; contentDocs: WithId<PageContentDoc>[]; pageDocs: PageDoc[] }> {
  const { pages, page_content } = await getCollections();

  const [pageDocs, contentDocs, connections] = await Promise.all([
    pages.find({ userId, siteUrl: site, active: { $ne: false } }).toArray(),
    page_content.find({ userId, siteUrl: site }).toArray(),
    getConnections(userId),
  ]);

  const metricsByPath = new Map<string, PageDoc>(pageDocs.map((p) => [p.path, p]));
  const contents: EnrichedContent[] = contentDocs.map((c) => {
    const m = metricsByPath.get(c.path);
    return { ...c, clicks: m?.clicks ?? 0, impressions: m?.impressions ?? 0 };
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

  return {
    inputs: { contents, phViewsByPath, posthogConnected, pageQueries },
    contentDocs,
    pageDocs,
  };
}
