"use client";

import { signIn } from "next-auth/react";
import { useDashboard } from "@/lib/dashboard-context";
import type { MetricRow } from "@/lib/dashboard-context";

const nf = new Intl.NumberFormat("en-US");
export { nf };

function Delta({ value, invert = false }: { value: number | null; invert?: boolean }) {
  if (value === null || !isFinite(value)) return null;
  const good = invert ? value < 0 : value > 0;
  const color = Math.abs(value) < 0.005 ? "text-zinc-500" : good ? "text-emerald-400" : "text-red-400";
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
  if (pos <= 3) return "bg-emerald-500/15 text-emerald-400";
  if (pos <= 10) return "bg-amber-500/15 text-amber-400";
  if (pos <= 20) return "bg-orange-500/15 text-orange-400";
  return "bg-zinc-700/40 text-zinc-400";
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
    <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5 shadow-sm">
      <p className="text-[0.6875rem] font-medium uppercase tracking-[0.08em] text-zinc-500">{label}</p>
      <div className="mt-1.5 flex items-baseline gap-2">
        <span className="text-[1.75rem] leading-none tracking-tight tabular-nums font-[640]">{value}</span>
        <Delta value={delta} invert={invertDelta} />
      </div>
    </div>
  );
}

export function MetricTable({ title, rows, isPages }: { title: string; rows: MetricRow[]; isPages?: boolean }) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900 shadow-sm">
      <h2 className="border-b border-zinc-800 px-5 py-3.5 text-[0.8125rem] font-semibold tracking-tight text-zinc-200">{title}</h2>
      <div className="max-h-[420px] overflow-auto">
        <table className="w-full min-w-[520px] text-sm">
          <thead className="sticky top-0 bg-zinc-900 text-left text-xs uppercase tracking-wider text-zinc-500">
            <tr>
              <th className="px-5 py-2.5 font-medium">{isPages ? "Page" : "Query"}</th>
              <th className="px-3 py-2.5 text-right font-medium">Clicks</th>
              <th className="px-3 py-2.5 text-right font-medium">Impr.</th>
              <th className="px-3 py-2.5 text-right font-medium">CTR</th>
              <th className="px-5 py-2.5 text-right font-medium">Pos.</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={5} className="px-5 py-8 text-center text-zinc-500">
                  No data for this period
                </td>
              </tr>
            )}
            {rows.map((r) => (
              <tr key={r.key} className="border-t border-zinc-800/60 hover:bg-zinc-800/30">
                <td className="max-w-[280px] truncate px-5 py-2.5 font-medium text-zinc-200" title={r.key}>
                  {r.key || "(not provided)"}
                </td>
                <td className="px-3 py-2.5 text-right font-medium tabular-nums">{nf.format(r.clicks)}</td>
                <td className="px-3 py-2.5 text-right tabular-nums text-zinc-400">{nf.format(r.impressions)}</td>
                <td className="px-3 py-2.5 text-right tabular-nums text-zinc-400">{fmtPct(r.ctr)}</td>
                <td className="px-5 py-2.5 text-right">
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
          className="rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm outline-none focus:border-zinc-600"
        >
          {sites.map((s) => (
            <option key={s.url} value={s.url}>
              {prettySite(s.url)}
            </option>
          ))}
        </select>
      )}
      <div className="flex rounded-lg border border-zinc-800 bg-zinc-900 p-0.5">
        {RANGES.map((r) => (
          <button
            key={r.days}
            onClick={() => selectRange(r.days)}
            className={`rounded-md px-3 py-1.5 text-sm transition ${
              days === r.days ? "bg-zinc-700 font-medium text-white" : "text-zinc-400 hover:text-zinc-200"
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
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-lg font-semibold tracking-tight">{title}</h1>
        <p className="mt-0.5 text-xs text-zinc-500">{subtitle}</p>
      </div>
      <SiteControls />
    </div>
  );
}

export function Loader({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="flex min-h-[50vh] items-center justify-center">
      <p className="animate-pulse text-sm text-zinc-500">{label}</p>
    </div>
  );
}

export function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="mt-6 rounded-lg border border-red-900/50 bg-red-950/40 px-4 py-3 text-sm text-red-300">
      {message}
    </div>
  );
}

export function SignInCard() {
  return (
    <main className="flex min-h-screen items-center justify-center px-6">
      <div className="w-full max-w-sm rounded-2xl border border-zinc-800 bg-zinc-900 p-8 text-center shadow-xl shadow-black/20">
        <h1 className="text-2xl font-semibold tracking-tight">Impiseo</h1>
        <p className="mt-2.5 text-sm leading-relaxed text-zinc-400">
          Connect your Google account to pull Search Console data into your dashboard.
        </p>
        <button
          onClick={() => signIn("google", { redirectTo: "/dashboard" })}
          className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-white px-4 py-2.5 text-sm font-medium text-zinc-900 transition hover:bg-zinc-200"
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden>
            <path fill="#EA4335" d="M12 5.04c1.62 0 3.06.56 4.2 1.64l3.12-3.12C17.46 1.8 14.96.75 12 .75 7.62.75 3.84 3.27 2.06 6.82l3.66 2.84C6.57 7.09 9.03 5.04 12 5.04z" />
            <path fill="#4285F4" d="M23.25 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47c-.29 1.48-1.14 2.73-2.4 3.58l3.68 2.85c2.15-1.99 3.5-4.92 3.5-8.67z" />
            <path fill="#FBBC05" d="M5.73 14.34a7.2 7.2 0 0 1 0-4.68L2.06 6.82a11.26 11.26 0 0 0 0 10.36l3.67-2.84z" />
            <path fill="#34A853" d="M12 23.25c3.04 0 5.6-1 7.46-2.72l-3.68-2.85c-1.02.69-2.33 1.1-3.78 1.1-2.97 0-5.43-2.05-6.28-4.62l-3.66 2.84c1.78 3.55 5.56 6.25 9.94 6.25z" />
          </svg>
          Connect Google Search Console
        </button>
        <p className="mt-4 text-xs text-zinc-600">Read-only access to your search performance data.</p>
      </div>
    </main>
  );
}
