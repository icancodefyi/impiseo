"use client";

import Link from "next/link";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { IconPlugConnected } from "@tabler/icons-react";
import { useDashboard } from "@/lib/dashboard-context";
import { ErrorBanner, KpiCard, Loader, PageHeader } from "@/components/widgets";

const nf = new Intl.NumberFormat("en-US");
const compact = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 });

function shortDate(iso: string) {
  const d = new Date(`${iso}T00:00:00`);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function pctChange(cur: number, prev: number) {
  if (!prev) return null;
  return (cur - prev) / prev;
}

function fmtPct(v: number) {
  return `${(v * 100).toFixed(1)}%`;
}

function fmtPos(v: number) {
  return v ? v.toFixed(1) : "–";
}

export default function OverviewPage() {
  const { stats, phStats, loading, error, days } = useDashboard();

  if (!stats && loading) return <Loader label="Fetching Search Console data…" />;

  const t = stats?.totals;
  const p = stats?.prevTotals;

  return (
    <div className="space-y-4">
      <PageHeader
        title="Overview"
        subtitle={`${shortDate(stats?.range.start ?? "")} – ${shortDate(stats?.range.end ?? "")} vs previous period`}
      />

      {error && <ErrorBanner message={error} />}

      {!t && !loading && (
        <div className="mt-10 rounded-xl border border-dashed border-hairline bg-surface-1/40 px-6 py-12 text-center">
          <p className="text-sm text-ink-subtle">No Search Console data yet for this site.</p>
          <Link href="/integrations" className="mt-3 inline-block text-sm font-medium text-primary-hover hover:text-ink">
            Check integrations →
          </Link>
        </div>
      )}

      {t && p && (
        <>
          <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <KpiCard label="Clicks" value={nf.format(t.clicks)} delta={pctChange(t.clicks, p.clicks)} />
            <KpiCard label="Impressions" value={nf.format(t.impressions)} delta={pctChange(t.impressions, p.impressions)} />
            <KpiCard label="CTR" value={fmtPct(t.ctr)} delta={pctChange(t.ctr, p.ctr)} />
            <KpiCard label="Avg. position" value={fmtPos(t.position)} delta={pctChange(t.position, p.position)} invertDelta />
          </section>

          <section className="rounded-xl border border-hairline bg-surface-1 p-5">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-[0.8125rem] font-semibold tracking-tight text-ink">Performance</h2>
              <p className="text-xs text-ink-tertiary">last {days} days</p>
            </div>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={stats!.series} margin={{ top: 4, right: 4, bottom: 0, left: -18 }}>
                  <defs>
                    <linearGradient id="impGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#828fff" stopOpacity={0.30} />
                      <stop offset="100%" stopColor="#818cf8" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="clkGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#27a644" stopOpacity={0.28} />
                      <stop offset="100%" stopColor="#34d399" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="#23252a" strokeDasharray="3 3" vertical={false} />
                  <XAxis
                    dataKey="date"
                    tickFormatter={shortDate}
                    tick={{ fill: "#62666d", fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                    minTickGap={28}
                  />
                  <YAxis yAxisId="left" tick={{ fill: "#62666d", fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v: number) => compact.format(v)} />
                  <YAxis yAxisId="right" orientation="right" tick={{ fill: "#62666d", fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v: number) => compact.format(v)} />
                  <Tooltip
                    contentStyle={{ background: "#1b1d22", border: "1px solid #2f3238", borderRadius: 8, fontSize: 12 }}
                    labelStyle={{ color: "#8a8f98" }}
                    labelFormatter={(l) => shortDate(String(l))}
                  />
                  <Area yAxisId="right" type="monotone" dataKey="impressions" name="Impressions" stroke="#828fff" strokeWidth={2} fill="url(#impGrad)" />
                  <Area yAxisId="left" type="monotone" dataKey="clicks" name="Clicks" stroke="#2eb85c" strokeWidth={2} fill="url(#clkGrad)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </section>

          {phStats?.connected && phStats.totals ? (
            <section className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-hairline bg-surface-1 px-5 py-4">
              <div>
                <h2 className="text-[0.8125rem] font-semibold tracking-tight text-ink">Product analytics</h2>
                <p className="mt-0.5 text-xs text-ink-tertiary">PostHog · last {days} days · full breakdown on Pages</p>
              </div>
              <div className="flex gap-8">
                <div>
                  <p className="text-[0.6875rem] font-medium uppercase tracking-[0.08em] text-ink-tertiary">Visitors</p>
                  <p className="text-lg font-semibold leading-tight tabular-nums text-ink">{nf.format(phStats.totals.visitors)}</p>
                </div>
                <div>
                  <p className="text-[0.6875rem] font-medium uppercase tracking-[0.08em] text-ink-tertiary">Pageviews</p>
                  <p className="text-lg font-semibold leading-tight tabular-nums text-ink">{nf.format(phStats.totals.pageviews)}</p>
                </div>
              </div>
            </section>
          ) : (
            <section className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-dashed border-hairline bg-surface-1/40 px-5 py-4">
              <p className="flex items-center gap-2 text-sm text-ink-subtle">
                <IconPlugConnected size={16} className="shrink-0 text-ink-tertiary" />
                Connect PostHog to see what visitors do after they arrive from search.
              </p>
              <Link
                href="/integrations"
                className="rounded-lg bg-primary px-3.5 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-hover"
              >
                Connect PostHog
              </Link>
            </section>
          )}
        </>
      )}
    </div>
  );
}
