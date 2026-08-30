import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { aiEnabled, chatJSON } from "@/lib/ai/client";
import { getCollections } from "@/lib/db";
import { fetchPageQueries } from "@/lib/gsc";
import { normalizePath } from "@/lib/url";

type ContentIssue = { id: string; label: string };

function originFor(site: string): string | null {
  try {
    const raw = site.replace(/^sc-domain:/, "");
    const asUrl = raw.includes("://") ? raw : `https://${raw}`;
    return new URL(asUrl).origin;
  } catch {
    return null;
  }
}

function brandFor(site: string): string {
  const origin = originFor(site);
  let host = origin?.replace("https://", "").replace("http://", "").split(":")[0] ?? site;
  host = host.replace(/^www\./, "");
  const parts = host.split(".");
  const core = parts[parts.length - 2] ?? host;
  if (core.length < 3) return host;
  return core.charAt(0).toUpperCase() + core.slice(1);
}

function truncateWords(text: string, n: number): string {
  return text.split(/\s+/).slice(0, n).join(" ");
}

export async function GET(req: NextRequest) {
  const session = await auth();
  const accessToken = session?.access_token;
  const userId = session?.user?.id;
  if (!accessToken || !userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const sp = req.nextUrl.searchParams;
  const site = sp.get("site");
  const rawPath = sp.get("path");
  if (!site || !rawPath) {
    return NextResponse.json({ error: "missing site or path" }, { status: 400 });
  }
  const path = normalizePath(rawPath);
  const days = Math.min(Math.max(Number(sp.get("days") ?? 28), 1), 90);

  try {
    const origin = originFor(site);
    const { page_content } = await getCollections();
    const c = await page_content.findOne({ userId, siteUrl: site, path });
    const url = origin ? `${origin}${path}` : null;

    let topQueries: { query: string; impressions: number; position: number }[] = [];
    if (url) {
      try {
        topQueries = (await fetchPageQueries({ site, accessToken, days, url, limit: 8 })).map(
          (q) => ({ query: q.key, impressions: q.impressions, position: q.position })
        );
      } catch {
        topQueries = [];
      }
    }

    const brand = brandFor(site);
    const primary = topQueries[0]?.query ?? null;

    const drafts: {
      draftTitle?: string | null;
      draftMeta?: string | null;
      canonicalTag?: string | null;
      schemaJson?: string | null;
      thinAdvice?: string | null;
    } = {};

    const title = c?.title ?? null;
    const meta = c?.metaDescription ?? null;
    if (!title || title.length > 62) {
      const base = primary ?? path.replace(/^\/|\/$/g, "").replace(/[-_]/g, " ");
      const withBrand = `${base} | ${brand}`.slice(0, 60);
      drafts.draftTitle = title ? withBrand : withBrand || null;
    }
    if (!meta || meta.length > 160) {
      const base = truncateWords(c?.textSample ?? "", 24);
      drafts.draftMeta = (primary && !base) || !meta
        ? `${primary ?? "Find out"} about ${path.replace(/^\/|\/$/g, "").replace(/[-_]/g, " ")} — explained simply`.slice(0, 158)
        : base.slice(0, 156);
    }
    if (origin) {
      drafts.canonicalTag = `<link rel="canonical" href="${origin}${path}" />`;
      drafts.schemaJson = JSON.stringify(
        {
          "@context": "https://schema.org",
          "@type": "Article",
          headline: title ?? drafts.draftTitle ?? primary ?? path,
          url: `${origin}${path}`,
          wordCount: c?.wordCount ?? null,
          datePublished: c?.fetchedAt?.toISOString().slice(0, 10) ?? null,
        },
        null,
        2
      );
    }
    if (c && c.wordCount < 350) {
      drafts.thinAdvice = `Page has ${c.wordCount} words (target 350+). Expand around the primary queries${primary ? `: "${primary}"` : ""} with a definitions section, worked examples, and a comparison table, then re-crawl.`;
    }

    return NextResponse.json({
      site,
      path,
      origin,
      url,
      crawled: Boolean(c),
      content: c
        ? {
            title: c.title,
            metaDescription: c.metaDescription,
            canonical: c.canonical,
            httpStatus: c.httpStatus,
            wordCount: c.wordCount,
            headings: c.headings.filter((h) => h.level <= 2).slice(0, 10).map((h) => h.text),
            structuredDataSet: Array.isArray(c.structuredData) && c.structuredData.length > 0,
          }
        : null,
      topQueries,
      brand,
      drafts,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "failed to prepare fix" },
      { status: 500 }
    );
  }
}

type Brief = { issueId: string; why: string; action: string; implementation: string; agentPrompt: string };

const SYSTEM = `You are a senior technical SEO engineer writing fix briefs for an AI coding agent.
You receive one page's factual crawled data (title, meta description, canonical, headings, word count, top search queries) and the list of issues detected on it (id + label).

For each issue produce a brief with:
- issueId: the exact issue id from the input.
- why: one short paragraph, grounded in THIS page's data, explaining the impact for this specific page.
- action: concrete fix in 1-3 sentences.
- implementation: ready-to-paste code (HTML tag, JSON-LD block, or exact text replacement). If it is a title or meta rewrite, output the exact final string.
- agentPrompt: a short instruction block telling an AI coding agent exactly what to change (LOCATE the file/string, WHAT to set it to verbatim, VERIFY that the rendered page shows the new value). Omit draftText unless it is a title or meta description.

Rules:
- Only output briefs for the issues given. Never invent new issues.
- Front-load the primary keyword in title/meta drafts, keep titles ≤60 chars, meta ≤155 chars.
- JSON-LD must be valid JSON. Never fabricate dates; use the provided page data.`;

export async function POST(req: NextRequest) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!aiEnabled()) {
    return NextResponse.json(
      { error: "AI copilot is not configured. Add GROQ_API_KEY to .env.local and restart." },
      { status: 400 }
    );
  }

  let body: { site?: string; path?: string; issues?: ContentIssue[]; content?: Record<string, unknown>; topQueries?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }

  const site = body.site?.trim();
  const path = normalizePath(body.path ?? "");
  const issues = (body.issues ?? []).filter((i) => i && i.id && i.label).slice(0, 8);
  if (!site || !path || issues.length === 0) {
    return NextResponse.json({ error: "missing site, path or issues" }, { status: 400 });
  }

  try {
    const user = JSON.stringify(
      {
        page: { path, ...body.content },
        topQueries: body.topQueries ?? [],
        issues: issues.map((i) => ({ id: i.id, label: i.label })),
      },
      null,
      1
    ).slice(0, 12000);

    const result = await chatJSON<{ briefs?: Brief[] }>(SYSTEM, user);
    const briefs = (result.briefs ?? [])
      .filter((b) => b && typeof b.issueId === "string")
      .slice(0, issues.length)
      .map((b) => ({
        issueId: b.issueId,
        why: String(b.why ?? "").slice(0, 800),
        action: String(b.action ?? "").slice(0, 600),
        implementation: String(b.implementation ?? "").slice(0, 3000),
        agentPrompt: String(b.agentPrompt ?? "").slice(0, 2000),
      }));

    return NextResponse.json({ briefs });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "failed to generate fix brief" },
      { status: 500 }
    );
  }
}