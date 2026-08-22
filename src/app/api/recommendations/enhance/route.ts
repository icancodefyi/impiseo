import { createHash } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { aiEnabled, chatJSON } from "@/lib/ai/client";
import { buildSystemPrompt } from "@/lib/ai/skills";
import { getCollections } from "@/lib/db";
import { loadRuleInputs } from "@/lib/recs-engine";
import { generateRecommendations, type Rec } from "@/lib/rules";

const BATCH_SIZE = 5;

type Enhancement = {
  id: string;
  why: string;
  steps: string[];
  draftTitle?: string | null;
  draftMeta?: string | null;
};

type Evidence = Record<string, unknown>;

function buildEvidence(rec: Rec, contents: Map<string, import("@/lib/db").PageContentDoc>, queriesByPath: Map<string, { query: string; impressions: number; position: number }[]>): Evidence {
  const base = {
    id: rec.id,
    type: rec.type,
    severity: rec.severity,
    finding: rec.title,
    ruleDetail: rec.detail,
    suggestedAction: rec.action,
  };

  if (rec.paths && rec.paths.length > 0) {
    const pages = rec.paths.slice(0, 6).map((p) => {
      const c = contents.get(p.path);
      return { path: p.path, title: c?.title ?? null, wordCount: c?.wordCount ?? null };
    });
    return { ...base, scope: "template-level", pagesAffected: pages };
  }

  const c = rec.path ? contents.get(rec.path) : undefined;
  if (!c) return base;

  return {
    ...base,
    page: {
      path: c.path,
      title: c.title,
      currentMeta: c.metaDescription,
      wordCount: c.wordCount,
      headings: c.headings.filter((h) => h.level <= 2).slice(0, 8).map((h) => `${"##".repeat(h.level - 1)} ${h.text}`),
      searchQueries: (queriesByPath.get(c.path) ?? []).slice(0, 5),
    },
  };
}

export async function POST(req: NextRequest) {
  const session = await auth();
  const accessToken = session?.access_token;
  const userId = session?.user?.id;
  if (!accessToken || !userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!aiEnabled()) {
    return NextResponse.json(
      { error: "AI copilot is not configured. Add GROQ_API_KEY to .env.local and restart." },
      { status: 400 }
    );
  }

  const site = req.nextUrl.searchParams.get("site");
  if (!site) {
    return NextResponse.json({ error: "missing site param" }, { status: 400 });
  }

  try {
    const { inputs } = await loadRuleInputs(userId, site, accessToken);
    const recommendations = generateRecommendations(inputs);

    const { rec_enhancements } = await getCollections();
    const cached = await rec_enhancements
      .find({ userId, siteUrl: site })
      .toArray();
    const cacheMap = new Map(cached.map((c) => [c.recId, c]));

    const contentsByPath = new Map(inputs.contents.map((c) => [c.path, c]));
    const queriesByPath = new Map<string, { query: string; impressions: number; position: number }[]>();
    for (const q of inputs.pageQueries) {
      const list = queriesByPath.get(q.path) ?? [];
      list.push({ query: q.query, impressions: q.impressions, position: q.position });
      queriesByPath.set(q.path, list);
    }

    const pending: { rec: Rec; evidence: Evidence; fingerprint: string }[] = [];
    let alreadyCached = 0;

    for (const rec of recommendations) {
      const evidence = buildEvidence(rec, contentsByPath, queriesByPath);
      const fingerprint = createHash("sha1").update(JSON.stringify(evidence)).digest("hex");
      const hit = cacheMap.get(rec.id);
      if (hit && hit.fingerprint === fingerprint) {
        alreadyCached++;
        continue;
      }
      pending.push({ rec, evidence, fingerprint });
    }

    const batch = pending.slice(0, BATCH_SIZE);

    if (batch.length > 0) {
      const topics = batch
        .map((b) => `${b.rec.title} ${b.rec.detail} ${b.rec.action}`)
        .join(" ");
      const system = buildSystemPrompt(topics);
      const userPayload = JSON.stringify({ findings: batch.map((b) => b.evidence) }, null, 1);

      const result = await chatJSON<{ enhancements?: Enhancement[] }>(system, userPayload);
      const valid = new Map<string, Enhancement>(
        (result.enhancements ?? [])
          .filter((e) => e.id && typeof e.why === "string" && Array.isArray(e.steps))
          .map((e) => [e.id, e])
      );

      const now = new Date();
      for (const { rec, fingerprint } of batch) {
        const e = valid.get(rec.id);
        if (!e) continue;
        await rec_enhancements.updateOne(
          { userId, siteUrl: site, recId: rec.id },
          {
            $set: {
              fingerprint,
              why: e.why.slice(0, 1200),
              steps: e.steps.slice(0, 4).map((s) => String(s).slice(0, 400)),
              draftTitle: e.draftTitle ?? null,
              draftMeta: e.draftMeta ?? null,
              updatedAt: now,
            },
          },
          { upsert: true }
        );
      }
    }

    return NextResponse.json({
      enhanced: batch.length,
      alreadyCached,
      pending: Math.max(pending.length - batch.length, 0),
    });
  } catch (err) {
    console.error("[/api/recommendations/enhance] error:", err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
