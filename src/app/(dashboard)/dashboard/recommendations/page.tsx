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
  high: "bg-red-500/10 text-red-400",
  medium: "bg-amber-500/10 text-amber-400",
  low: "bg-surface-4 text-ink-subtle",
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
        <section className="rounded-xl border border-dashed border-hairline bg-surface-1/40 px-6 py-12 text-center">
          <IconSpider size={28} className="mx-auto text-ink-tertiary" stroke={1.5} />
          <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-ink-subtle">{data.reason}</p>
          <Link
            href="/dashboard/site-pages"
            className="mt-4 inline-block rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-hover"
          >
            Go to Pages →
          </Link>
        </section>
      ) : data.recs.length === 0 ? (
        <section className="rounded-xl border border-success/30 bg-success/[0.06] px-6 py-12 text-center">
          <p className="text-sm font-medium text-emerald-400">All clear</p>
          <p className="mt-2 text-sm text-ink-subtle">
            No issues detected across {data.pagesCrawled} crawled pages. Re-run the crawl weekly to keep it that way.
          </p>
        </section>
      ) : (
        <>
          <p className="px-1 text-xs text-ink-tertiary">
            {data.recs.length} issues found across {data.pagesCrawled} crawled pages · click one for the full fix plan
          </p>
          <div className="divide-y divide-hairline-tertiary overflow-hidden rounded-xl border border-hairline bg-surface-1">
            {data.recs.map((r) => {
              const Icon = TYPE_ICON[r.type] ?? IconAlertTriangle;
              const scope =
                r.count !== undefined ? `${r.count} pages affected` : r.path ?? "";
              return (
                <Link
                  key={r.id}
                  href={`/dashboard/recommendations/${encodeRecId(r.id)}?site=${encodeURIComponent(site!)}`}
                  className="flex items-center gap-3 px-4 py-3.5 transition-colors hover:bg-surface-2/60"
                >
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-surface-3">
                    <Icon size={15} stroke={1.75} className="text-ink-subtle" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className="truncate text-sm font-medium tracking-tight text-ink">{r.title}</span>
                      {r.ai && <IconSparkles size={13} stroke={1.75} className="shrink-0 text-primary-hover" />}
                    </span>
                    <span className="mt-0.5 block truncate text-xs text-ink-subtle">{r.detail}</span>
                    {scope && <span className="mt-0.5 block truncate text-[0.6875rem] text-ink-tertiary">{scope}</span>}
                  </span>
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-[0.625rem] font-medium uppercase tracking-wide ${SEVERITY_STYLE[r.severity]}`}
                  >
                    {r.severity}
                  </span>
                  <IconChevronRight size={16} stroke={1.75} className="shrink-0 text-ink-tertiary" />
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
        <h1 className="text-lg font-semibold tracking-tight text-ink">Recommendations</h1>
        <p className="mt-0.5 text-xs text-ink-tertiary">Deterministic fixes ranked by traffic impact</p>
      </div>
      <SiteControls />
    </div>
  );
}
