"use client";

import { useDashboard } from "@/lib/dashboard-context";
import { ErrorBanner, Loader, MetricTable, PageHeader } from "@/components/widgets";

export default function QueriesPage() {
  const { stats, loading, error } = useDashboard();

  if (!stats && loading) return <Loader label="Fetching Search Console data…" />;

  return (
    <div className="space-y-5">
      <PageHeader title="Queries" subtitle="What people searched before landing on your site" />
      {error && <ErrorBanner message={error} />}
      <MetricTable title={`Top queries · last 28 days`} rows={stats?.queries ?? []} />
    </div>
  );
}
