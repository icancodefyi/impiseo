"use client";

import { signIn } from "next-auth/react";
import { useDashboard } from "@/lib/dashboard-context";
import type { MetricRow } from "@/lib/dashboard-context";

const nf = new Intl.NumberFormat("en-US");
export { nf };

function Delta({ value, invert = false }: { value: number | null; invert?: boolean }) {
  if (value === null || !isFinite(value)) return null;
  const good = invert ? value < 0 : value > 0;
  const color = Math.abs(value) < 0.005 ? "text-ink-tertiary" : good ? "text-emerald-400" : "text-red-400";
  const arrow = value > 0 ? "▲" : value < 0 ? "▼" : "";
  return (
    <span className={`text-xs font-medium ${color}`}>
      {arrow} {Math.abs(value * 100).toFixed(1)}%
    </span>
  );
}

function fmtPct(v: number) {
  return `${(v * 100).toFixed(1)}%`;
}

export function fmtPos(v: number) {
  return v ? v.toFixed(1) : "–";
}

export function posColor(pos: number) {
  if (pos <= 3) return "bg-emerald-500/10 text-emerald-400";
  if (pos <= 10) return "bg-amber-500/10 text-amber-400";
  if (pos <= 20) return "bg-orange-500/10 text-orange-400";
  return "bg-surface-4 text-ink-subtle";
}

export function KpiCard({
  label,
  value,
  delta,
  invertDelta = false,
}: {
  label: string;
  value: string;
  delta: number | null;
  invertDelta?: boolean;
}) {
  return (
    <div className="rounded-xl border border-hairline bg-surface-1 p-6">
      <p className="eyebrow">{label}</p>
      <div className="mt-2.5 flex items-baseline gap-2.5">
        <span className="text-[1.875rem] font-semibold leading-none tracking-[-0.02em] tabular-nums text-ink">{value}</span>
        <Delta value={delta} invert={invertDelta} />
      </div>
    </div>
  );
}

export function MetricTable({ title, rows, isPages }: { title: string; rows: MetricRow[]; isPages?: boolean }) {
  return (
    <div className="overflow-hidden rounded-xl border border-hairline bg-surface-1">
      <h2 className="section-title border-b border-hairline px-6 py-4">{title}</h2>
      <div className="max-h-[440px] overflow-auto">
        <table className="w-full min-w-[560px] text-sm">
          <thead className="sticky top-0 z-[1] bg-surface-1 text-left">
            <tr>
              <th className="eyebrow px-6 pb-3 pt-3.5 text-left font-medium">{isPages ? "Page" : "Query"}</th>
              <th className="eyebrow px-4 pb-3 pt-3.5 text-right font-medium">Clicks</th>
              <th className="eyebrow px-4 pb-3 pt-3.5 text-right font-medium">Impr.</th>
              <th className="eyebrow px-4 pb-3 pt-3.5 text-right font-medium">CTR</th>
              <th className="eyebrow px-6 pb-3 pt-3.5 text-right font-medium">Pos.</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={5} className="px-6 py-10 text-center text-sm text-ink-subtle">
                  No data for this period
                </td>
              </tr>
            )}
            {rows.map((r) => (
              <tr key={r.key} className="border-t border-hairline-tertiary transition-colors hover:bg-surface-2/60">
                <td className="max-w-[320px] truncate px-6 py-3 font-medium text-ink" title={r.key}>
                  {r.key || "(not provided)"}
                </td>
                <td className="px-4 py-3 text-right font-medium tabular-nums text-ink-muted">{nf.format(r.clicks)}</td>
                <td className="px-4 py-3 text-right tabular-nums text-ink-subtle">{nf.format(r.impressions)}</td>
                <td className="px-4 py-3 text-right tabular-nums text-ink-subtle">{fmtPct(r.ctr)}</td>
                <td className="px-6 py-3 text-right">
                  <span className={`inline-block rounded-md px-2 py-0.5 text-xs font-medium tabular-nums ${posColor(r.position)}`}>
                    {fmtPos(r.position)}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const RANGES = [
  { label: "1d", days: 1 },
  { label: "7d", days: 7 },
  { label: "28d", days: 28 },
  { label: "90d", days: 90 },
];

function prettySite(url: string) {
  return url.startsWith("sc-domain:") ? url.replace("sc-domain:", "") : url.replace(/^https?:\/\//, "").replace(/\/$/, "");
}

export function SiteControls() {
  const { sites, site, days, selectSite, selectRange } = useDashboard();
  return (
    <div className="flex flex-wrap items-center gap-2">
      {sites.length > 0 && (
        <select
          value={site}
          onChange={(e) => selectSite(e.target.value)}
          className="input-base cursor-pointer"
        >
          {sites.map((s) => (
            <option key={s.url} value={s.url}>
              {prettySite(s.url)}
            </option>
          ))}
        </select>
      )}
      <div className="flex rounded-lg border border-hairline bg-surface-1 p-1">
        {RANGES.map((r) => (
          <button
            key={r.days}
            onClick={() => selectRange(r.days)}
            className={`cursor-pointer rounded-md px-3 py-1.5 text-sm transition-colors ${
              days === r.days ? "bg-surface-3 font-medium text-ink" : "text-ink-subtle hover:text-ink-muted"
            }`}
          >
            {r.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export function PageHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
      <div>
        <h1 className="page-title">{title}</h1>
        <p className="page-subtitle">{subtitle}</p>
      </div>
      <SiteControls />
    </div>
  );
}

export function Loader({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="flex min-h-[50vh] items-center justify-center">
      <p className="animate-pulse text-sm text-ink-subtle">{label}</p>
    </div>
  );
}

export function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="rounded-lg border border-red-500/25 bg-red-500/[0.07] px-4 py-3 text-sm text-red-300">
      {message}
    </div>
  );
}

function BrandMark() {
  return (
    <span className="mx-auto flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-base font-bold text-white">
      I
    </span>
  );
}

export function SignInCard() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-canvas px-6">
      <div className="w-full max-w-sm rounded-xl border border-hairline bg-surface-1 p-8 text-center">
        <BrandMark />
        <h1 className="mt-5 text-[1.375rem] font-semibold tracking-[-0.015em] text-ink">Impiseo</h1>
        <p className="mt-2.5 text-[0.9375rem] leading-relaxed text-ink-subtle">
          Connect your Google account to pull Search Console data into your dashboard.
        </p>
        <button
          onClick={() => signIn("google", { redirectTo: "/dashboard" })}
          className="mt-6 inline-flex w-full cursor-pointer items-center justify-center gap-2 rounded-lg bg-white px-4 py-2.5 text-sm font-medium text-zinc-900 transition-colors hover:bg-zinc-200"
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden>
            <path fill="#EA4335" d="M12 5.04c1.62 0 3.06.56 4.2 1.64l3.12-3.12C17.46 1.8 14.96.75 12 .75 7.62.75 3.84 3.27 2.06 6.82l3.66 2.84C6.57 7.09 9.03 5.04 12 5.04z" />
            <path fill="#4285F4" d="M23.25 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47c-.29 1.48-1.14 2.73-2.4 3.58l3.68 2.85c2.15-1.99 3.5-4.92 3.5-8.67z" />
            <path fill="#FBBC05" d="M5.73 14.34a7.2 7.2 0 0 1 0-4.68L2.06 6.82a11.26 11.26 0 0 0 0 10.36l3.67-2.84z" />
            <path fill="#34A853" d="M12 23.25c3.04 0 5.6-1 7.46-2.72l-3.68-2.85c-1.02.69-2.33 1.1-3.78 1.1-2.97 0-5.43-2.05-6.28-4.62l-3.66 2.84c1.78 3.55 5.56 6.25 9.94 6.25z" />
          </svg>
          Connect Google Search Console
        </button>
        <p className="mt-4 text-xs text-ink-tertiary">Read-only access to your search performance data.</p>
      </div>
    </main>
  );
}
