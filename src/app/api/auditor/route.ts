import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/lib/auth";

type PsiError = {
  error?: {
    status?: string;
    message?: string;
    details?: { reason?: string }[];
  };
};

type PsiResult =
  | { status: "ok"; json: Record<string, unknown> }
  | { status: "disabled"; message: string }
  | { status: "error"; message: string };

const CATEGORIES = ["performance", "accessibility", "best-practices", "seo"] as const;

async function callPsi(url: string, strategy: "mobile" | "desktop", key: string, category: string): Promise<PsiResult> {
  const endpoint = new URL("https://www.googleapis.com/pagespeedonline/v5/runPagespeed");
  endpoint.searchParams.set("url", url);
  endpoint.searchParams.set("strategy", strategy);
  endpoint.searchParams.set("category", category.toUpperCase());
  endpoint.searchParams.set("key", key);

  const res = await fetch(endpoint.toString(), { signal: AbortSignal.timeout(120_000) });
  if (!res.ok) {
    let err: PsiError = {};
    try {
      err = (await res.json()) as PsiError;
    } catch {
      err = {};
    }
    const disabled =
      res.status === 403 ||
      err.error?.status === "PERMISSION_DENIED" ||
      err.error?.details?.some((d) => d.reason === "SERVICE_DISABLED");
    if (disabled) {
      return { status: "disabled", message: err.error?.message ?? "PageSpeed Insights API is not enabled for this key." };
    }
    return { status: "error", message: err.error?.message ?? `PageSpeed API returned HTTP ${res.status}` };
  }
  return { status: "ok", json: (await res.json()) as Record<string, unknown> };
}

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const sp = req.nextUrl.searchParams;
  const url = sp.get("url")?.trim();
  const strategy = sp.get("strategy") === "desktop" ? "desktop" : "mobile";

  if (!url) {
    return NextResponse.json({ error: "missing url" }, { status: 400 });
  }
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return NextResponse.json({ error: "invalid url" }, { status: 400 });
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    return NextResponse.json({ error: "url must be http(s)" }, { status: 400 });
  }

  const psiKey = process.env.GOOGLE_API_KEY?.trim() || process.env.CRUX_API_KEY?.trim();
  if (!psiKey) {
    return NextResponse.json(
      { keyMissing: true, error: "No Google API key configured (GOOGLE_API_KEY or CRUX_API_KEY)." },
      { status: 200 }
    );
  }

  try {
    const results = await Promise.allSettled(
      CATEGORIES.map((c) => callPsi(parsed.toString(), strategy, psiKey, c))
    );
    const ok = results
      .filter((r): r is PromiseFulfilledResult<PsiResult> => r.status === "fulfilled" && r.value.status === "ok")
      .map((r) => (r.value as { status: "ok"; json: Record<string, unknown> }).json);
    const disabled = results.some(
      (r): r is PromiseFulfilledResult<PsiResult> => r.status === "fulfilled" && r.value.status === "disabled"
    );
    const errors = results
      .filter((r): r is PromiseFulfilledResult<PsiResult> => r.status === "fulfilled" && r.value.status === "error")
      .map((r) => (r.value as { status: "error"; message: string }).message)
      .concat(
        results.filter((r) => r.status === "rejected").map((r) => (r as PromiseRejectedResult).reason?.message ?? "request failed")
      );

    if (ok.length === 0) {
      if (disabled) {
        return NextResponse.json(
          {
            disabled: true,
            error: "PageSpeed Insights API is not enabled for this API key.",
          },
          { status: 200 }
        );
      }
      return NextResponse.json({ error: errors[0] ?? "PageSpeed audit failed" }, { status: 502 });
    }

    const mergedCategories: Record<string, unknown> = {};
    const mergedAudits: Record<string, unknown> = {};
    const mergedGroups: Record<string, unknown> = {};
    let requestedUrl: string | null = null;
    let finalUrl: string | null = null;
    let fetchTime: string | null = null;
    let loadingExperience: unknown = null;
    let originLoadingExperience: unknown = null;

    for (const j of ok) {
      const lh = j.lighthouseResult as Record<string, unknown> | undefined;
      if (lh) {
        Object.assign(mergedCategories, lh.categories ?? {});
        Object.assign(mergedAudits, lh.audits ?? {});
        Object.assign(mergedGroups, lh.categoryGroups ?? {});
        if (!fetchTime && typeof lh.fetchTime === "string") fetchTime = lh.fetchTime;
      }
      if (!requestedUrl && typeof j.requestedUrl === "string") requestedUrl = j.requestedUrl;
      if (!finalUrl && typeof j.finalUrl === "string") finalUrl = j.finalUrl;
      if (!loadingExperience && j.loadingExperience) loadingExperience = j.loadingExperience;
      if (!originLoadingExperience && j.originLoadingExperience) originLoadingExperience = j.originLoadingExperience;
    }

    return NextResponse.json({
      requestedUrl,
      finalUrl,
      fetchTime,
      loadingExperience,
      originLoadingExperience,
      lighthouseResult: {
        categories: mergedCategories,
        categoryGroups: mergedGroups,
        audits: mergedAudits,
        fetchTime,
      },
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "failed to run PageSpeed audit" },
      { status: 500 }
    );
  }
}