"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  IconArrowLeft,
  IconCheck,
  IconCompass,
  IconCrosshair,
  IconExternalLink,
  IconMapPin,
  IconSparkles,
  IconTargetArrow,
  IconTrophy,
} from "@tabler/icons-react";
import { useDashboard } from "@/lib/dashboard-context";
import { ErrorBanner, Loader } from "@/components/widgets";

type Idea = {
  id: string;
  type: "gap" | "striking-distance" | "intent-mismatch" | "winner-expansion" | "new-topic";
  topic: string;
  tokens: string[];
  queriesCount: number;
  impressions90d: number;
  clicks90d: number;
  ctr: number;
  weightedPosition: number;
  projectedClicksPerMonth: { low: number; high: number };
  confidence: "low" | "medium" | "high";
  branded: boolean;
  evidenceNote: string;
  angle?: string;
  outline?: string[];
  evidence: {
    topQueries: { query: string; impressions: number; clicks: number; position: number }[];
    coveringPages: string[];
    autocompletePhrasings: string[];
    validated: boolean;
  };
};

const TYPE_META = {
  gap: { label: "Coverage gap", icon: IconMapPin, cls: "bg-primary/10 text-primary-hover" },
  "striking-distance": { label: "Striking distance", icon: IconTargetArrow, cls: "bg-amber-500/10 text-amber-400" },
  "intent-mismatch": { label: "Intent mismatch", icon: IconCrosshair, cls: "bg-red-500/10 text-red-400" },
  "winner-expansion": { label: "Winner expansion", icon: IconTrophy, cls: "bg-emerald-500/10 text-emerald-400" },
  "new-topic": { label: "New topic", icon: IconCompass, cls: "bg-primary/15 text-primary-hover" },
} as const;

const CONFIDENCE_CLS = {
  high: "bg-emerald-500/10 text-emerald-400",
  medium: "bg-surface-3 text-ink-subtle",
  low: "bg-surface-4 text-ink-tertiary",
} as const;

const nf = new Intl.NumberFormat("en-US");

function liveUrl(site: string, path: string): string {
  const host = site.replace(/^sc-domain:/, "").replace(/^https?:\/\//, "");
  return `https://${host}${path}`;
}

export default function IdeaDetailPage() {
  const { site } = useDashboard();
  const params = useParams<{ iid: string }>();
  const ideaId = params.iid;

  const [idea, setIdea] = useState<Idea | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!site || !ideaId) return;
    let cancelled = false;
    fetch(`/api/ideas?site=${encodeURIComponent(site)}&cached=1`)
      .then(async (res) => {
        if (!res.ok) throw new Error((await res.json()).error ?? `HTTP ${res.status}`);
        return res.json();
      })
      .then((d) => {
        if (cancelled) return;
        setIdea(((d.ideas ?? []) as Idea[]).find((i) => i.id === ideaId) ?? null);
        setError("");
      })
      .catch((e) => {
        if (!cancelled) setError(e.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [site, ideaId]);

  if (loading) return <Loader label="Loading idea…" />;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <BackLink />

      {error && <ErrorBanner message={error} />}

      {!error && !idea && (
        <section className="rounded-xl border border-dashed border-hairline bg-surface-1/40 px-6 py-12 text-center">
          <p className="text-sm text-ink-subtle">This idea no longer exists — the research was re-run and demand shifted.</p>
          <p className="mt-2 text-xs text-ink-tertiary">Re-run research from the Ideas page to refresh the current opportunities.</p>
        </section>
      )}

      {!error && idea && (
        <>
          <header className="flex items-start gap-3">
            <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${TYPE_META[idea.type].cls}`}>
              {(() => {
                const Icon = TYPE_META[idea.type].icon;
                return <Icon size={20} stroke={1.75} />;
              })()}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-[1.375rem] font-semibold leading-snug tracking-[-0.015em] text-ink">{idea.topic}</h1>
                <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${TYPE_META[idea.type].cls}`}>
                  {TYPE_META[idea.type].label}
                </span>
                <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${CONFIDENCE_CLS[idea.confidence]}`}>
                  {idea.confidence} confidence
                </span>
              </div>
              <p className="mt-1 text-xs text-ink-tertiary">
                {idea.type === "new-topic"
                  ? "Mined from live Google Autocomplete demand · never invented, always receipted"
                  : "Mined from your Search Console demand · last 90 days · never invented, always receipted"}
              </p>
            </div>
          </header>

          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {idea.type === "new-topic" ? (
              <>
                <Metric label="Validated phrasings" value={String(idea.queriesCount)} accent />
                <Metric label="Confidence" value={idea.confidence} />
                <Metric label="Your coverage" value="None" />
                <Metric label="Source" value="Google Autocomplete" />
              </>
            ) : (
              <>
                <Metric label="Impr / 90d" value={nf.format(idea.impressions90d)} />
                <Metric label="Avg position" value={`#${idea.weightedPosition.toFixed(1)}`} />
                <Metric label="CTR" value={`${(idea.ctr * 100).toFixed(1)}%`} />
                <Metric
                  label="Est. clicks/mo"
                  value={`+${nf.format(idea.projectedClicksPerMonth.low)}–${nf.format(idea.projectedClicksPerMonth.high)}`}
                  accent
                />
              </>
            )}
          </div>

          <section className="rounded-xl border border-hairline bg-surface-1 p-6">
            <h2 className="section-title text-[0.9375rem]">What the data says</h2>
            <p className="mt-2.5 text-[0.9375rem] leading-relaxed text-ink-muted">{idea.evidenceNote}</p>
          </section>

          {idea.angle && (
            <section className="rounded-xl border border-primary/25 bg-primary/[0.06] p-6">
              <h2 className="section-title flex items-center gap-2 text-[0.9375rem] text-primary-hover">
                <IconSparkles size={15} stroke={1.75} />
                The play
              </h2>
              <p className="mt-2.5 text-[0.9375rem] leading-relaxed text-ink-muted">{idea.angle}</p>

              {idea.outline && idea.outline.length > 0 && (
                <div className="mt-4">
                  <h3 className="eyebrow text-primary-hover">Working outline</h3>
                  <ol className="mt-3 space-y-3">
                    {idea.outline.map((beat, i) => (
                      <li key={i} className="flex items-start gap-3 text-[0.9375rem] leading-relaxed text-ink-muted">
                        <span className="mt-0.5 flex h-5.5 w-5.5 shrink-0 items-center justify-center rounded-full bg-primary/15 text-xs font-semibold text-primary-hover">
                          {i + 1}
                        </span>
                        {beat}
                      </li>
                    ))}
                  </ol>
                </div>
              )}
            </section>
          )}

          <section className="rounded-xl border border-hairline bg-surface-1 p-6">
            {idea.type === "new-topic" ? (
              <>
                <h2 className="section-title text-[0.9375rem]">
                  Real phrasings Google completes<span className="ml-1.5 font-normal text-ink-tertiary">· {idea.queriesCount}</span>
                </h2>
                <ul className="mt-3 divide-y divide-hairline-tertiary overflow-hidden rounded-lg border border-hairline">
                  {idea.evidence.topQueries.map((q) => (
                    <li key={q.query}>
                      <a
                        href={`https://www.google.com/search?q=${encodeURIComponent(q.query)}`}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center justify-between gap-3 px-4 py-2.5 transition-colors hover:bg-surface-2/60"
                      >
                        <span className="truncate text-[0.9375rem] text-ink-muted">{q.query}</span>
                        <IconExternalLink size={12} stroke={1.75} className="shrink-0 text-ink-tertiary" />
                      </a>
                    </li>
                  ))}
                </ul>
                <p className="mt-3 text-xs leading-relaxed text-ink-tertiary">
                  Google only completes phrasings real users type — each row above is live demand with no impression number
                  attached, because your site has never appeared for it yet.
                </p>
              </>
            ) : (
              <>
                <h2 className="section-title text-[0.9375rem]">
                  Queries in this cluster<span className="ml-1.5 font-normal text-ink-tertiary">· {idea.queriesCount}</span>
                </h2>
                <table className="mt-3 w-full text-sm">
                  <thead className="text-left text-[0.625rem] uppercase tracking-wider text-ink-tertiary">
                    <tr>
                      <th className="eyebrow pb-3 pt-1 font-medium">Query</th>
                      <th className="eyebrow pb-3 pt-1 text-right font-medium">Impr</th>
                      <th className="eyebrow pb-3 pt-1 text-right font-medium">Clicks</th>
                      <th className="eyebrow pb-3 pt-1 text-right font-medium">Pos</th>
                    </tr>
                  </thead>
                  <tbody>
                    {idea.evidence.topQueries.map((q) => (
                      <tr key={q.query} className="border-t border-hairline-tertiary">
                        <td className="max-w-[320px] truncate py-2.5 pr-4 text-[0.9375rem] text-ink-muted" title={q.query}>{q.query}</td>
                        <td className="py-2.5 pr-4 text-right tabular-nums text-ink-subtle">{nf.format(q.impressions)}</td>
                        <td className="py-2.5 pr-4 text-right tabular-nums text-ink-subtle">{nf.format(q.clicks)}</td>
                        <td className="py-2.5 text-right tabular-nums text-ink-subtle">#{q.position.toFixed(1)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}
          </section>

          {idea.type !== "new-topic" && idea.evidence.autocompletePhrasings.length > 0 && (
            <section className="rounded-xl border border-hairline bg-surface-1 p-6">
              <h2 className="section-title flex items-center gap-2 text-[0.9375rem]">
                Google Autocomplete validation
                {idea.evidence.validated && (
                  <span className="inline-flex items-center gap-1 font-normal text-emerald-400">
                    <IconCheck size={14} stroke={2.5} /> confirmed
                  </span>
                )}
              </h2>
              <div className="mt-4 flex flex-wrap gap-2">
                {idea.evidence.autocompletePhrasings.map((p) => (
                  <a
                    key={p}
                    href={`https://www.google.com/search?q=${encodeURIComponent(p)}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex cursor-pointer items-center gap-1.5 rounded-md bg-surface-2 px-2.5 py-1.5 text-[0.8125rem] text-ink-subtle transition-colors hover:bg-surface-3 hover:text-ink-muted"
                  >
                    {p} <IconExternalLink size={10} stroke={1.75} />
                  </a>
                ))}
              </div>
            </section>
          )}

          <section className="rounded-xl border border-hairline bg-surface-1 p-6">
            <h2 className="section-title text-[0.9375rem]">
              {idea.evidence.coveringPages.length > 0 ? "Your pages currently covering this cluster" : "Coverage"}
            </h2>
            {idea.evidence.coveringPages.length > 0 ? (
              <ul className="mt-3 divide-y divide-hairline-tertiary overflow-hidden rounded-lg border border-hairline">
                {idea.evidence.coveringPages.map((path) => (
                  <li key={path}>
                    <a
                      href={liveUrl(site!, path)}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center justify-between gap-3 px-4 py-2.5 transition-colors hover:bg-surface-2/60"
                    >
                      <span className="truncate text-xs text-ink-subtle" title={path}>{path}</span>
                      <IconExternalLink size={12} stroke={1.75} className="shrink-0 text-ink-tertiary" />
                    </a>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2.5 text-[0.9375rem] leading-relaxed text-ink-subtle">
                {idea.type === "new-topic"
                  ? "None of your crawled pages target this topic — that is exactly why it showed up here."
                  : "None — that is what makes this a coverage gap. The demand lands on scattered pages or nowhere at all."}
              </p>
            )}
          </section>
        </>
      )}
    </div>
  );
}

function Metric({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="rounded-xl border border-hairline bg-surface-1 px-5 py-4">
      <p className="eyebrow">{label}</p>
      <p className={`mt-2 text-lg font-semibold leading-none tracking-[-0.01em] tabular-nums ${accent ? "text-emerald-400" : "text-ink"}`}>{value}</p>
    </div>
  );
}

function BackLink() {
  return (
    <Link href="/dashboard/ideas" className="inline-flex items-center gap-1.5 text-[0.8125rem] font-medium text-ink-tertiary transition-colors hover:text-ink-muted">
      <IconArrowLeft size={14} stroke={1.75} />
      All ideas
    </Link>
  );
}
