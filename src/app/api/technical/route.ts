import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { getCollections } from "@/lib/db";
import { fetchTopPages, gscWindow } from "@/lib/gsc";
import { normalizePath } from "@/lib/url";

type CruxMetric = {
  percentiles?: { p75?: number };
  histogram?: { start?: number; end?: number; density?: number }[];
};

type CruxKey = "largest_contentful_paint" | "interaction_to_next_paint" | "cumulative_layout_shift";

function percentile(metric: CruxMetric | undefined): number | null {
  if (typeof metric?.percentiles?.p75 === "number") return metric.percentiles.p75;
  if (!metric?.histogram) return null;
  let cum = 0;
  for (const b of metric.histogram) {
    cum += b.density ?? 0;
    if (cum >= 0.75) return b.start ?? null;
  }
  return null;
}

function rating(value: number | null, good: number, poor: number): "good" | "needs" | "poor" | null {
  if (value === null) return null;
  if (value <= good) return "good";
  if (value <= poor) return "needs";
  return "poor";
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
  const days = Math.min(Math.max(Number(req.nextUrl.searchParams.get("days") ?? 28), 1), 90);

  try {
    const [metricRows, { page_content }] = await Promise.all([
      fetchTopPages({ site, accessToken, days, limit: 20 }),
      getCollections(),
    ]);

    let origin: string | null = null;
    try {
      const raw = site.replace(/^sc-domain:/, "");
      const asUrl = raw.includes("://") ? raw : `https://${raw}`;
      origin = new URL(asUrl).origin;
    } catch {
      origin = null;
    }

    const paths = metricRows.map((r) => normalizePath(r.key));
    const docs = paths.length
      ? await page_content
          .find({ userId, siteUrl: site, path: { $in: paths } })
          .project({
            path: 1,
            httpStatus: 1,
            title: 1,
            metaDescription: 1,
            canonical: 1,
            wordCount: 1,
            structuredData: 1,
          })
          .toArray()
      : [];
    const contentByPath = new Map(docs.map((d) => [d.path, d]));

    const cruxKey = process.env.CRUX_API_KEY?.trim();

    async function cruxFor(url: string, formFactor: "PHONE" | "DESKTOP"): Promise<Record<CruxKey, number | null> | null> {
      if (!cruxKey) return null;
      const res = await fetch(`https://chromeuxreport.googleapis.com/v1/records:queryRecord?key=${encodeURIComponent(cruxKey)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, formFactor }),
      });
      if (!res.ok) return null;
      const j = (await res.json()) as {
        record?: { metrics?: Record<string, CruxMetric> };
      };
      const m = j.record?.metrics ?? {};
      return {
        largest_contentful_paint: percentile(m.largest_contentful_paint),
        interaction_to_next_paint: percentile(m.interaction_to_next_paint),
        cumulative_layout_shift: percentile(m.cumulative_layout_shift),
      };
    }

    const result = await Promise.allSettled(
      metricRows.map(async (r) => {
        const path = normalizePath(r.key);
        const c = contentByPath.get(path);
        const fullUrl = origin ? `${origin}${c?.canonical ?? path}` : r.key;

        const [phone, desktop] = await Promise.all([
          fullUrl ? cruxFor(fullUrl, "PHONE") : Promise.resolve(null),
          fullUrl ? cruxFor(fullUrl, "DESKTOP") : Promise.resolve(null),
        ]);

        const crux = {
          lcp: Math.max(phone?.largest_contentful_paint ?? 0, desktop?.largest_contentful_paint ?? 0) || null,
          inp: Math.max(phone?.interaction_to_next_paint ?? 0, desktop?.interaction_to_next_paint ?? 0) || null,
          cls: Math.max(phone?.cumulative_layout_shift ?? 0, desktop?.cumulative_layout_shift ?? 0) || null,
        };
        const hasCrux = crux.lcp !== null || crux.inp !== null || crux.cls !== null;

        const issues: { id: string; label: string }[] = [];
        if (c) {
          if (c.httpStatus !== 200) issues.push({ id: "http", label: `HTTP ${c.httpStatus}` });
          if (!c.title) issues.push({ id: "title-missing", label: "Missing <title>" });
          else if (c.title.length > 62) issues.push({ id: "title-long", label: `Title ${c.title.length} chars` });
          if (!c.metaDescription) issues.push({ id: "meta-missing", label: "Missing meta description" });
          else if (c.metaDescription.length > 160)
            issues.push({ id: "meta-long", label: "Meta >160 chars" });
          if (!c.canonical) issues.push({ id: "canonical-missing", label: "Missing canonical" });
          else if (c.canonical !== path)
            issues.push({ id: "canonical-mismatch", label: `Canonical → ${c.canonical}` });
          if (c.wordCount < 350) issues.push({ id: "thin", label: `Thin (${c.wordCount} words)` });
          if (c.structuredData.length === 0) issues.push({ id: "schema-missing", label: "No structured data" });
        } else {
          issues.push({ id: "uncrawled", label: "Not crawled yet" });
        }

        const schemas: string[] = [];
        for (const sd of c?.structuredData ?? []) {
          if (typeof sd !== "object" || sd === null) continue;
          const rec = sd as Record<string, unknown>;
          const types = Array.isArray(rec["@type"]) ? (rec["@type"] as unknown[]) : [rec["@type"]];
          for (const t of types) if (typeof t === "string" && t !== "@context" && !schemas.includes(t)) schemas.push(t);
        }
        if (schemas.length === 0 && !issues.some((i) => i.id === "schema-missing")) {
          schemas.push("none");
        }

        return {
          path,
          title: c?.title ?? null,
          httpStatus: c?.httpStatus ?? null,
          clicks: r.clicks,
          impressions: r.impressions,
          position: r.position,
          issues,
          schemas,
          crux: hasCrux ? crux : null,
        };
      })
    );

    const pages = result.map((r) => (r.status === "fulfilled" ? r.value : null)).filter((p): p is NonNullable<typeof p> => p !== null);

    const withCrux = pages.filter((p) => p.crux).length;
    const goodCwv = pages.filter((p) => {
      if (!p.crux) return false;
      const r = { lcp: rating(p.crux.lcp, 2500, 4000), inp: rating(p.crux.inp, 200, 500), cls: rating(p.crux.cls, 0.1, 0.25) };
      return r.lcp === "good" && r.inp === "good" && r.cls === "good";
    }).length;
    const withIssues = pages.filter((p) => p.issues.length > 0).length;

    return NextResponse.json({
      site,
      range: gscWindow(days),
      configured: Boolean(cruxKey),
      pages,
      summary: {
        analyzed: pages.length,
        withCrux,
        goodCwv,
        withIssues,
      },
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "failed to build technical report" },
      { status: 500 }
    );
  }
}