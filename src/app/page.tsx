"use client";

import { useCallback, useEffect, useState } from "react";
import { signIn, signOut } from "next-auth/react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type Site = { url: string; permissionLevel: string };

type Totals = { clicks: number; impressions: number; ctr: number; position: number };

type MetricRow = {
  key: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
};

type Stats = {
  range: { start: string; end: string; prevStart: string; prevEnd: string };
  totals: Totals;
  prevTotals: Totals;
  series: { date: string; clicks: number; impressions: number }[];
  queries: MetricRow[];
  pages: MetricRow[];
};

const RANGES = [
  { label: "7d", days: 7 },
  { label: "28d", days: 28 },
  { label: "90d", days: 90 },
];

const nf = new Intl.NumberFormat("en-US");
const compact = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 });

function fmtPct(v: number) {
  return `${(v * 100).toFixed(1)}%`;
}

function fmtPos(v: number) {
  return v ? v.toFixed(1) : "–";
}

function shortDate(iso: string) {
  const d = new Date(`${iso}T00:00:00`);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function prettySite(url: string) {
  return url.startsWith("sc-domain:") ? url.replace("sc-domain:", "") : url.replace(/^https?:\/\//, "").replace(/\/$/, "");
}

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

function pctChange(cur: number, prev: number) {
  if (!prev) return null;
  return (cur - prev) / prev;
}

function KpiCard({
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
    <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
      <p className="text-xs uppercase tracking-wider text-zinc-500">{label}</p>
      <div className="mt-2 flex items-baseline gap-2">
        <span className="text-3xl font-semibold tabular-nums">{value}</span>
        <Delta value={delta} invert={invertDelta} />
      </div>
    </div>
  );
}

function posColor(pos: number) {
  if (pos <= 3) return "bg-emerald-500/15 text-emerald-400";
  if (pos <= 10) return "bg-amber-500/15 text-amber-400";
  if (pos <= 20) return "bg-orange-500/15 text-orange-400";
  return "bg-zinc-700/40 text-zinc-400";
}

function MetricTable({ title, rows, isPages }: { title: string; rows: MetricRow[]; isPages?: boolean }) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900">
      <h2 className="border-b border-zinc-800 px-5 py-4 text-sm font-semibold">{title}</h2>
      <div className="max-h-[420px] overflow-y-auto">
        <table className="w-full text-sm">
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
                <td className="max-w-[280px] truncate px-5 py-2.5" title={r.key}>
                  {r.key || "(not provided)"}
                </td>
                <td className="px-3 py-2.5 text-right tabular-nums">{nf.format(r.clicks)}</td>
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

export default function Dashboard() {
  const [loggedIn, setLoggedIn] = useState<boolean | null>(null);
  const [sites, setSites] = useState<Site[]>([]);
  const [site, setSite] = useState<string>("");
  const [days, setDays] = useState(28);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const loadStats = useCallback((siteUrl: string, rangeDays: number) => {
    setLoading(true);
    setError("");
    fetch(`/api/stats?site=${encodeURIComponent(siteUrl)}&days=${rangeDays}`)
      .then(async (res) => {
        if (!res.ok) throw new Error((await res.json()).error ?? `HTTP ${res.status}`);
        return res.json();
      })
      .then(setStats)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetch("/api/sites")
      .then(async (res) => {
        if (res.status === 401) {
          return null;
        }
        return res.json();
      })
      .then((data) => {
        if (!data) {
          setLoggedIn(false);
          return;
        }
        setLoggedIn(true);
        setSites(data.sites ?? []);
        if (data.sites?.length) {
          const saved = localStorage.getItem("gsc_site");
          const initial = data.sites.some((s: Site) => s.url === saved) ? saved : data.sites[0].url;
          setSite(initial);
          localStorage.setItem("gsc_site", initial);
          loadStats(initial, 28);
        }
      })
      .catch(() => setLoggedIn(false));
  }, [loadStats]);

  function selectSite(url: string) {
    setSite(url);
    localStorage.setItem("gsc_site", url);
    loadStats(url, days);
  }

  function selectRange(d: number) {
    setDays(d);
    if (site) loadStats(site, d);
  }

  if (loggedIn === null) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <p className="animate-pulse text-sm text-zinc-500">Loading…</p>
      </main>
    );
  }

  if (!loggedIn) {
    return (
      <main className="flex min-h-screen items-center justify-center px-6">
        <div className="w-full max-w-sm rounded-2xl border border-zinc-800 bg-zinc-900 p-8 text-center">
          <h1 className="text-xl font-semibold">SEO Console</h1>
          <p className="mt-2 text-sm text-zinc-400">
            Connect your Google account to pull Search Console data into your dashboard.
          </p>
          <button
            onClick={() => signIn("google", { redirectTo: "/" })}
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

  const t = stats?.totals;
  const p = stats?.prevTotals;

  return (
    <main className="mx-auto max-w-6xl px-6 py-8">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-500/15 text-lg">📈</div>
          <div>
            <h1 className="text-lg font-semibold leading-tight">SEO Console</h1>
            <p className="text-xs text-zinc-500">Google Search Console analytics</p>
          </div>
        </div>
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
          <button
            onClick={() => signOut({ redirectTo: "/" })}
            className="rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-400 transition hover:text-zinc-200"
          >
            Log out
          </button>
        </div>
      </header>

      {error && (
        <div className="mt-6 rounded-lg border border-red-900/50 bg-red-950/40 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}

      {loading && !stats && (
        <div className="mt-16 text-center text-sm text-zinc-500">Fetching Search Console data…</div>
      )}

      {t && p && (
        <>
          <section className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
            <KpiCard label="Clicks" value={nf.format(t.clicks)} delta={pctChange(t.clicks, p.clicks)} />
            <KpiCard label="Impressions" value={nf.format(t.impressions)} delta={pctChange(t.impressions, p.impressions)} />
            <KpiCard label="CTR" value={fmtPct(t.ctr)} delta={pctChange(t.ctr, p.ctr)} />
            <KpiCard label="Avg. position" value={fmtPos(t.position)} delta={pctChange(t.position, p.position)} invertDelta />
          </section>

          <section className="mt-4 rounded-xl border border-zinc-800 bg-zinc-900 p-5">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-sm font-semibold">Performance</h2>
              <p className="text-xs text-zinc-500">
                {shortDate(stats!.range.start)} – {shortDate(stats!.range.end)}
                <span className="mx-2 text-zinc-700">vs</span>
                {shortDate(stats!.range.prevStart)} – {shortDate(stats!.range.prevEnd)}
              </p>
            </div>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={stats!.series} margin={{ top: 4, right: 4, bottom: 0, left: -18 }}>
                  <defs>
                    <linearGradient id="impGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#818cf8" stopOpacity={0.35} />
                      <stop offset="100%" stopColor="#818cf8" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="clkGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#34d399" stopOpacity={0.35} />
                      <stop offset="100%" stopColor="#34d399" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="#27272a" strokeDasharray="3 3" vertical={false} />
                  <XAxis
                    dataKey="date"
                    tickFormatter={shortDate}
                    tick={{ fill: "#71717a", fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                    minTickGap={28}
                  />
                  <YAxis yAxisId="left" tick={{ fill: "#71717a", fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v: number) => compact.format(v)} />
                  <YAxis yAxisId="right" orientation="right" tick={{ fill: "#71717a", fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v: number) => compact.format(v)} />
                  <Tooltip
                    contentStyle={{ background: "#18181b", border: "1px solid #3f3f46", borderRadius: 8, fontSize: 12 }}
                    labelStyle={{ color: "#a1a1aa" }}
                    labelFormatter={(l) => shortDate(String(l))}
                  />
                  <Area yAxisId="right" type="monotone" dataKey="impressions" name="Impressions" stroke="#818cf8" strokeWidth={2} fill="url(#impGrad)" />
                  <Area yAxisId="left" type="monotone" dataKey="clicks" name="Clicks" stroke="#34d399" strokeWidth={2} fill="url(#clkGrad)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </section>

          <section className="mt-4 grid gap-4 lg:grid-cols-2">
            <MetricTable title="Top queries" rows={stats!.queries} />
            <MetricTable title="Top pages" rows={stats!.pages} isPages />
          </section>
        </>
      )}
    </main>
  );
}
