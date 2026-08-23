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
import { ErrorBanner, Loader, nf } from "@/components/widgets";

type AiEnhancement = {
  why: string;
  steps: string[];
  draftTitle: string | null;
  draftMeta: string | null;
  agentPrompt: string | null;
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
  high: "bg-red-500/10 text-red-400",
  medium: "bg-amber-500/10 text-amber-400",
  low: "bg-surface-4 text-ink-subtle",
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
        <section className="rounded-xl border border-dashed border-hairline bg-surface-1/40 px-6 py-12 text-center">
          <p className="text-sm text-ink-subtle">This finding no longer exists — data was re-synced or the issue was fixed.</p>
        </section>
      </div>
    );

  const Icon = TYPE_ICON[rec.type] ?? IconAlertTriangle;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <BackLink />

      <header className="flex items-start gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-surface-3">
          <Icon size={20} stroke={1.75} className="text-ink-muted" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-[1.375rem] font-semibold leading-snug tracking-[-0.015em] text-ink">{rec.title}</h1>
            <span
              className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${SEVERITY_STYLE[rec.severity]}`}
            >
              {rec.severity}
            </span>
          </div>
          <p className="mt-1.5 text-sm capitalize text-ink-tertiary">
            {rec.type} · detected by deterministic rule over your crawled data
          </p>
        </div>
      </header>

      <section className="rounded-xl border border-hairline bg-surface-1 p-6">
        <h2 className="section-title text-[0.9375rem]">What we found</h2>
        <p className="mt-2.5 text-[0.9375rem] leading-relaxed text-ink-muted">{rec.detail}</p>

        {rec.paths && rec.paths.length > 0 ? (
          <div className="mt-4">
            <p className="text-sm font-medium text-ink-subtle">
              Affects {rec.count} pages — likely one shared template. Worst visibility first:
            </p>
            <ul className="mt-2 divide-y divide-hairline-tertiary overflow-hidden rounded-lg border border-hairline">
              {rec.paths.slice(0, 8).map((p) => (
                <li key={p.path}>
                  <a
                    href={liveUrl(site!, p.path)}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center justify-between gap-3 px-4 py-2.5 transition-colors hover:bg-surface-2/60"
                  >
                    <span className="truncate text-[0.8125rem] text-ink-subtle" title={p.path}>
                      {p.path}
                    </span>
                    <span className="flex shrink-0 items-center gap-2 text-xs tabular-nums text-ink-tertiary">
                      impact {nf.format(Math.round(p.impressions))}
                      <IconExternalLink size={12} stroke={1.75} />
                    </span>
                  </a>
                </li>
              ))}
            </ul>
            {rec.count !== undefined && rec.count > 8 && (
              <p className="mt-2 text-xs text-ink-tertiary">+{rec.count - 8} more pages affected</p>
            )}
          </div>
        ) : (
          rec.path && (
            <div className="mt-4 flex items-center justify-between gap-3 rounded-lg border border-hairline bg-surface-2/50 px-4 py-2.5">
              <span className="truncate text-[0.8125rem] text-ink-subtle" title={rec.path}>
                {rec.path}
              </span>
              <a
                href={liveUrl(site!, rec.path)}
                target="_blank"
                rel="noreferrer"
                className="flex shrink-0 items-center gap-1 text-xs font-medium text-primary-hover hover:text-ink"
              >
                Open page <IconExternalLink size={12} stroke={1.75} />
              </a>
            </div>
          )
        )}
      </section>

      <section className="rounded-xl border border-hairline bg-surface-1 p-6">
        <div className="flex items-center justify-between gap-3">
          <h2 className="section-title flex items-center gap-2 text-[0.9375rem]">
            <IconSparkles size={15} stroke={1.75} className="text-primary-hover" />
            AI fix plan
          </h2>
          {!rec.ai ? (
            <button
              onClick={generatePlan}
              disabled={aiBusy}
              className="btn-primary px-3 py-1.5 text-xs"
            >
              {aiBusy ? "Consulting skills library…" : "Generate fix plan"}
            </button>
          ) : !rec.ai.agentPrompt ? (
            <button
              onClick={generatePlan}
              disabled={aiBusy}
              className="btn-secondary px-3 py-1.5 text-xs"
            >
              {aiBusy ? "Consulting skills library…" : "Add agent prompt"}
            </button>
          ) : null}
        </div>

        {aiBusy && <p className="mt-4 animate-pulse text-sm text-primary-hover">Reading your skills library and page evidence…</p>}
        {aiError && (
          <div className="mt-3">
            <ErrorBanner message={aiError} />
          </div>
        )}

        {rec.ai ? (
          <div className="mt-4 space-y-5">
            <div>
              <h3 className="eyebrow">Why it matters</h3>
              <p className="mt-2 text-[0.9375rem] leading-relaxed text-ink-muted">{rec.ai.why}</p>
            </div>

            {rec.ai.steps.length > 0 && (
              <div>
                <h3 className="eyebrow">How to fix it</h3>
                <ol className="mt-3 space-y-3">
                  {rec.ai.steps.map((s, i) => (
                    <li key={i} className="flex items-start gap-3 text-[0.9375rem] leading-relaxed text-ink-muted">
                      <span className="mt-0.5 flex h-5.5 w-5.5 shrink-0 items-center justify-center rounded-full bg-primary/15 text-xs font-semibold text-primary-hover">
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
                <h3 className="eyebrow">Ready-to-use drafts</h3>
                <div className="mt-2 space-y-2">
                  {rec.ai.draftTitle && <Draft label="Title tag" value={rec.ai.draftTitle} />}
                  {rec.ai.draftMeta && <Draft label="Meta description" value={rec.ai.draftMeta} />}
                </div>
              </div>
            )}

            {rec.ai.agentPrompt && <AgentPrompt prompt={rec.ai.agentPrompt} />}
          </div>
        ) : (
          !aiBusy &&
          !aiError && (
            <p className="mt-4 text-[0.9375rem] leading-relaxed text-ink-subtle">
              Quick rule suggestion: <span className="text-ink">{rec.action}</span>
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
    <div className="rounded-lg border border-hairline bg-surface-2/60 p-4">
      <div className="flex items-center justify-between gap-3">
        <span className="eyebrow">{label}</span>
        <button
          onClick={() => {
            void navigator.clipboard.writeText(value).then(() => {
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            });
          }}
          className="cursor-pointer text-xs font-medium text-ink-tertiary transition-colors hover:text-ink-muted"
        >
          {copied ? "Copied ✓" : "Copy"}
        </button>
      </div>
      <p className="mt-2 text-[0.9375rem] leading-relaxed text-ink">{value}</p>
    </div>
  );
}

function AgentPrompt({ prompt }: { prompt: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="rounded-lg border border-primary/25 bg-primary/[0.06] p-4">
      <div className="flex items-center justify-between gap-3">
        <h3 className="eyebrow text-primary-hover">
          Agent prompt — paste into your AI coding agent
        </h3>
        <button
          onClick={() => {
            void navigator.clipboard.writeText(prompt).then(() => {
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            });
          }}
          className="shrink-0 text-[0.6875rem] font-medium text-ink-tertiary transition-colors hover:text-ink-muted"
        >
          {copied ? "Copied ✓" : "Copy prompt"}
        </button>
      </div>
      <p className="mt-1.5 text-xs leading-relaxed text-ink-tertiary">
        Works with Cursor, Claude Code, Copilot Workspace — open your repo, paste, run.
      </p>
      <pre className="mt-3 max-h-72 overflow-auto whitespace-pre-wrap rounded-md border border-hairline bg-canvas p-4 font-mono text-[0.8125rem] leading-relaxed text-ink-muted">
        {prompt}
      </pre>
    </div>
  );
}

function BackLink() {
  return (
    <Link href="/dashboard/recommendations" className="inline-flex items-center gap-1.5 text-[0.8125rem] font-medium text-ink-tertiary transition-colors hover:text-ink-muted">
      <IconArrowLeft size={14} stroke={1.75} />
      All findings
    </Link>
  );
}
