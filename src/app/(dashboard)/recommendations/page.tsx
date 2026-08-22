"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  IconAlertTriangle,
  IconChartBar,
  IconFileText,
  IconSearch,
  IconSpider,
} from "@tabler/icons-react";
import { useDashboard } from "@/lib/dashboard-context";
import { ErrorBanner, Loader, SiteControls } from "@/components/widgets";

type Rec = {
  id: string;
  type: string;
  severity: "high" | "medium" | "low";
  path: string | null;
  title: string;
  detail: string;
  action: string;
  count?: number;
  paths?: { path: string; impressions: number }[];
};

const TYPE_ICON: Record<string, typeof IconSearch> = {
  meta: IconFileText,
  title: IconFileText,
  structure: IconAlertTriangle,
  content: IconFileText,
  analytics: IconChartBar,
  keyword: IconSearch,
};

const SEVERITY_STYLE = {
  high: "bg-red-500/15 text-red-400",
  medium: "bg-amber-500/15 text-amber-400",
  low: "bg-zinc-700/40 text-zinc-400",
} as const;

type ReadyState = {
  ready: boolean;
  reason?: string;
  recs: Rec[];
  pagesCrawled?: number;
};

export default function RecommendationsPage() {
  const { site } = useDashboard();
  const [data, setData] = useState<ReadyState | null>(null);
  const [loadedSite, setLoadedSite] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!site) return;
    let cancelled = false;
    fetch(`/api/recommendations?site=${encodeURIComponent(site)}`)
      .then(async (res) => {
        if (!res.ok) throw new Error((await res.json()).error ?? `HTTP ${res.status}`);
        return res.json();
      })
      .then((d) => {
        if (!cancelled) {
          setError("");
          setData({ ready: d.ready, reason: d.reason, recs: d.recommendations ?? [], pagesCrawled: d.stats?.pagesCrawled });
          setLoadedSite(site);
        }
      })
      .catch((e) => {
        if (!cancelled) setError(e.message);
      });
    return () => {
      cancelled = true;
    };
  }, [site]);

  const loading = !site || site !== loadedSite || (!data && !error);

  if (loading) return <Loader label="Scanning your content…" />;
  if (error)
    return (
      <div className="space-y-4">
        <PageHeader />
        <ErrorBanner message={error} />
      </div>
    );
  if (!data) return null;

  return (
    <div className="space-y-4">
      <PageHeader />

      {!data.ready ? (
        <section className="rounded-xl border border-dashed border-zinc-800 bg-zinc-900/40 px-6 py-12 text-center">
          <IconSpider size={28} className="mx-auto text-zinc-600" stroke={1.5} />
          <p className="mt-3 max-w-md mx-auto text-sm leading-relaxed text-zinc-400">{data.reason}</p>
          <Link
            href="/site-pages"
            className="mt-4 inline-block rounded-lg bg-white px-4 py-2 text-sm font-medium text-zinc-900 transition hover:bg-zinc-200"
          >
            Go to Pages →
          </Link>
        </section>
      ) : data.recs.length === 0 ? (
        <section className="rounded-xl border border-emerald-900/50 bg-emerald-950/30 px-6 py-12 text-center">
          <p className="text-sm font-medium text-emerald-400">All clear 🎉</p>
          <p className="mt-2 text-sm text-zinc-400">
            No issues detected across {data.pagesCrawled} crawled pages. Re-run the crawl weekly to keep it that way.
          </p>
        </section>
      ) : (
        <>
          <p className="px-1 text-xs text-zinc-500">
            {data.recs.length} findings across {data.pagesCrawled} crawled pages · ranked by traffic impact
          </p>
          <div className="grid gap-3 lg:grid-cols-2">
            {data.recs.map((r) => {
              const Icon = TYPE_ICON[r.type] ?? IconAlertTriangle;
              return (
                <article key={r.id} className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <h2 className="flex items-start gap-2 text-sm font-medium leading-snug tracking-tight text-zinc-200">
                      <Icon size={16} stroke={1.75} className="mt-0.5 shrink-0 text-zinc-500" />
                      {r.title}
                    </h2>
                    <span
                      className={`shrink-0 rounded-md px-2 py-0.5 text-[0.625rem] font-semibold uppercase tracking-wide ${SEVERITY_STYLE[r.severity]}`}
                    >
                      {r.severity}
                    </span>
                  </div>
                  <p className="mt-2 text-xs leading-relaxed text-zinc-400">{r.detail}</p>
                  <p className="mt-2 text-xs leading-relaxed text-emerald-400/90">→ {r.action}</p>
                  {r.paths && r.paths.length > 0 && (
                    <div className="mt-2.5 space-y-1 border-t border-zinc-800/60 pt-2.5">
                      {r.paths.slice(0, 5).map((p) => (
                        <p key={p.path} className="truncate text-[0.6875rem] text-zinc-500" title={p.path}>
                          {p.path}
                        </p>
                      ))}
                      {r.count !== undefined && r.count > 5 && (
                        <p className="text-[0.6875rem] font-medium text-zinc-600">+{r.count - 5} more pages</p>
                      )}
                    </div>
                  )}
                  {!r.paths && r.path && (
                    <p className="mt-2.5 truncate border-t border-zinc-800/60 pt-2.5 text-[0.6875rem] text-zinc-500" title={r.path}>
                      {r.path}
                    </p>
                  )}
                </article>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

function PageHeader() {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-lg font-semibold tracking-tight">Recommendations</h1>
        <p className="mt-0.5 text-xs text-zinc-500">Deterministic fixes ranked by traffic impact</p>
      </div>
      <SiteControls />
    </div>
  );
}
