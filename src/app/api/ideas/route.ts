import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { getCollections } from "@/lib/db";
import { packageIdeasWithAI, runIdeaResearch } from "@/lib/ideas-engine";
import type { IdeaRunDoc } from "@/lib/db";

const FRESH_MS = 7 * 24 * 60 * 60 * 1000;

function carryForward(previous: IdeaRunDoc, next: IdeaRunDoc): IdeaRunDoc {
  if (!previous || previous.ideas.length === 0) return next;
  const have = new Set(next.ideas.map((i) => i.id));
  const carried = previous.ideas.filter((i) => !have.has(i.id));
  if (carried.length === 0) return next;
  return {
    ...next,
    ideas: [...carried, ...next.ideas],
    stats: {
      ...next.stats,
      ideasReturned: next.ideas.length + carried.length,
      carriedFromPreviousRun: carried.length,
    },
  };
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
  const refresh = req.nextUrl.searchParams.get("refresh") === "1";
  const cachedOnly = req.nextUrl.searchParams.get("cached") === "1";

  try {
    const { idea_runs, page_content } = await getCollections();

    const cached = await idea_runs.findOne({ userId, siteUrl: site });

    // Cached-only reads (idea detail pages) should still resolve a past run even
    // after the freshness window lapses — a stale idea beats "no longer exists".
    if (cachedOnly) {
      if (cached) {
        return NextResponse.json({ ready: true, cached: true, ...cached });
      }
      return NextResponse.json({
        ready: false,
        reason: "No research run stored yet — open the Ideas page to run one.",
      });
    }

    if (!refresh && cached && Date.now() - new Date(cached.generatedAt).getTime() < FRESH_MS) {
      return NextResponse.json({ ready: true, cached: true, ...cached });
    }

    const crawledCount = await page_content.countDocuments({ userId, siteUrl: site });
    if (crawledCount === 0) {
      return NextResponse.json({
        ready: false,
        reason:
          "Ideas need your crawled page inventory to detect coverage gaps. Run a crawl on the Pages page first.",
      });
    }

    let run: IdeaRunDoc;
    try {
      run = await runIdeaResearch(userId, site, accessToken);
    } catch (err) {
      // Research failed (GSC quota, network, auth blip). Never drop the last
      // good run — serve it as stale data instead of returning a bare 500.
      if (cached) {
        console.error("[/api/ideas] research failed, serving stale run:", err);
        return NextResponse.json({ ready: true, cached: true, stale: true, ...cached });
      }
      throw err;
    }

    // A degraded re-run (partial GSC coverage) must never permanently wipe a
    // richer prior run. Carry forward ideas the new run failed to surface.
    const previousAnalyzed = cached?.stats.queriesAnalyzed ?? 0;
    const degraded =
      Boolean(run.stats.partialData) ||
      (previousAnalyzed > 0 && run.stats.queriesAnalyzed < previousAnalyzed * 0.8);
    if (degraded) {
      run = carryForward(cached!, run);
      run.stats.degraded = true;
    }

    if (run.stats.queriesAnalyzed === 0 && cached) {
      return NextResponse.json({ ready: true, cached: true, degraded: true, ...cached });
    }
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
