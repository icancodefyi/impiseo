"use client";

import { useState } from "react";
import Link from "next/link";
import { IconPlugConnected, IconSpider } from "@tabler/icons-react";
import { useDashboard } from "@/lib/dashboard-context";
import { ErrorBanner, Loader, PageHeader, nf, posColor } from "@/components/widgets";

function fmtPos(v: number) {
  return v ? v.toFixed(1) : "–";
}

export default function SitePagesPage() {
  const { joined, stats, loading, error, days, site, loggedIn } = useDashboard();
  const rows = joined?.connected ? joined.rows : [];
  const [crawlState, setCrawlState] = useState<"idle" | "running" | "done" | "error">("idle");
  const [progress, setProgress] = useState("");

  async function runSyncAndCrawl() {
    if (!site) return;
    setCrawlState("running");
    try {
      setProgress("Syncing pages from Search Console…");
      const syncRes = await fetch(`/api/pages/sync?site=${encodeURIComponent(site)}`, { method: "POST" });
      if (!syncRes.ok) throw new Error((await syncRes.json()).error ?? "sync failed");
      const { synced, total }: { synced: number; total: number } = await syncRes.json();

      let done = total - synced;
      for (let i = 0; i < 60; i++) {
        setProgress(`Crawling… ${Math.min(done, total)}/${total} pages analyzed`);
        const res = await fetch(`/api/crawl?site=${encodeURIComponent(site)}&batch=5`, { method: "POST" });
        if (!res.ok) throw new Error((await res.json()).error ?? "crawl failed");
        const data: { remaining: number } = await res.json();
        done = total - data.remaining;
        if (data.remaining === 0) break;
      }
      setProgress(`${total} pages synced & analyzed`);
      setCrawlState("done");
    } catch {
      setProgress("Something went wrong while crawling.");
      setCrawlState("error");
    }
  }

  if (!loggedIn) return null;
  if (!stats && loading) return <Loader label="Fetching Search Console data…" />;

  return (
    <div className="space-y-4">
      <PageHeader
        title="Pages"
        subtitle={`Search Console clicks vs PostHog pageviews · last ${days} days · GSC data lags ~3 days`}
      />

      {error && <ErrorBanner message={error} />}

      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-hairline bg-surface-1 px-5 py-3.5">
        <button
          onClick={runSyncAndCrawl}
          disabled={crawlState === "running"}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-3.5 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50"
        >
          <IconSpider size={15} stroke={1.75} />
          {crawlState === "running" ? "Working…" : "Sync & analyze page content"}
        </button>
        {progress && <p className="text-xs text-ink-subtle">{progress}</p>}
      </div>

      <section className="overflow-hidden rounded-xl border border-hairline bg-surface-1">
        {!joined && (
          <div className="px-5 py-10 text-center text-sm text-ink-subtle">Loading joined data…</div>
        )}
        {joined && !joined.connected && (
          <div className="px-5 py-10 text-center text-sm text-ink-subtle">
            <IconPlugConnected size={20} className="mx-auto mb-2 text-ink-tertiary" />
            Connect PostHog in{" "}
            <Link href="/integrations" className="font-medium text-primary-hover hover:text-ink">
              Integrations
            </Link>{" "}
            to join behavior data with search clicks.
          </div>
        )}
        {rows.length > 0 && (
          <div className="max-h-[640px] overflow-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="sticky top-0 bg-surface-1 text-left text-xs uppercase tracking-wider text-ink-tertiary">
                <tr>
                  <th className="px-5 py-2.5 font-medium">Page</th>
                  <th className="px-3 py-2.5 text-right font-medium">Clicks</th>
                  <th className="px-3 py-2.5 text-right font-medium">Impr.</th>
                  <th className="px-3 py-2.5 text-right font-medium">Pos.</th>
                  <th className="px-3 py-2.5 text-right font-medium">Views</th>
                  <th className="px-5 py-2.5 text-right font-medium">Visitors</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.path} className="border-t border-hairline-tertiary transition-colors hover:bg-surface-2/60">
                    <td className="max-w-[360px] truncate px-5 py-2.5 font-medium text-ink" title={r.path}>
                      {r.path}
                    </td>
                    <td className="px-3 py-2.5 text-right font-medium tabular-nums text-ink-muted">{nf.format(r.clicks)}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-ink-subtle">{nf.format(r.impressions)}</td>
                    <td className="px-3 py-2.5 text-right">
                      <span className={`inline-block rounded-md px-2 py-0.5 text-xs font-medium tabular-nums ${posColor(r.position)}`}>
                        {fmtPos(r.position)}
                      </span>
                    </td>
                    <td className={`px-3 py-2.5 text-right font-medium tabular-nums ${r.clicks > 0 && r.views === 0 ? "text-red-400" : "text-ink-muted"}`}>
                      {nf.format(r.views)}
                    </td>
                    <td className="px-5 py-2.5 text-right tabular-nums text-ink-subtle">{nf.format(r.visitors)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
