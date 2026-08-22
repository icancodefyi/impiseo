"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  IconAlertTriangle,
  IconArrowLeft,
  IconChartBar,
  IconExternalLink,
  IconFileText,
  IconSearch,
  IconSparkles,
} from "@tabler/icons-react";
import { useDashboard } from "@/lib/dashboard-context";
import { decodeRecId } from "@/lib/rec-id";
import { ErrorBanner, Loader } from "@/components/widgets";

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

function liveUrl(site: string, path: string): string {
  const host = site.replace(/^sc-domain:/, "").replace(/^https?:\/\//, "");
  return `https://${host}${path}`;
}

export default function RecommendationDetailPage() {
  const { site } = useDashboard();
  const params = useParams<{ rid: string }>();
  const recId = decodeRecId(params.rid);

  const [rec, setRec] = useState<Rec | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [aiBusy, setAiBusy] = useState(false);
  const [aiError, setAiError] = useState("");

  const load = useCallback(() => {
    if (!site || !recId) return;
    fetch(`/api/recommendations?site=${encodeURIComponent(site)}`)
      .then(async (res) => {
        if (!res.ok) throw new Error((await res.json()).error ?? `HTTP ${res.status}`);
        return res.json();
      })
      .then((d) => {
        setRec(((d.recommendations ?? []) as Rec[]).find((r) => r.id === recId) ?? null);
        setError("");
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : "Failed to load"))
      .finally(() => setLoading(false));
  }, [site, recId]);

  useEffect(() => {
    load();
  }, [load]);

  async function generatePlan() {
    if (!site || !recId || aiBusy) return;
    setAiBusy(true);
    setAiError("");
    try {
      const res = await fetch(
        `/api/recommendations/enhance?site=${encodeURIComponent(site)}&id=${encodeURIComponent(recId)}`,
        { method: "POST" }
      );
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`);
      await load();
    } catch (e) {
      setAiError(e instanceof Error ? e.message : "AI request failed");
    } finally {
      setAiBusy(false);
    }
  }

  if (!recId)
    return (
      <div className="space-y-4">
        <BackLink />
        <ErrorBanner message="Invalid finding reference." />
      </div>
    );

  if (loading) return <Loader label="Loading issue…" />;

  if (error)
    return (
      <div className="space-y-4">
        <BackLink />
        <ErrorBanner message={error} />
      </div>
    );

  if (!rec)
    return (
      <div className="space-y-4">
        <BackLink />
        <section className="rounded-xl border border-dashed border-zinc-800 bg-zinc-900/40 px-6 py-12 text-center">
          <p className="text-sm text-zinc-400">This finding no longer exists — data was re-synced or the issue was fixed.</p>
        </section>
      </div>
    );

  const Icon = TYPE_ICON[rec.type] ?? IconAlertTriangle;

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <BackLink />

      <header className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-zinc-800/80">
          <Icon size={19} stroke={1.75} className="text-zinc-300" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-lg font-semibold leading-snug tracking-tight">{rec.title}</h1>
            <span
              className={`shrink-0 rounded-md px-2 py-0.5 text-[0.625rem] font-semibold uppercase tracking-wide ${SEVERITY_STYLE[rec.severity]}`}
            >
              {rec.severity}
            </span>
          </div>
          <p className="mt-1 text-xs capitalize text-zinc-600">
            {rec.type} · detected by deterministic rule over your crawled data
          </p>
        </div>
      </header>

      <section className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
        <h2 className="text-[0.6875rem] font-semibold uppercase tracking-wider text-zinc-500">What we found</h2>
        <p className="mt-2 text-sm leading-relaxed text-zinc-300">{rec.detail}</p>

        {rec.paths && rec.paths.length > 0 ? (
          <div className="mt-4">
            <p className="text-xs font-medium text-zinc-500">
              Affects {rec.count} pages — likely one shared template. Worst visibility first:
            </p>
            <ul className="mt-2 divide-y divide-zinc-800/60 overflow-hidden rounded-lg border border-zinc-800/70">
              {rec.paths.slice(0, 8).map((p) => (
                <li key={p.path}>
                  <a
                    href={liveUrl(site!, p.path)}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center justify-between gap-3 px-3 py-2 transition hover:bg-zinc-800/40"
                  >
                    <span className="truncate text-xs text-zinc-400" title={p.path}>
                      {p.path}
                    </span>
                    <span className="flex shrink-0 items-center gap-2 text-[0.6875rem] text-zinc-600">
                      impact {Math.round(p.impressions)}
                      <IconExternalLink size={12} stroke={1.75} />
                    </span>
                  </a>
                </li>
              ))}
            </ul>
            {rec.count !== undefined && rec.count > 8 && (
              <p className="mt-1.5 text-[0.6875rem] text-zinc-600">+{rec.count - 8} more pages affected</p>
            )}
          </div>
        ) : (
          rec.path && (
            <div className="mt-4 flex items-center justify-between gap-3 rounded-lg border border-zinc-800/70 bg-zinc-950/50 px-3 py-2">
              <span className="truncate text-xs text-zinc-400" title={rec.path}>
                {rec.path}
              </span>
              <a
                href={liveUrl(site!, rec.path)}
                target="_blank"
                rel="noreferrer"
                className="flex shrink-0 items-center gap-1 text-[0.6875rem] font-medium text-emerald-400 hover:text-emerald-300"
              >
                Open page <IconExternalLink size={12} stroke={1.75} />
              </a>
            </div>
          )
        )}
      </section>

      <section className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
        <div className="flex items-center justify-between gap-3">
          <h2 className="flex items-center gap-1.5 text-[0.6875rem] font-semibold uppercase tracking-wider text-zinc-500">
            <IconSparkles size={13} stroke={1.75} className="text-emerald-400" />
            AI fix plan
          </h2>
          {!rec.ai && (
            <button
              onClick={generatePlan}
              disabled={aiBusy}
              className="flex items-center gap-1.5 rounded-lg bg-emerald-500/15 px-3 py-1.5 text-xs font-medium text-emerald-400 transition hover:bg-emerald-500/25 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {aiBusy ? "Consulting skills library…" : "Generate fix plan"}
            </button>
          )}
        </div>

        {aiBusy && <p className="mt-3 animate-pulse text-xs text-emerald-400">Reading your skills library and page evidence…</p>}
        {aiError && (
          <div className="mt-3">
            <ErrorBanner message={aiError} />
          </div>
        )}

        {rec.ai ? (
          <div className="mt-3 space-y-4">
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Why it matters</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-zinc-300">{rec.ai.why}</p>
            </div>

            {rec.ai.steps.length > 0 && (
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">How to fix it</h3>
                <ol className="mt-2 space-y-2.5">
                  {rec.ai.steps.map((s, i) => (
                    <li key={i} className="flex items-start gap-2.5 text-sm leading-relaxed text-zinc-300">
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-500/15 text-[0.625rem] font-bold text-emerald-400">
                        {i + 1}
                      </span>
                      {s}
                    </li>
                  ))}
                </ol>
              </div>
            )}

            {(rec.ai.draftTitle || rec.ai.draftMeta) && (
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Ready-to-use drafts</h3>
                <div className="mt-2 space-y-2">
                  {rec.ai.draftTitle && <Draft label="Title tag" value={rec.ai.draftTitle} />}
                  {rec.ai.draftMeta && <Draft label="Meta description" value={rec.ai.draftMeta} />}
                </div>
              </div>
            )}
          </div>
        ) : (
          !aiBusy &&
          !aiError && (
            <p className="mt-3 text-sm leading-relaxed text-zinc-400">
              Quick rule suggestion: <span className="text-zinc-200">{rec.action}</span>
            </p>
          )
        )}
      </section>
    </div>
  );
}

function Draft({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="rounded-lg border border-emerald-900/40 bg-emerald-950/20 p-3">
      <div className="flex items-center justify-between gap-3">
        <span className="text-[0.6875rem] font-semibold uppercase tracking-wide text-emerald-500/80">{label}</span>
        <button
          onClick={() => {
            void navigator.clipboard.writeText(value).then(() => {
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            });
          }}
          className="text-[0.6875rem] font-medium text-zinc-500 transition hover:text-zinc-300"
        >
          {copied ? "Copied ✓" : "Copy"}
        </button>
      </div>
      <p className="mt-1.5 text-sm leading-relaxed text-zinc-100">{value}</p>
    </div>
  );
}

function BackLink() {
  return (
    <Link href="/dashboard/recommendations" className="inline-flex items-center gap-1 text-xs font-medium text-zinc-500 transition hover:text-zinc-300">
      <IconArrowLeft size={14} stroke={1.75} />
      All findings
    </Link>
  );
}
