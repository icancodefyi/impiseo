"use client";

import { useEffect, useState } from "react";
import { Loader } from "@/components/widgets";

type ContentIssue = { id: string; label: string };

type FixData = {
  url: string | null;
  crawled: boolean;
  content: {
    title: string | null;
    metaDescription: string | null;
    canonical: string | null;
    httpStatus: number;
    wordCount: number;
    headings: string[];
    structuredDataSet: boolean;
  } | null;
  topQueries: { query: string; impressions: number; position: number }[];
  brand: string;
  drafts: {
    draftTitle?: string | null;
    draftMeta?: string | null;
    canonicalTag?: string | null;
    schemaJson?: string | null;
    thinAdvice?: string | null;
  };
};

type Brief = {
  issueId: string;
  why: string;
  action: string;
  implementation: string;
  agentPrompt: string;
};

function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => {
        navigator.clipboard?.writeText(text).catch(() => {});
        setCopied(true);
        setTimeout(() => setCopied(false), 1200);
      }}
      className="shrink-0 cursor-pointer rounded-md border border-hairline bg-surface-2 px-2 py-1 text-xs text-ink-subtle transition-colors hover:text-ink"
    >
      {copied ? "Copied ✓" : label}
    </button>
  );
}

function Pre({ children }: { children: string }) {
  return (
    <div className="flex items-start justify-between gap-3 rounded-lg bg-surface-2/60 p-3">
      <pre className="whitespace-pre-wrap break-all font-mono text-xs leading-relaxed text-ink-muted">{children}</pre>
      <CopyButton text={children} label="Copy" />
    </div>
  );
}

export function TechFixModal({
  pagePath,
  issues,
  site,
  days,
  onClose,
}: {
  pagePath: string;
  issues: ContentIssue[];
  site: string;
  days: number;
  onClose: () => void;
}) {
  const [data, setData] = useState<FixData | null>(null);
  const [error, setError] = useState("");
  const [briefs, setBriefs] = useState<Brief[]>([]);
  const [briefing, setBriefing] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch(
      `/api/technical/fix?site=${encodeURIComponent(site)}&path=${encodeURIComponent(pagePath)}&days=${days}`
    )
      .then(async (res) => {
        if (!res.ok) throw new Error((await res.json()).error ?? `HTTP ${res.status}`);
        return res.json();
      })
      .then((j: FixData) => {
        if (cancelled) return;
        setData(j);
        setError("");
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      });
    return () => {
      cancelled = true;
    };
  }, [site, pagePath, days]);

  const brief = (issueId: string) => briefs.find((b) => b.issueId === issueId);

  const generateBrief = async () => {
    if (!data || briefing) return;
    setBriefing(true);
    setError("");
    try {
      const res = await fetch("/api/technical/fix", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          site,
          path: pagePath,
          issues,
          content: data.content,
          topQueries: data.topQueries,
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? `HTTP ${res.status}`);
      const j = (await res.json()) as { briefs: Brief[] };
      setBriefs(j.briefs);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBriefing(false);
    }
  };

  const draftFor = (issueId: string): string | null => {
    if (!data) return null;
    switch (issueId) {
      case "title-missing":
      case "title-long":
        return data.drafts.draftTitle ?? null;
      case "meta-missing":
      case "meta-long":
        return data.drafts.draftMeta ?? null;
      case "canonical-missing":
        return data.drafts.canonicalTag ?? null;
      case "schema-missing":
        return data.drafts.schemaJson ?? null;
      case "thin":
        return data.drafts.thinAdvice ?? null;
      default:
        return null;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 p-4 backdrop-blur-sm md:p-10">
      <div className="flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-hairline bg-surface-1 shadow-2xl">
        <div className="flex items-center justify-between gap-4 border-b border-hairline px-6 py-4">
          <div className="min-w-0">
            <p className="text-sm font-medium text-ink">Fix this page</p>
            <p className="truncate font-mono text-xs text-ink-tertiary">{pagePath}</p>
          </div>
          <button onClick={onClose} className="cursor-pointer rounded-lg px-2 py-1 text-ink-subtle hover:bg-surface-2 hover:text-ink">
            ✕
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-auto px-6 py-5">
          {error && <div className="rounded-lg border border-red-500/25 bg-red-500/[0.07] px-4 py-3 text-sm text-red-300">{error}</div>}

          {!data && !error && <Loader label="Preparing fix drafts…" />}

          {data && !data.crawled && (
            <p className="text-sm text-ink-subtle">
              This page hasn&apos;t been crawled yet — drafts below are keyword-based only. Run a crawl to get heading/word-count evidence.
            </p>
          )}

          {data?.content && (
            <div className="space-y-1.5 rounded-lg border border-hairline bg-surface-2/40 p-4 text-sm">
              <p className="eyebrow">Current</p>
              <p className="text-ink-muted">
                <span className="text-ink-subtle">Title:</span> {data.content.title ?? "—"}
              </p>
              <p className="text-ink-muted">
                <span className="text-ink-subtle">Meta:</span> {data.content.metaDescription ?? "—"}
              </p>
              <p className="text-ink-muted">
                <span className="text-ink-subtle">Words:</span> {data.content.wordCount} ·{" "}
                <span className="text-ink-subtle">Status:</span> HTTP {data.content.httpStatus} ·{" "}
                <span className="text-ink-subtle">Schema:</span> {data.content.structuredDataSet ? "set" : "none"}
              </p>
            </div>
          )}

          {data && data.topQueries.length > 0 && (
            <div className="space-y-1.5">
              <p className="eyebrow">Top queries for this page</p>
              <div className="flex flex-wrap gap-1.5">
                {data.topQueries.map((q) => (
                  <span key={q.query} className="rounded-md bg-surface-2 px-2 py-1 text-xs text-ink-muted" title={`impressions: ${q.impressions}`}>
                    {q.query}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="eyebrow">Fixes</p>
              <button
                onClick={generateBrief}
                disabled={!data || briefing}
                className="cursor-pointer rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50"
              >
                {briefing ? "Generating…" : briefs.length ? "Regenerate AI brief" : "Generate AI fix brief"}
              </button>
            </div>

            {issues.length === 0 && <p className="text-sm text-ink-subtle">No issues</p>}

            {issues.map((issue) => {
              const b = brief(issue.id);
              const draft = draftFor(issue.id);
              return (
                <div key={issue.id} className="space-y-2 rounded-lg border border-hairline bg-surface-1 p-4">
                  <p className="text-sm font-medium text-ink">⚠ {issue.label}</p>
                  {b && (
                    <div className="space-y-2 text-sm">
                      <p className="leading-relaxed text-ink-muted">{b.why}</p>
                      <p className="text-ink">
                        <span className="font-medium text-ink-subtle">Do: </span>
                        {b.action}
                      </p>
                      {b.implementation && (
                        <div className="space-y-1">
                          <p className="text-xs font-medium text-ink-subtle">Implementation</p>
                          <Pre>{b.implementation}</Pre>
                        </div>
                      )}
                      {b.agentPrompt && (
                        <div className="space-y-1">
                          <p className="text-xs font-medium text-ink-subtle">Agent prompt (paste into your AI coding agent)</p>
                          <Pre>{b.agentPrompt}</Pre>
                        </div>
                      )}
                    </div>
                  )}
                  {!b && draft && (
                    <div className="space-y-1">
                      <p className="text-xs font-medium text-ink-subtle">Draft (deterministic) — or hit &quot;Generate AI fix brief&quot; for a tailored rewrite</p>
                      <Pre>{draft}</Pre>
                    </div>
                  )}
                  {!b && !draft && (
                    <p className="text-sm text-ink-subtle">
                      No automatic draft for this issue — use the AI brief for a tailored fix.
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}