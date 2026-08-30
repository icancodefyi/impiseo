"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useDashboard } from "@/lib/dashboard-context";
import { ErrorBanner, Loader, PageHeader } from "@/components/widgets";
import { nf } from "@/components/widgets";
import type { IntentKind } from "@/lib/opportunities-engine";

type Opportunity = {
  query: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
  intent: IntentKind;
  topPagePath: string | null;
  pageTitle: string | null;
  matchScore: number | null;
  missingTerms: string[];
  clusterTopic: string | null;
  projectedTop3: number;
  headroomTop3: number;
  projectedTop1: number;
  headroomTop1: number;
  cannibalizing: boolean;
  competingPaths: string[];
  revenuePerClick: number | null;
  revenueImpact: number | null;
  fixing: string;
};

type OpportunitiesResponse = {
  total: number;
  offset: number;
  limit: number;
  queries: Opportunity[];
};

const PAGE = 50;
const INTENTS: (IntentKind | "all")[] = ["all", "transactional", "informational", "navigational", "other"];

const INTENT_STYLE: Record<IntentKind, string> = {
  transactional: "bg-violet-500/10 text-violet-300",
  informational: "bg-sky-500/10 text-sky-300",
  navigational: "bg-amber-500/10 text-amber-300",
  other: "bg-surface-4 text-ink-subtle",
};

function IntentBadge({ intent }: { intent: IntentKind }) {
  return (
    <span className={`inline-block rounded-md px-1.5 py-0.5 text-[11px] font-medium ${INTENT_STYLE[intent]}`}>
      {intent}
    </span>
  );
}

function RevenueCell({
  path,
  revenueMap,
  onChange,
}: {
  path: string | null;
  revenueMap: Record<string, number>;
  onChange: (path: string, value: number) => void;
}) {
  const [local, setLocal] = useState<number | null>(null);
  if (!path) return <span className="text-ink-tertiary">–</span>;
  const value = local ?? revenueMap[path] ?? 0;
  return (
    <div className="flex items-center justify-end gap-1.5">
      <span className="text-ink-tertiary">₹</span>
      <input
        type="number"
        min={0}
        step={100}
        value={value}
        onChange={(e) => setLocal(e.target.value === "" ? 0 : Number(e.target.value))}
        onBlur={() => {
          if (local !== null) onChange(path, local);
          setLocal(null);
        }}
        className="w-20 rounded-md border border-hairline bg-surface-2 px-2 py-1 text-right text-sm tabular-nums text-ink outline-none transition-colors focus:border-primary"
        placeholder="0"
        title={`Monthly revenue estimate for ${path}`}
      />
    </div>
  );
}

export default function OpportunitiesPage() {
  const { site, days, stats, loading } = useDashboard();

  const [sort, setSort] = useState("headroom");
  const [intent, setIntent] = useState<IntentKind | "all">("all");
  const [cannibalizedOnly, setCannibalizedOnly] = useState(false);
  const [minImpr, setMinImpr] = useState("");
  const [q, setQ] = useState("");

  const [rows, setRows] = useState<Opportunity[]>([]);
  const [total, setTotal] = useState(0);
  const [nextOffset, setNextOffset] = useState(0);
  const [fetching, setFetching] = useState(false);
  const [error, setError] = useState("");
  const [revenueMap, setRevenueMap] = useState<Record<string, number>>({});

  const appliedMinImpr = minImpr === "" ? 0 : Math.max(0, Number(minImpr) || 0);
  const queryKey = [
    site ?? "",
    days,
    sort,
    intent,
    cannibalizedOnly ? "c" : "",
    appliedMinImpr,
    q.trim(),
  ].join("|");

  useEffect(() => {
    if (!site) return;
    let cancelled = false;
    fetch(`/api/page-revenue?site=${encodeURIComponent(site)}`)
      .then(async (res) => {
        if (!res.ok) throw new Error("failed to load revenue");
        return res.json();
      })
      .then((j: { monthly: { path: string; monthlyRevenue: number }[] }) => {
        if (cancelled) return;
        const map: Record<string, number> = {};
        for (const m of j.monthly) if (m.monthlyRevenue > 0) map[m.path] = m.monthlyRevenue;
        setRevenueMap(map);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [site]);

  const qs = (offset: number) => {
    const p = new URLSearchParams({
      site: site!,
      days: String(days),
      offset: String(offset),
      limit: String(PAGE),
      sort,
      intent,
      excludeBranded: "true",
      minImpressions: String(appliedMinImpr),
      cannibalized: String(cannibalizedOnly),
    });
    if (q.trim()) p.set("queryContains", q.trim());
    return p.toString();
  };

  useEffect(() => {
    if (!site) return;
    let cancelled = false;
    fetch(`/api/opportunities?${qs(0)}`)
      .then(async (res) => {
        if (!res.ok) throw new Error((await res.json()).error ?? `HTTP ${res.status}`);
        return res.json();
      })
      .then((j: OpportunitiesResponse) => {
        if (cancelled) return;
        setRows(j.queries);
        setTotal(j.total);
        setNextOffset(j.queries.length);
        setError("");
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryKey]);

  const loadMore = async () => {
    if (!site || fetching) return;
    setFetching(true);
    setError("");
    try {
      const res = await fetch(`/api/opportunities?${qs(nextOffset)}`);
      if (!res.ok) throw new Error((await res.json()).error ?? `HTTP ${res.status}`);
      const j = (await res.json()) as OpportunitiesResponse;
      setRows((prev) => [...prev, ...j.queries]);
      setNextOffset(nextOffset + j.queries.length);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setFetching(false);
    }
  };

  const refetchLoaded = useCallback(async () => {
    if (!site) return;
    setError("");
    try {
      const batches = await Promise.all(
        Array.from({ length: Math.max(1, Math.ceil(nextOffset / PAGE)) }, (_, i) =>
          fetch(`/api/opportunities?${qs(i * PAGE)}`).then(async (res) => {
            if (!res.ok) throw new Error((await res.json()).error ?? `HTTP ${res.status}`);
            return res.json();
          })
        )
      );
      setRows(batches.flatMap((b) => b.queries));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [site, nextOffset, queryKey]);

  const saveRevenue = useCallback(
    async (path: string, value: number) => {
      if (!site) return;
      setRevenueMap((prev) => ({ ...prev, [path]: value }));
      try {
        const res = await fetch("/api/page-revenue", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ site, path, monthlyRevenue: value }),
        });
        if (!res.ok) throw new Error((await res.json()).error ?? `HTTP ${res.status}`);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
      await refetchLoaded();
    },
    [site, refetchLoaded]
  );

  const totals = useMemo(() => {
    let headroom = 0;
    let revenue = 0;
    for (const r of rows) {
      headroom += r.headroomTop3;
      if (r.revenueImpact !== null) revenue += r.revenueImpact;
    }
    return { headroom, revenue };
  }, [rows]);

  if (!stats && loading) return <Loader label="Fetching Search Console data…" />;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Opportunities"
        subtitle={`Per-query headroom: projected clicks if a query reached the top 3 · last ${days} days`}
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className="rounded-xl border border-hairline bg-surface-1 p-6">
          <p className="eyebrow">Queries</p>
          <p className="mt-2.5 text-[1.875rem] font-semibold leading-none tracking-[-0.02em] tabular-nums text-ink">
            {nf.format(total)}
          </p>
        </div>
        <div className="rounded-xl border border-hairline bg-surface-1 p-6">
          <p className="eyebrow">Est. extra clicks/mo @ #3</p>
          <p className="mt-2.5 text-[1.875rem] font-semibold leading-none tracking-[-0.02em] tabular-nums text-ink">
            {nf.format(totals.headroom)}
          </p>
        </div>
        <div className="rounded-xl border border-hairline bg-surface-1 p-6">
          <p className="eyebrow">Loaded rows</p>
          <p className="mt-2.5 text-[1.875rem] font-semibold leading-none tracking-[-0.02em] tabular-nums text-ink">
            {nf.format(rows.length)}
          </p>
        </div>
        <div className="rounded-xl border border-hairline bg-surface-1 p-6">
          <p className="eyebrow">Est. ₹/mo (loaded)</p>
          <p className="mt-2.5 text-[1.875rem] font-semibold leading-none tracking-[-0.02em] tabular-nums text-ink">
            {nf.format(totals.revenue)}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-hairline bg-surface-1 p-3">
        <select value={sort} onChange={(e) => setSort(e.target.value)} className="input-base cursor-pointer">
          <option value="headroom">Sort: headroom</option>
          <option value="impressions">Sort: impressions</option>
          <option value="clicks">Sort: clicks</option>
          <option value="position">Sort: position</option>
        </select>
        <select
          value={intent}
          onChange={(e) => setIntent(e.target.value as IntentKind | "all")}
          className="input-base cursor-pointer"
        >
          {INTENTS.map((i) => (
            <option key={i} value={i}>
              Intent: {i}
            </option>
          ))}
        </select>
        <input
          type="number"
          min={0}
          value={minImpr}
          onChange={(e) => setMinImpr(e.target.value)}
          placeholder="Min impressions"
          className="input-base w-36"
        />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Filter by query…"
          className="input-base w-52"
        />
        <label className="flex cursor-pointer items-center gap-1.5 text-sm text-ink-subtle">
          <input
            type="checkbox"
            checked={cannibalizedOnly}
            onChange={(e) => setCannibalizedOnly(e.target.checked)}
            className="cursor-pointer"
          />
          Cannibalized only
        </label>
      </div>

      {error && <ErrorBanner message={error} />}

      <div className="overflow-hidden rounded-xl border border-hairline bg-surface-1">
        <h2 className="section-title border-b border-hairline px-6 py-4">
          Growth opportunities · {nf.format(total)} matching queries
        </h2>
        <div className="overflow-auto">
          <table className="w-full min-w-[960px] text-sm">
            <thead className="sticky top-0 z-[1] bg-surface-1 text-left">
              <tr>
                <th className="eyebrow px-6 pb-3 pt-3.5 text-left font-medium">Query</th>
                <th className="eyebrow px-4 pb-3 pt-3.5 text-left font-medium">CTR · Impr · Pos</th>
                <th className="eyebrow px-4 pb-3 pt-3.5 text-right font-medium">Impr.</th>
                <th className="eyebrow px-4 pb-3 pt-3.5 text-right font-medium">Pos.</th>
                <th className="eyebrow px-4 pb-3 pt-3.5 text-right font-medium">To #3</th>
                <th className="eyebrow px-4 pb-3 pt-3.5 text-right font-medium">To #1</th>
                <th className="eyebrow px-4 pb-3 pt-3.5 text-right font-medium">₹/mo</th>
                <th className="eyebrow px-6 pb-3 pt-3.5 text-left font-medium">Fixing</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && !fetching && (
                <tr>
                  <td colSpan={8} className="px-6 py-10 text-center text-sm text-ink-subtle">
                    No opportunities match these filters
                  </td>
                </tr>
              )}
              {rows.map((r) => {
                const impact = r.revenueImpact;
                return (
                  <tr
                    key={`${r.query}-${r.topPagePath ?? ""}`}
                    className="border-t border-hairline-tertiary transition-colors hover:bg-surface-2/60"
                  >
                    <td className="max-w-[300px] px-6 py-3 align-top">
                      <div className="flex items-center gap-1.5">
                        <span className="truncate font-medium text-ink" title={r.query}>
                          {r.query}
                        </span>
                        <IntentBadge intent={r.intent} />
                        {r.cannibalizing && (
                          <span
                            className="inline-block shrink-0 rounded-md bg-fuchsia-500/10 px-1.5 py-0.5 text-[11px] font-medium text-fuchsia-300"
                            title={`Competing pages: ${r.competingPaths.join(", ")}`}
                          >
                            cannibalized
                          </span>
                        )}
                      </div>
                      <p className="mt-1 line-clamp-1 text-xs break-all text-ink-tertiary" title={r.topPagePath ?? undefined}>
                        {r.topPagePath ?? "—"}
                      </p>
                      {r.missingTerms.length > 0 && (
                        <p className="mt-0.5 text-xs text-amber-300/80">missing: {r.missingTerms.join(", ")}</p>
                      )}
                    </td>
                    <td className="max-w-[220px] px-4 py-3 align-top">
                      <p className="text-sm font-medium text-ink">
                        {(r.ctr * 100).toFixed(1)}% CTR
                      </p>
                      <p className="text-xs text-ink-subtle">
                        {nf.format(r.impressions)} Impr · {r.position.toFixed(1)} Pos
                      </p>
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-ink-subtle">{nf.format(r.impressions)}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-ink-subtle">{r.position.toFixed(1)}</td>
                    <td className="px-4 py-3 text-right">
                      <span className="rounded-md bg-emerald-500/10 px-2 py-0.5 text-xs font-medium tabular-nums text-emerald-400">
                        +{nf.format(r.headroomTop3)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="rounded-md bg-violet-500/10 px-2 py-0.5 text-xs font-medium tabular-nums text-violet-300">
                        +{nf.format(r.headroomTop1)}
                      </span>
                    </td>
                    <td className="px-4 py-3 align-top">
                      <RevenueCell path={r.topPagePath} revenueMap={revenueMap} onChange={saveRevenue} />
                      {impact !== null ? (
                        <p className="mt-0.5 text-right text-xs font-medium tabular-nums text-ink">
                          → ₹{nf.format(impact)}/mo
                        </p>
                      ) : (
                        <p className="mt-0.5 text-right text-[11px] text-ink-tertiary">+{nf.format(r.headroomTop3)} clicks x value</p>
                      )}
                    </td>
                    <td className="max-w-[300px] px-6 py-3 align-top text-xs leading-relaxed text-ink-muted">
                      {r.fixing}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {nextOffset < total && (
        <div className="flex items-center justify-center">
          <button onClick={loadMore} disabled={fetching} className="btn-secondary">
            {fetching ? "Loading…" : `Load more (${nf.format(rows.length)} of ${nf.format(total)})`}
          </button>
        </div>
      )}

      <p className="text-xs leading-relaxed text-ink-tertiary">
        Revenue model (v1): type a monthly ₹ value for a page — each extra click is then valued at ₹ per month ÷ clicks per
        month, and headroom is projected as ₹/mo. Numbers are directional estimates, not revenue guarantees.
      </p>
    </div>
  );
}