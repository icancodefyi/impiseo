"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  IconAlertTriangle,
  IconChartBar,
  IconFileText,
  IconSearch,
  IconSparkles,
  IconSpider,
} from "@tabler/icons-react";
import { useDashboard } from "@/lib/dashboard-context";
import { ErrorBanner, Loader, SiteControls } from "@/components/widgets";

type AiEnhancement = {
  why: string;
  steps: string[];
  draftTitle: string | null;
  draftMeta: string | null;
};

type Rec = {
  id: string;
  type: string;
  severity: "high" | "medium" | "low";
  path: string | null;
  title: string;
  detail: string;
  action: string;
  count?: number;
  paths?: { path: string; impressions: number }[];
  ai?: AiEnhancement | null;
};

const TYPE_ICON: Record<string, typeof IconSearch> = {
  meta: IconFileText,
  title: IconFileText,
  structure: IconAlertTriangle,
  content: IconFileText,
  analytics: IconChartBar,
  keyword: IconSearch,
};

const SEVERITY_STYLE = {
  high: "bg-red-500/15 text-red-400",
  medium: "bg-amber-500/15 text-amber-400",
  low: "bg-zinc-700/40 text-zinc-400",
} as const;

type ReadyState = {
  ready: boolean;
  reason?: string;
  recs: Rec[];
  pagesCrawled?: number;
};

export default function RecommendationsPage() {
  const { site } = useDashboard();
  const [data, setData] = useState<ReadyState | null>(null);
  const [loadedSite, setLoadedSite] = useState("");
  const [error, setError] = useState("");
  const [aiBusy, setAiBusy] = useState(false);
  const [aiMessage, setAiMessage] = useState("");

  async function load() {
    if (!site) return;
    fetch(`/api/recommendations?site=${encodeURIComponent(site)}`)
      .then(async (res) => {
        if (!res.ok) throw new Error((await res.json()).error ?? `HTTP ${res.status}`);
        return res.json();
      })
      .then((d) => {
        setError("");
        setData({ ready: d.ready, reason: d.reason, recs: d.recommendations ?? [], pagesCrawled: d.stats?.pagesCrawled });
        setLoadedSite(site);
      })
      .catch((e) => setError(e.message));
  }

  useEffect(() => {
    if (!site) return;
    let cancelled = false;
    if (!cancelled) void load().catch(() => {});
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [site]);

  async function runEnhance() {
    if (!site || aiBusy) return;
    setAiBusy(true);
    setAiMessage("Consulting the SEO skills library…");
    try {
      const res = await fetch(`/api/recommendations/enhance?site=${encodeURIComponent(site)}`, { method: "POST" });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`);
      const parts = [`${body.enhanced} findings enhanced`];
      if (body.alreadyCached > 0) parts.push(`${body.alreadyCached} already cached`);
      if (body.pending > 0) parts.push(`${body.pending} still pending — click again`);
      setAiMessage(parts.join(" · "));
      await load();
    } catch (e) {
      setAiMessage(`AI failed: ${e instanceof Error ? e.message : "unknown error"}`);
    } finally {
      setAiBusy(false);
    }
  }

  const loading = !site || site !== loadedSite || (!data && !error);

  if (loading) return <Loader label="Scanning your content…" />;
  if (error)
    return (
      <div className="space-y-4">
        <PageHeader onEnhance={runEnhance} aiBusy={aiBusy} ready={false} />
        <ErrorBanner message={error} />
      </div>
    );
  if (!data) return null;

  return (
    <div className="space-y-4">
      <PageHeader onEnhance={runEnhance} aiBusy={aiBusy} ready={data.ready && data.recs.length > 0} />
      {(aiBusy || aiMessage) && (
        <p className={`px-1 text-xs ${aiBusy ? "animate-pulse text-emerald-400" : "text-zinc-500"}`}>{aiMessage}</p>
      )}

      {!data.ready ? (
        <section className="rounded-xl border border-dashed border-zinc-800 bg-zinc-900/40 px-6 py-12 text-center">
          <IconSpider size={28} className="mx-auto text-zinc-600" stroke={1.5} />
          <p className="mt-3 max-w-md mx-auto text-sm leading-relaxed text-zinc-400">{data.reason}</p>
          <Link
            href="/site-pages"
            className="mt-4 inline-block rounded-lg bg-white px-4 py-2 text-sm font-medium text-zinc-900 transition hover:bg-zinc-200"
          >
            Go to Pages →
          </Link>
        </section>
      ) : data.recs.length === 0 ? (
        <section className="rounded-xl border border-emerald-900/50 bg-emerald-950/30 px-6 py-12 text-center">
          <p className="text-sm font-medium text-emerald-400">All clear 🎉</p>
          <p className="mt-2 text-sm text-zinc-400">
            No issues detected across {data.pagesCrawled} crawled pages. Re-run the crawl weekly to keep it that way.
          </p>
        </section>
      ) : (
        <>
          <p className="px-1 text-xs text-zinc-500">
            {data.recs.length} findings across {data.pagesCrawled} crawled pages · ranked by traffic impact
          </p>
          <div className="grid gap-3 lg:grid-cols-2">
            {data.recs.map((r) => {
              const Icon = TYPE_ICON[r.type] ?? IconAlertTriangle;
              return (
                <article key={r.id} className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <h2 className="flex items-start gap-2 text-sm font-medium leading-snug tracking-tight text-zinc-200">
                      <Icon size={16} stroke={1.75} className="mt-0.5 shrink-0 text-zinc-500" />
                      {r.title}
                    </h2>
                    <span
                      className={`shrink-0 rounded-md px-2 py-0.5 text-[0.625rem] font-semibold uppercase tracking-wide ${SEVERITY_STYLE[r.severity]}`}
                    >
                      {r.severity}
                    </span>
                  </div>
                  <p className="mt-2 text-xs leading-relaxed text-zinc-400">{r.detail}</p>
                  {!r.ai && <p className="mt-2 text-xs leading-relaxed text-emerald-400/90">→ {r.action}</p>}
                  {r.ai && (
                    <div className="mt-2.5 space-y-2 rounded-lg border border-emerald-900/40 bg-emerald-950/20 p-3">
                      <p className="flex items-start gap-1.5 text-xs leading-relaxed text-emerald-300">
                        <IconSparkles size={13} stroke={1.75} className="mt-0.5 shrink-0" />
                        {r.ai.why}
                      </p>
                      {r.ai.steps.length > 0 && (
                        <ol className="space-y-1.5">
                          {r.ai.steps.map((s, i) => (
                            <li key={i} className="flex items-start gap-1.5 text-xs leading-relaxed text-zinc-300">
                              <span className="mt-px shrink-0 font-semibold text-zinc-500">{i + 1}.</span>
                              {s}
                            </li>
                          ))}
                        </ol>
                      )}
                      {(r.ai.draftTitle || r.ai.draftMeta) && (
                        <div className="space-y-1.5 border-t border-emerald-900/30 pt-2">
                          {r.ai.draftTitle && (
                            <p className="text-xs text-zinc-400">
                              <span className="font-medium text-zinc-500">Draft title:</span>{" "}
                              <span className="text-zinc-200">{r.ai.draftTitle}</span>
                            </p>
                          )}
                          {r.ai.draftMeta && (
                            <p className="text-xs text-zinc-400">
                              <span className="font-medium text-zinc-500">Draft meta:</span>{" "}
                              <span className="text-zinc-200">{r.ai.draftMeta}</span>
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                  {r.paths && r.paths.length > 0 && (
                    <div className="mt-2.5 space-y-1 border-t border-zinc-800/60 pt-2.5">
                      {r.paths.slice(0, 5).map((p) => (
                        <p key={p.path} className="truncate text-[0.6875rem] text-zinc-500" title={p.path}>
                          {p.path}
                        </p>
                      ))}
                      {r.count !== undefined && r.count > 5 && (
                        <p className="text-[0.6875rem] font-medium text-zinc-600">+{r.count - 5} more pages</p>
                      )}
                    </div>
                  )}
                  {!r.paths && r.path && (
                    <p className="mt-2.5 truncate border-t border-zinc-800/60 pt-2.5 text-[0.6875rem] text-zinc-500" title={r.path}>
                      {r.path}
                    </p>
                  )}
                </article>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

function PageHeader({ onEnhance, aiBusy, ready }: { onEnhance: () => void; aiBusy: boolean; ready: boolean }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-lg font-semibold tracking-tight">Recommendations</h1>
        <p className="mt-0.5 text-xs text-zinc-500">Deterministic fixes ranked by traffic impact</p>
      </div>
      <div className="flex items-center gap-3">
        <SiteControls />
        {ready && (
          <button
            onClick={onEnhance}
            disabled={aiBusy}
            className="flex items-center gap-1.5 rounded-lg bg-emerald-500/15 px-3 py-2 text-sm font-medium text-emerald-400 transition hover:bg-emerald-500/25 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <IconSparkles size={15} stroke={1.75} />
            {aiBusy ? "Thinking…" : "Generate AI fix plans"}
          </button>
        )}
      </div>
    </div>
  );
}
