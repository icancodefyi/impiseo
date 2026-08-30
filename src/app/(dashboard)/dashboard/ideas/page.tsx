"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  IconBulb,
  IconChevronRight,
  IconCompass,
  IconCrosshair,
  IconMapPin,
  IconRefresh,
  IconTargetArrow,
  IconTrophy,
} from "@tabler/icons-react";
import { useDashboard } from "@/lib/dashboard-context";
import { ErrorBanner, Loader, SiteControls } from "@/components/widgets";

type Idea = {
  id: string;
  type: "gap" | "striking-distance" | "intent-mismatch" | "winner-expansion" | "new-topic";
  topic: string;
  queriesCount: number;
  impressions90d: number;
  ctr: number;
  weightedPosition: number;
  projectedClicksPerMonth: { low: number; high: number };
  confidence: "low" | "medium" | "high";
};

type Run = {
  ready: boolean;
  reason?: string;
  cached?: boolean;
  stale?: boolean;
  degraded?: boolean;
  generatedAt?: string;
  stats?: {
    windowDays: number;
    queriesAnalyzed: number;
    brandedFiltered: number;
    clustersFormed: number;
    ideasReturned: number;
    aiPackaged: boolean;
    partialData?: boolean;
    degraded?: boolean;
    carriedFromPreviousRun?: number;
  };
  ideas?: Idea[];
};

const TYPE_META = {
  gap: { label: "Coverage gap", icon: IconMapPin, cls: "bg-primary/10 text-primary-hover" },
  "striking-distance": { label: "Striking distance", icon: IconTargetArrow, cls: "bg-amber-500/10 text-amber-400" },
  "intent-mismatch": { label: "Intent mismatch", icon: IconCrosshair, cls: "bg-red-500/10 text-red-400" },
  "winner-expansion": { label: "Winner expansion", icon: IconTrophy, cls: "bg-emerald-500/10 text-emerald-400" },
  "new-topic": { label: "New topic", icon: IconCompass, cls: "bg-primary/15 text-primary-hover" },
} as const;

const nf = new Intl.NumberFormat("en-US");

export default function IdeasPage() {
  const { site } = useDashboard();
  const [data, setData] = useState<Run | null>(null);
  const [loadedSite, setLoadedSite] = useState("");
  const [error, setError] = useState("");
  const [researching, setResearching] = useState(false);

  const applyRun = useCallback((d: Run, targetSite: string) => {
    setError("");
    setData(d);
    setLoadedSite(targetSite);
  }, []);

  useEffect(() => {
    if (!site) return;
    let cancelled = false;
    fetch(`/api/ideas?site=${encodeURIComponent(site)}`)
      .then(async (res) => {
        if (!res.ok) throw new Error((await res.json()).error ?? `HTTP ${res.status}`);
        return res.json();
      })
      .then((d) => {
        if (!cancelled) applyRun(d, site);
      })
      .catch((e) => {
        if (!cancelled) setError(e.message);
      });
    return () => {
      cancelled = true;
    };
  }, [site, applyRun]);

  const rerunResearch = () => {
    if (!site || researching) return;
    setResearching(true);
    fetch(`/api/ideas?site=${encodeURIComponent(site)}&refresh=1`)
      .then(async (res) => {
        if (!res.ok) throw new Error((await res.json()).error ?? `HTTP ${res.status}`);
        return res.json();
      })
      .then((d) => {
        applyRun(d, site);
        setResearching(false);
      })
      .catch((e) => {
        setError(e instanceof Error ? e.message : String(e));
        setResearching(false);
      });
  };

  const loading = !site || site !== loadedSite || (!data && !error);

  if (loading || researching)
    return (
      <Loader
        label={researching ? "Mining your search demand — clustering queries, validating phrasings…" : "Loading…"}
      />
    );

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
        <div>
          <h1 className="page-title">Ideas</h1>
          <p className="page-subtitle">
            What to write next — mined from your real search demand · last {data?.stats?.windowDays ?? 90} days
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={rerunResearch}
            disabled={researching}
            className="btn-secondary"
          >
            <IconRefresh size={14} stroke={1.75} /> Re-run research
          </button>
          <SiteControls />
        </div>
      </div>

      {error && <ErrorBanner message={error} />}

      {(data?.stale || data?.degraded || data?.stats?.partialData) && (
        <section className="rounded-xl border border-amber-500/30 bg-amber-500/[0.06] px-5 py-4">
          <p className="text-[0.9375rem] font-medium text-amber-300">
            {data?.stale
              ? "Showing the last stored research run — fresh research is temporarily unavailable."
              : data?.stats?.partialData
                ? "Search Console returned partial coverage for this run — some ideas below may be incomplete."
                : "This run had partial data — it reflects the last good research rather than overwriting it."}
          </p>
          {data?.stats?.carriedFromPreviousRun ? (
            <p className="mt-1 text-sm text-ink-subtle">
              {data.stats.carriedFromPreviousRun} idea(s) carried over from the previous run so nothing was lost.
            </p>
          ) : null}
        </section>
      )}

      {!error && data && !data.ready && (
        <section className="rounded-xl border border-dashed border-hairline bg-surface-1/40 px-6 py-12 text-center">
          <IconBulb size={28} className="mx-auto text-ink-tertiary" stroke={1.5} />
          <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-ink-subtle">{data.reason}</p>
        </section>
      )}

      {!error && data?.ready && data.stats && (
        <>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-1 text-sm text-ink-tertiary">
            <span>{nf.format(data.stats.queriesAnalyzed)} queries analyzed</span>
            <span>{nf.format(data.stats.clustersFormed)} topic clusters</span>
            {data.stats.brandedFiltered > 0 && (
              <span>{nf.format(data.stats.brandedFiltered)} branded queries excluded</span>
            )}
            {data.generatedAt && (
              <span>
                generated{" "}
                {new Date(data.generatedAt).toLocaleString("en-US", {
                  month: "short",
                  day: "numeric",
                  hour: "numeric",
                  minute: "2-digit",
                })}
                {data.cached ? " · cached" : ""}
              </span>
            )}
            {data.stats.aiPackaged && <span className="text-primary-hover">AI-packaged</span>}
          </div>

          {(data.ideas?.length ?? 0) === 0 ? (
            <section className="rounded-xl border border-success/30 bg-success/[0.06] px-6 py-12 text-center">
              <p className="text-sm font-medium text-emerald-400">No actionable ideas right now</p>
              <p className="mt-2 text-sm text-ink-subtle">
                Clusters were mined but none cleared the evidence bar. That is correct behavior — Impiseo never invents demand.
              </p>
            </section>
          ) : (
            <IdeaSections ideas={data.ideas!} site={site!} />
          )}
        </>
      )}
    </div>
  );
}

function IdeaSections({ ideas, site }: { ideas: Idea[]; site: string }) {
  const fresh = ideas.filter((i) => i.type === "new-topic");
  const improve = ideas.filter((i) => i.type !== "new-topic");

  return (
    <div className="space-y-5">
      {fresh.length > 0 && (
        <section className="space-y-2">
          <div className="flex items-baseline justify-between px-1">
            <h2 className="section-title">Write something new</h2>
            <p className="text-[0.8125rem] text-ink-tertiary">
              demand beyond your current footprint · receipts are real Google autocompletes
            </p>
          </div>
          <div className="divide-y divide-hairline-tertiary overflow-hidden rounded-xl border border-hairline bg-surface-1">
            {fresh.map((idea) => (
              <Row key={idea.id} idea={idea} site={site} />
            ))}
          </div>
        </section>
      )}

      {improve.length > 0 && (
        <section className="space-y-2">
          <div className="flex items-baseline justify-between px-1">
            <h2 className="section-title">Improve what you already rank for</h2>
            <p className="text-[0.8125rem] text-ink-tertiary">ranked by estimated value · measured impressions</p>
          </div>
          <div className="divide-y divide-hairline-tertiary overflow-hidden rounded-xl border border-hairline bg-surface-1">
            {improve.map((idea) => (
              <Row key={idea.id} idea={idea} site={site} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function Row({ idea, site }: { idea: Idea; site: string }) {
  const meta = TYPE_META[idea.type];
  const TypeIcon = meta.icon;
  const isNew = idea.type === "new-topic";
  return (
    <Link
      href={`/dashboard/ideas/${idea.id}?site=${encodeURIComponent(site)}`}
      className="flex items-start gap-3.5 px-5 py-4 transition-colors hover:bg-surface-2/60"
    >
      <span className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${meta.cls}`}>
        <TypeIcon size={16} stroke={1.75} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[0.9375rem] font-medium tracking-[-0.005em] text-ink">{idea.topic}</span>
        <span className="mt-1 block truncate text-sm text-ink-subtle">
          {isNew
            ? `${idea.queriesCount} validated phrasings · ${idea.confidence} confidence`
            : `${meta.label} · #${idea.weightedPosition.toFixed(1)} avg pos · ${(idea.ctr * 100).toFixed(1)}% ctr · ${nf.format(idea.impressions90d)} impr/90d`}
        </span>
      </span>
      {isNew ? (
        <span className="mt-1 shrink-0 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary-hover">
          new demand
        </span>
      ) : (
        <span className="shrink-0 text-right">
          <span className="block text-[0.9375rem] font-semibold tabular-nums text-emerald-400">
            +{nf.format(idea.projectedClicksPerMonth.low)}–{nf.format(idea.projectedClicksPerMonth.high)}
          </span>
          <span className="mt-1 block text-[0.6875rem] uppercase tracking-[0.06em] text-ink-tertiary">est. clicks/mo</span>
        </span>
      )}
      <IconChevronRight size={17} stroke={1.75} className="mt-1.5 shrink-0 text-ink-tertiary" />
    </Link>
  );
}
