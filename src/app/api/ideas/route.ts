import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { getCollections } from "@/lib/db";
import { packageIdeasWithAI, runIdeaResearch } from "@/lib/ideas-engine";

const FRESH_MS = 7 * 24 * 60 * 60 * 1000;

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
  const refresh = req.nextUrl.searchParams.get("refresh") === "1";
  const cachedOnly = req.nextUrl.searchParams.get("cached") === "1";

  try {
    const { idea_runs, page_content } = await getCollections();

    const cached = await idea_runs.findOne({ userId, siteUrl: site });
    if (!refresh && cached && Date.now() - new Date(cached.generatedAt).getTime() < FRESH_MS) {
      return NextResponse.json({ ready: true, cached: true, ...cached });
    }
    if (cachedOnly) {
      return NextResponse.json({
        ready: false,
        reason: "No research run stored yet — open the Ideas page to run one.",
      });
    }

    const crawledCount = await page_content.countDocuments({ userId, siteUrl: site });
    if (crawledCount === 0) {
      return NextResponse.json({
        ready: false,
        reason:
          "Ideas need your crawled page inventory to detect coverage gaps. Run “Sync & analyze page content” on the Pages page first.",
      });
    }

    let run = await runIdeaResearch(userId, site, accessToken);

    if (run.stats.queriesAnalyzed === 0) {
      return NextResponse.json({
        ready: false,
        reason: `Not enough Search Console data over the last ${run.stats.windowDays} days to mine demand from. Keep collecting — ideas unlock once real impressions exist.`,
      });
    }

    try {
      run = await packageIdeasWithAI(run);
    } catch (err) {
      console.error("[/api/ideas] AI packaging failed (non-fatal):", err);
    }

    await idea_runs.replaceOne({ userId, siteUrl: site }, run, { upsert: true });

    return NextResponse.json({ ready: true, cached: false, ...run });
  } catch (err) {
    console.error("[/api/ideas] error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to research ideas" },
      { status: 500 }
    );
  }
}
