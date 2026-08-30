import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { getCollections } from "@/lib/db";
import {
  computeQueryOpportunities,
  type IntentKind,
  type QueryOpportunity,
} from "@/lib/opportunities-engine";
import { gscWindow } from "@/lib/gsc";

const SORTS: Record<string, (a: QueryOpportunity, b: QueryOpportunity) => number> = {
  headroom: (a, b) => b.headroomTop3 - a.headroomTop3,
  impressions: (a, b) => b.impressions - a.impressions,
  clicks: (a, b) => b.clicks - a.clicks,
  position: (a, b) => a.position - b.position,
};

export async function GET(req: NextRequest) {
  const session = await auth();
  const accessToken = session?.access_token;
  const userId = session?.user?.id;
  if (!accessToken || !userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const sp = req.nextUrl.searchParams;
  const site = sp.get("site");
  if (!site) {
    return NextResponse.json({ error: "missing site param" }, { status: 400 });
  }

  const days = Math.min(Math.max(Number(sp.get("days") ?? 28), 1), 90);
  const offset = Math.min(Math.max(Number(sp.get("offset") ?? 0), 0), 25000);
  const limit = Math.min(Math.max(Number(sp.get("limit") ?? 50), 1), 200);
  const minImpressions = Number(sp.get("minImpressions") ?? 0) || 0;
  const queryContains = sp.get("queryContains")?.trim() || undefined;
  const excludeBranded = sp.get("excludeBranded") !== "false";
  const intent = (sp.get("intent") || "all") as IntentKind | "all";
  const cannibalizedOnly = sp.get("cannibalized") === "true";
  const sort = sp.get("sort") || "headroom";

  const rng = gscWindow(days);

  try {
    const { page_revenue } = await getCollections();
    const revDocs = await page_revenue
      .find({ userId, siteUrl: site })
      .project({ path: 1, monthlyRevenue: 1 })
      .toArray();
    const revenueByPath = new Map(
      revDocs.filter((r) => r.monthlyRevenue > 0).map((r) => [r.path, r.monthlyRevenue])
    );

    const rows = await computeQueryOpportunities(userId, site, accessToken, {
      days,
      minImpressions,
      queryContains,
      excludeBranded,
      revenueByPath,
    });

    const filtered = rows.filter((r) => {
      if (intent !== "all" && r.intent !== intent) return false;
      if (cannibalizedOnly && !r.cannibalizing) return false;
      return true;
    });

    filtered.sort(SORTS[sort] ?? SORTS.headroom);

    const total = filtered.length;
    const queries = filtered.slice(offset, offset + limit);

    return NextResponse.json({
      site,
      range: { start: rng.start, end: rng.end },
      offset,
      limit,
      count: queries.length,
      total,
      queries,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "failed to compute opportunities" },
      { status: 500 }
    );
  }
}