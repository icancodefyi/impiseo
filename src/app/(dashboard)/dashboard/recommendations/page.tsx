"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  IconAlertTriangle,
  IconChartBar,
  IconChevronRight,
  IconFileText,
  IconSearch,
  IconSparkles,
  IconSpider,
} from "@tabler/icons-react";
import { useDashboard } from "@/lib/dashboard-context";
import { encodeRecId } from "@/lib/rec-id";
import { ErrorBanner, Loader, SiteControls } from "@/components/widgets";

type AiEnhancement = {
  why: string;
  steps: string[];
};

type Rec = {
  id: string;
  type: string;
  severity: "high" | "medium" | "low";
  path: string | null;
  title: string;
  detail: string;
  count?: number;
  paths?: { path: string; impressions: number }[];
  ai?: AiEnhancement | null;
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
            href="/dashboard/site-pages"
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
            {data.recs.length} issues found across {data.pagesCrawled} crawled pages · click one for the full fix plan
          </p>
          <div className="divide-y divide-zinc-800/70 overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900">
            {data.recs.map((r) => {
              const Icon = TYPE_ICON[r.type] ?? IconAlertTriangle;
              const scope =
                r.count !== undefined ? `${r.count} pages affected` : r.path ?? "";
              return (
                <Link
                  key={r.id}
                  href={`/recommendations/${encodeRecId(r.id)}?site=${encodeURIComponent(site!)}`}
                  className="flex items-center gap-3 px-4 py-3.5 transition hover:bg-zinc-800/40"
                >
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-zinc-800/80">
                    <Icon size={15} stroke={1.75} className="text-zinc-400" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className="truncate text-sm font-medium tracking-tight text-zinc-200">{r.title}</span>
                      {r.ai && <IconSparkles size={13} stroke={1.75} className="shrink-0 text-emerald-400" />}
                    </span>
                    <span className="mt-0.5 block truncate text-xs text-zinc-500">{r.detail}</span>
                    {scope && <span className="mt-0.5 block truncate text-[0.6875rem] text-zinc-600">{scope}</span>}
                  </span>
                  <span
                    className={`shrink-0 rounded-md px-2 py-0.5 text-[0.625rem] font-semibold uppercase tracking-wide ${SEVERITY_STYLE[r.severity]}`}
                  >
                    {r.severity}
                  </span>
                  <IconChevronRight size={16} stroke={1.75} className="shrink-0 text-zinc-600" />
                </Link>
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
