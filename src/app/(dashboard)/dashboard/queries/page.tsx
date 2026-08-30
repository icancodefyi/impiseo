"use client";

import { useEffect, useState } from "react";
import { useDashboard } from "@/lib/dashboard-context";
import { ErrorBanner, Loader, MetricTable, PageHeader } from "@/components/widgets";
import type { MetricRow } from "@/lib/dashboard-context";

type QueryPage = {
  queries: MetricRow[];
  hasMore: boolean;
};

const PAGE = 100;

export default function QueriesPage() {
  const { site, days, stats, loading } = useDashboard();

  const [rows, setRows] = useState<MetricRow[]>([]);
  const [nextOffset, setNextOffset] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!site) return;
    let cancelled = false;
    fetch(`/api/queries?site=${encodeURIComponent(site)}&days=${days}&offset=0&limit=${PAGE}`)
      .then(async (res) => {
        if (!res.ok) throw new Error((await res.json()).error ?? `HTTP ${res.status}`);
        return res.json();
      })
      .then((j: QueryPage) => {
        if (cancelled) return;
        setRows(j.queries);
        setNextOffset(j.queries.length);
        setHasMore(j.hasMore);
        setError("");
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      });
    return () => {
      cancelled = true;
    };
  }, [site, days]);

  const loadMore = async () => {
    if (!site || fetching) return;
    setFetching(true);
    setError("");
    try {
      const res = await fetch(
        `/api/queries?site=${encodeURIComponent(site)}&days=${days}&offset=${nextOffset}&limit=${PAGE}`
      );
      if (!res.ok) throw new Error((await res.json()).error ?? `HTTP ${res.status}`);
      const j = (await res.json()) as QueryPage;
      setRows((prev) => [...prev, ...j.queries]);
      setNextOffset(nextOffset + j.queries.length);
      setHasMore(j.hasMore);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setFetching(false);
    }
  };

  if (!stats && loading) return <Loader label="Fetching Search Console data…" />;

  return (
    <div className="space-y-5">
      <PageHeader title="Queries" subtitle={`What people searched before landing on your site · last ${days} days`} />
      {error && <ErrorBanner message={error} />}
      <MetricTable title={`Top queries · last ${days} days`} rows={rows} />
      {(hasMore || fetching) && (
        <div className="flex items-center justify-center">
          <button onClick={loadMore} disabled={fetching} className="btn-secondary">
            {fetching ? "Loading…" : `Load more (${rows.length} loaded)`}
          </button>
        </div>
      )}
    </div>
  );
}