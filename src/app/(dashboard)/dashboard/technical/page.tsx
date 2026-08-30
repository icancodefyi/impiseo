"use client";

import { useEffect, useState } from "react";
import { useDashboard } from "@/lib/dashboard-context";
import { ErrorBanner, Loader, PageHeader } from "@/components/widgets";
import { nf } from "@/components/widgets";
import { TechFixModal } from "@/components/tech-fix-modal";

type CruxValues = { lcp: number | null; inp: number | null; cls: number | null };

type TechPage = {
  path: string;
  title: string | null;
  httpStatus: number | null;
  clicks: number;
  impressions: number;
  position: number;
  issues: { id: string; label: string }[];
  schemas: string[];
  crux: CruxValues | null;
};

type TechResponse = {
  configured: boolean;
  pages: TechPage[];
  summary: {
    analyzed: number;
    withCrux: number;
    goodCwv: number;
    withIssues: number;
  };
};

function rating(value: number | null, good: number, poor: number) {
  if (value === null) return null;
  if (value <= good) return "good";
  if (value <= poor) return "needs";
  return "poor";
}

const STYLE: Record<string, string> = {
  good: "bg-emerald-500/10 text-emerald-400",
  needs: "bg-amber-500/10 text-amber-400",
  poor: "bg-red-500/10 text-red-300",
};

function CruxBadge({ label, value, fmt }: { label: string; value: number | null; fmt: (v: number) => string }) {
  const r = rating(value, label === "CLS" ? 0.1 : label === "LCP" ? 2500 : 200, label === "CLS" ? 0.25 : label === "LCP" ? 4000 : 500);
  if (r === null) return null;
  return (
    <span
      className={`inline-block rounded-md px-1.5 py-0.5 text-[11px] font-medium tabular-nums ${STYLE[r]}`}
      title={value === null ? "no data" : `${label}: ${fmt(value)}`}
    >
      {label} {value === null ? "–" : fmt(value)}
    </span>
  );
}

function fmtMs(v: number) {
  return v >= 1000 ? `${(v / 1000).toFixed(2)}s` : `${Math.round(v)}ms`;
}

export default function TechnicalPage() {
  const { site, days, stats, loading } = useDashboard();

  const [data, setData] = useState<TechResponse | null>(null);
  const [error, setError] = useState("");
  const [fixingPath, setFixingPath] = useState<string | null>(null);

  useEffect(() => {
    if (!site) return;
    let cancelled = false;
    fetch(`/api/technical?site=${encodeURIComponent(site)}&days=${days}`)
      .then(async (res) => {
        if (!res.ok) throw new Error((await res.json()).error ?? `HTTP ${res.status}`);
        return res.json();
      })
      .then((j: TechResponse) => {
        if (cancelled) return;
        setData(j);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      });
    return () => {
      cancelled = true;
    };
  }, [site, days]);

  if (!stats && loading) return <Loader label="Fetching Search Console data…" />;

  const s = data?.summary;
  return (
    <div className="space-y-5">
      <PageHeader
        title="Technical SEO"
        subtitle={`Core Web Vitals (CrUX) + indexability & schema for your top pages · last ${days} days`}
      />

      {!data?.configured && data && (
        <div className="rounded-lg border border-amber-500/25 bg-amber-500/[0.07] px-4 py-3 text-sm leading-relaxed text-amber-200/90">
          CrUX isn&apos;t configured — add a Google Chrome UX Report API key as <code className="rounded bg-surface-2 px-1.5 py-0.5">CRUX_API_KEY</code> in{" "}
          <code className="rounded bg-surface-2 px-1.5 py-0.5">.env.local</code> to see Core Web Vitals. Indexability & schema
          diagnostics below work without it.
        </div>
      )}

      {s && (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <div className="rounded-xl border border-hairline bg-surface-1 p-6">
            <p className="eyebrow">Pages analyzed</p>
            <p className="mt-2.5 text-[1.875rem] font-semibold leading-none tracking-[-0.02em] tabular-nums text-ink">
              {s ? nf.format(s.analyzed) : "…"}
            </p>
          </div>
          <div className="rounded-xl border border-hairline bg-surface-1 p-6">
            <p className="eyebrow">With CrUX data</p>
            <p className="mt-2.5 text-[1.875rem] font-semibold leading-none tracking-[-0.02em] tabular-nums text-ink">
              {s ? nf.format(s.withCrux) : "…"}
            </p>
          </div>
          <div className="rounded-xl border border-hairline bg-surface-1 p-6">
            <p className="eyebrow">Good CWV</p>
            <p className="mt-2.5 text-[1.875rem] font-semibold leading-none tracking-[-0.02em] tabular-nums text-ink">
              {s ? nf.format(s.goodCwv) : "…"}
            </p>
          </div>
          <div className="rounded-xl border border-hairline bg-surface-1 p-6">
            <p className="eyebrow">Pages with issues</p>
            <p className="mt-2.5 text-[1.875rem] font-semibold leading-none tracking-[-0.02em] tabular-nums text-ink">
              {s ? nf.format(s.withIssues) : "…"}
            </p>
          </div>
        </div>
      )}

      {error && <ErrorBanner message={error} />}

      <div className="overflow-hidden rounded-xl border border-hairline bg-surface-1">
        <h2 className="section-title border-b border-hairline px-6 py-4">Top pages · technical health</h2>
        <div className="overflow-auto">
          <table className="w-full min-w-[900px] text-sm">
            <thead className="sticky top-0 z-[1] bg-surface-1 text-left">
              <tr>
                <th className="eyebrow px-6 pb-3 pt-3.5 text-left font-medium">Page</th>
                <th className="eyebrow px-4 pb-3 pt-3.5 text-left font-medium">Search</th>
                <th className="eyebrow px-4 pb-3 pt-3.5 text-left font-medium">Core Web Vitals</th>
                <th className="eyebrow px-4 pb-3 pt-3.5 text-left font-medium">Issues</th>
                <th className="eyebrow px-6 pb-3 pt-3.5 text-left font-medium">Schema</th>
              </tr>
            </thead>
            <tbody>
              {data && data.pages.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-10 text-center text-sm text-ink-subtle">
                    No pages to analyze
                  </td>
                </tr>
              )}
              {data?.pages.map((p) => (
                <tr key={p.path} className="border-t border-hairline-tertiary transition-colors hover:bg-surface-2/60">
                  <td className="max-w-[280px] px-6 py-3 align-top">
                    <p className="truncate font-medium text-ink" title={p.path}>
                      {p.path}
                    </p>
                    {p.title && <p className="mt-0.5 line-clamp-1 text-xs text-ink-tertiary">{p.title}</p>}
                    {p.issues.length > 0 && (
                      <button
                        onClick={() => setFixingPath(p.path)}
                        className="mt-1.5 cursor-pointer rounded-md border border-hairline bg-surface-2 px-2 py-1 text-xs font-medium text-ink-subtle transition-colors hover:border-primary hover:text-ink"
                      >
                        Fix ({p.issues.length})
                      </button>
                    )}
                  </td>
                  <td className="px-4 py-3 align-top text-sm tabular-nums text-ink-subtle">
                    <p className="text-ink">
                      {nf.format(p.clicks)} clicks
                    </p>
                    <p className="text-xs">{nf.format(p.impressions)} Impr · #{p.position.toFixed(1)}</p>
                  </td>
                  <td className="px-4 py-3 align-top">
                    {p.crux ? (
                      <div className="flex flex-wrap gap-1">
                        <CruxBadge label="LCP" value={p.crux.lcp} fmt={fmtMs} />
                        <CruxBadge label="INP" value={p.crux.inp} fmt={fmtMs} />
                        <CruxBadge label="CLS" value={p.crux.cls} fmt={(v) => v.toFixed(2)} />
                      </div>
                    ) : data.configured ? (
                      <span className="text-xs text-ink-tertiary">No CrUX data yet</span>
                    ) : (
                      <span className="text-xs text-ink-tertiary">–</span>
                    )}
                  </td>
                  <td className="max-w-[260px] px-4 py-3 align-top">
                    {p.issues.length === 0 ? (
                      <span className="text-xs text-ink-tertiary">No issues</span>
                    ) : (
                      <div className="flex flex-wrap gap-1">
                        {p.issues.map((i) => (
                          <span
                            key={i.id}
                            className={`rounded-md px-1.5 py-0.5 text-[11px] font-medium ${
                              i.id === "uncrawled" ? "bg-surface-4 text-ink-subtle" : "bg-red-500/10 text-red-300"
                            }`}
                            title={i.label}
                          >
                            {i.label}
                          </span>
                        ))}
                      </div>
                    )}
                  </td>
                  <td className="max-w-[200px] px-6 py-3 align-top">
                    <div className="flex flex-wrap gap-1">
                      {p.schemas.map((sc) => (
                        <span
                          key={sc}
                          className={
                            sc === "none"
                              ? "inline-block rounded-md bg-surface-4 px-1.5 py-0.5 text-[11px] font-medium text-ink-subtle"
                              : "inline-block rounded-md bg-sky-500/10 px-1.5 py-0.5 text-[11px] font-medium text-sky-300"
                          }
                        >
                          {sc}
                        </span>
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-xs leading-relaxed text-ink-tertiary">
        CrUX reflects real Chrome user behavior over the last 28 days at the URL&apos;s 75th percentile (worst of phone/desktop),
        via the free Chrome UX Report API. Thresholds: LCP ≤ 2.5s, INP ≤ 200ms, CLS ≤ 0.1. &quot;Good CWV&quot; = all three pass.
      </p>

      {fixingPath &&
        (() => {
          const page = data?.pages.find((p) => p.path === fixingPath);
          if (!page || page.issues.length === 0) return null;
          return (
            <TechFixModal
              pagePath={page.path}
              issues={page.issues}
              site={site!}
              days={days}
              onClose={() => setFixingPath(null)}
            />
          );
        })()}
    </div>
  );
}