import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { getCollections } from "@/lib/db";
import { loadRuleInputs } from "@/lib/recs-engine";
import { generateRecommendations } from "@/lib/rules";

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
    const { inputs, contentDocs } = await loadRuleInputs(userId, site, accessToken);

    if (contentDocs.length === 0) {
      return NextResponse.json({
        ready: false,
        reason: "No crawled content yet. Run “Sync & analyze page content” on the Pages page first.",
        recommendations: [],
        aiEnabled: true,
      });
    }

    const recommendations = generateRecommendations(inputs);

    const { rec_enhancements } = await getCollections();
    const cached = await rec_enhancements
      .find({
        userId,
        siteUrl: site,
        recId: { $in: recommendations.map((r) => r.id) },
      })
      .toArray();
    const aiByRecId = new Map(
      cached.map((c) => [
        c.recId,
        {
          why: c.why,
          steps: c.steps,
          draftTitle: c.draftTitle ?? null,
          draftMeta: c.draftMeta ?? null,
          agentPrompt: c.agentPrompt ?? null,
        },
      ])
    );

    return NextResponse.json({
      ready: true,
      recommendations: recommendations.map((r) => ({ ...r, ai: aiByRecId.get(r.id) ?? null })),
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
