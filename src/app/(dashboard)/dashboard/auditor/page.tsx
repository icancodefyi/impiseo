"use client";

import { useMemo, useState } from "react";
import { useDashboard } from "@/lib/dashboard-context";
import { ErrorBanner, Loader, PageHeader } from "@/components/widgets";

const GREEN = "#0cce6b";
const ORANGE = "#ffa400";
const RED = "#ff4e42";

type Audit = {
  id: string;
  title: string;
  description?: string;
  score: number | null;
  scoreDisplayMode: string;
  displayValue?: string;
  numericValue?: number;
  details?: {
    type?: string;
    overallSavingsMs?: number;
    overallSavingsBytes?: number;
    items?: (Record<string, unknown> & { url?: string; description?: string })[];
  };
};

type AuditRef = { id: string; weight?: number; group?: string };
type Category = { title: string; score: number | null; auditRefs: AuditRef[] };
type Categories = { performance?: Category; accessibility?: Category; "best-practices"?: Category; seo?: Category; pwa?: Category };

type LoadingExperience = {
  overall_category?: string;
  metrics?: Record<string, { category?: string; percentile?: number; distributions?: FieldDist[] }>;
};

type AuditorResponse = {
  requestedUrl: string | null;
  finalUrl: string | null;
  fetchTime: string | null;
  loadingExperience: LoadingExperience | null;
  originLoadingExperience: Record<string, unknown> | null;
  lighthouseResult: {
    categories: Categories | null;
    audits: Record<string, Audit> | null;
    fetchTime: string | null;
  } | null;
  disabled?: boolean;
  keyMissing?: boolean;
  error?: string;
};

function scoreColor(score: number) {
  if (score >= 90) return GREEN;
  if (score >= 50) return ORANGE;
  return RED;
}

function ScoreRing({ score, size = 96 }: { score: number; size?: number }) {
  const r = (size - 10) / 2;
  const c = 2 * Math.PI * r;
  const frac = Math.max(score, 1) / 100;
  const col = scoreColor(score);
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} stroke="#202329" strokeWidth={10} fill="none" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={col}
          strokeWidth={10}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${c * frac} ${c}`}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-[1.6rem] font-semibold leading-none tabular-nums text-ink" style={{ color: col }}>
          {score}
        </span>
        <span className="mt-0.5 text-[10px] uppercase tracking-wide text-ink-tertiary">/100</span>
      </div>
    </div>
  );
}

function fmtBytes(v: number) {
  const kb = v / 1024;
  if (kb >= 1024) return `${(kb / 1024).toFixed(1)} MB`;
  return `${kb.toFixed(kb < 10 ? 1 : 0)} KB`;
}

function fmtMs(v: number) {
  if (v >= 1000) return `${(v / 1000).toFixed(v >= 10000 ? 0 : 1)} s`;
  return `${Math.round(v)} ms`;
}

const FIELD_META: Record<string, { label: string; unit: (v: number) => string; keys: string[] }> = {
  lcp: { label: "Largest Contentful Paint", unit: fmtMs, keys: ["LARGEST_CONTENTFUL_PAINT_MS"] },
  inp: { label: "Interaction to Next Paint", unit: fmtMs, keys: ["INTERACTION_TO_NEXT_PAINT", "INTERACTION_TO_NEXT_PAINT_MS"] },
  cls: { label: "Cumulative Layout Shift", unit: (v) => v.toFixed(2), keys: ["CUMULATIVE_LAYOUT_SHIFT_SCORE"] },
  fcp: { label: "First Contentful Paint", unit: fmtMs, keys: ["FIRST_CONTENTFUL_PAINT_MS"] },
};

type FieldDist = { proportion?: number; category?: string };
type FieldMetricData = {
  key: string;
  label: string;
  unit: (v: number) => string;
  category?: string;
  percentile?: number;
  distributions?: FieldDist[];
};

function FieldMetric({ metric }: { metric: FieldMetricData }) {
  return (
    <div className="flex items-center gap-4 py-2.5">
      <div className="w-56 shrink-0">
        <p className="text-sm font-medium text-ink">{metric.label}</p>
        <p className="text-xs text-ink-tertiary">
          {metric.percentile !== undefined && metric.percentile !== null ? metric.unit(metric.percentile) : "no data"}
        </p>
      </div>
      <div className="flex h-6 flex-1 overflow-hidden rounded-md">
        {(metric.distributions ?? [])
          .filter((d) => typeof d.proportion === "number")
          .map((d, i) => (
            <div
              key={i}
              style={{
                width: `${d.proportion! * 100}%`,
                background: d.category === "FAST" || d.category === "GOOD" ? GREEN : d.category === "SLOW" || d.category === "POOR" ? RED : ORANGE,
              }}
            />
          ))}
      </div>
      <span
        className={`shrink-0 rounded-md px-2 py-0.5 text-xs font-medium ${
          metric.category === "FAST" || metric.category === "GOOD"
            ? "bg-emerald-500/10 text-emerald-400"
            : metric.category === "SLOW" || metric.category === "POOR"
            ? "bg-red-500/10 text-red-300"
            : metric.category === "AVERAGE" || metric.category === "NEEDS"
            ? "bg-amber-500/10 text-amber-400"
            : "bg-surface-4 text-ink-subtle"
        }`}
      >
        {metric.category ?? "—"}
      </span>
    </div>
  );
}

function savingsOf(a: Audit): number {
  const bytes = a.details?.overallSavingsBytes ?? 0;
  const ms = a.details?.overallSavingsMs ?? 0;
  return Math.max(ms / 1000, bytes / (1024 * 1024));
}

function AuditRow({ audit }: { audit: Audit }) {
  const [open, setOpen] = useState(false);
  const score = audit.score !== null ? Math.round(audit.score * 100) : null;
  const bad = score !== null && score < 90;
  const items = (audit.details?.items ?? []).slice(0, 8);

  return (
    <div className="border-t border-hairline-tertiary">
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full cursor-pointer items-center gap-3 px-6 py-3 text-left transition-colors hover:bg-surface-2/50"
      >
        {score !== null ? (
          <span
            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold tabular-nums"
            style={{ background: `${scoreColor(score)}22`, color: scoreColor(score) }}
          >
            {score}
          </span>
        ) : (
          <span className="h-6 w-6 shrink-0 rounded-full bg-surface-4" title="informative" />
        )}
        <span className="flex-1 text-sm font-medium text-ink">{audit.title}</span>
        {audit.displayValue && <span className="shrink-0 text-xs font-medium tabular-nums text-ink-subtle">{audit.displayValue}</span>}
        <span className={`text-xs ${bad ? "text-red-400" : "text-ink-tertiary"} ${open ? "rotate-180" : ""}`}>▾</span>
      </button>
      {open && (
        <div className="space-y-2 px-6 pb-4">
          {audit.description && <p className="text-xs leading-relaxed text-ink-muted">{audit.description}</p>}
          {(audit.details?.overallSavingsMs ?? 0) > 0 && (
            <p className="text-xs font-medium text-emerald-400">Potential savings: {fmtMs(audit.details!.overallSavingsMs!)}</p>
          )}
          {(audit.details?.overallSavingsBytes ?? 0) > 0 && (
            <p className="text-xs font-medium text-emerald-400">Potential savings: {fmtBytes(audit.details!.overallSavingsBytes!)}</p>
          )}
          {items.length > 0 && (
            <div className="space-y-1">
              {items.map((it, i) => {
                const wastedBytes = Number(it.wastedBytes) || 0;
                const totalBytes = Number(it.totalBytes) || 0;
                const wastedMs = Number(it.wastedMs) || 0;
                return (
                  <div key={i} className="flex items-center justify-between gap-3 rounded-md bg-surface-2/50 px-3 py-1.5 text-xs">
                    <span className="truncate font-mono text-ink-muted" title={it.url ?? String(it)}>
                      {(it.url ?? it.description ?? String(it)).slice(0, 90)}
                    </span>
                    <span className="flex shrink-0 items-center gap-2 font-medium tabular-nums text-ink-subtle">
                      {wastedMs > 0 && <span className="text-emerald-400">{fmtMs(wastedMs)}</span>}
                      {wastedBytes > 0 && (
                        <span className="text-red-300">
                          {fmtBytes(wastedBytes)}
                          {totalBytes > 0 && <span className="text-ink-tertiary"> of {fmtBytes(totalBytes)}</span>}
                        </span>
                      )}
                      {wastedBytes === 0 && totalBytes > 0 && <span>{fmtBytes(totalBytes)}</span>}
                    </span>
                  </div>
                );
              })}
              {items.length < (audit.details?.items?.length ?? 0) && (
                <p className="text-[10px] text-ink-tertiary">…{audit.details!.items!.length - items.length} more</p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function CategoryBlock({
  title,
  category,
  audits,
}: {
  title: string;
  category: Category;
  audits: Record<string, Audit> | null;
}) {
  const rows = useMemo(() => {
    const refs = category.auditRefs ?? [];
    const all: Audit[] = refs
      .map((r) => audits?.[r.id])
      .filter((a): a is Audit => a !== undefined && a !== null && a.scoreDisplayMode !== "notApplicable");
    const issues = all
      .filter((a) => a.score !== null && a.score < 0.9)
      .sort((a, b) => savingsOf(b) - savingsOf(a));
    const passed = all.filter((a) => a.score !== null && a.score >= 0.9);
    const info = all.filter((a) => a.score === null).slice(0, 4);
    return { issues, passed, info };
  }, [category, audits]);

  if (!category) return null;
  const score = category.score !== null ? Math.round(category.score * 100) : null;

  return (
    <section id={title.toLowerCase().replace(/\s+/g, "-")} className="scroll-mt-20 overflow-hidden rounded-xl border border-hairline bg-surface-1">
      <div className="flex items-center justify-between border-b border-hairline px-6 py-4">
        <h2 className="section-title">
          {title}
          {score !== null && (
            <span className="ml-2 rounded-md px-2 py-0.5 text-xs font-semibold" style={{ background: `${scoreColor(score)}22`, color: scoreColor(score) }}>
              {score}
            </span>
          )}
        </h2>
      </div>
      {rows.issues.length === 0 && rows.info.length === 0 && (
        <p className="px-6 py-6 text-center text-sm text-ink-subtle">No issues found — all checks passed.</p>
      )}
      {rows.issues.map((a) => (
        <AuditRow key={a.id} audit={a} />
      ))}
      {rows.info.map((a) => (
        <AuditRow key={a.id} audit={a} />
      ))}
      {rows.passed.length > 0 && (
        <details className="border-t border-hairline-tertiary px-6 py-3 text-sm text-ink-subtle">
          <summary className="cursor-pointer">✓ {rows.passed.length} passed audits</summary>
          <ul className="mt-2 list-inside list-disc space-y-1 text-ink-muted">
            {rows.passed.map((a) => (
              <li key={a.id}>{a.title}</li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}

export default function AuditorPage() {
  const { site } = useDashboard();

  const defaultUrl = site ? (site.startsWith("sc-domain:") ? `https://${site.replace("sc-domain:", "")}/` : site) : "";
  const [url, setUrl] = useState("");
  const [strategy, setStrategy] = useState<"mobile" | "desktop">("mobile");
  const [data, setData] = useState<AuditorResponse | null>(null);
  const [error, setError] = useState("");
  const [running, setRunning] = useState(false);

  const effectiveUrl = url.trim() || defaultUrl;

  const run = async () => {
    if (!effectiveUrl || running) return;
    setRunning(true);
    setError("");
    setData(null);
    try {
      const p = new URLSearchParams({ url: effectiveUrl, strategy });
      const res = await fetch(`/api/auditor?${p.toString()}`);
      if (!res.ok) throw new Error((await res.json()).error ?? `HTTP ${res.status}`);
      const j = (await res.json()) as AuditorResponse;
      if (j.error && !j.disabled && !j.keyMissing) throw new Error(j.error);
      setData(j);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setRunning(false);
    }
  };

  const lh = data?.lighthouseResult;
  const cats = lh?.categories;
  const perfScore = cats?.performance?.score !== null && cats?.performance?.score !== undefined ? Math.round(cats.performance.score * 100) : null;
  const otherCats: { key: string; cat: Category }[] = [
    { key: "Accessibility", cat: cats?.accessibility },
    { key: "Best Practices", cat: cats?.["best-practices"] },
    { key: "SEO", cat: cats?.seo },
    { key: "PWA", cat: cats?.pwa },
  ].flatMap((c) => {
    const cat = c.cat;
    if (!cat || cat.score === null || cat.score === undefined) return [];
    return [{ key: c.key, cat }];
  });

  const fieldMetrics = useMemo(() => {
    const metrics = data?.loadingExperience?.metrics;
    if (!metrics) return [];
    const out: FieldMetricData[] = [];
    for (const meta of Object.values(FIELD_META)) {
      const key = meta.keys.find((k) => k in metrics);
      if (!key) continue;
      const raw = metrics[key];
      if (!raw) continue;
      out.push({
        key,
        label: meta.label,
        unit: meta.unit,
        category: raw.category,
        percentile: raw.percentile,
        distributions: raw.distributions,
      });
    }
    return out;
  }, [data]);

  const overall = data?.loadingExperience?.overall_category;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Auditor"
        subtitle="Full-page audit like PageSpeed Insights — a real Lighthouse run per URL with field CrUX data"
      />

      <div className="rounded-xl border border-hairline bg-surface-1 p-4">
        <div className="flex flex-wrap items-center gap-3">
          <input
            value={effectiveUrl}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && run()}
            placeholder="https://your-site.com/"
            className="input-base min-w-[260px] flex-1"
          />
          <div className="flex rounded-lg border border-hairline bg-surface-2 p-1">
            {(["mobile", "desktop"] as const).map((s) => (
              <button
                key={s}
                onClick={() => setStrategy(s)}
                className={`cursor-pointer rounded-md px-3 py-1.5 text-sm capitalize transition-colors ${
                  strategy === s ? "bg-surface-3 font-medium text-ink" : "text-ink-subtle hover:text-ink-muted"
                }`}
              >
                {s}
              </button>
            ))}
          </div>
          <button onClick={run} disabled={running || !effectiveUrl} className="btn-secondary">
            {running ? "Running…" : "Analyze"}
          </button>
        </div>
        {running && <p className="mt-3 text-xs text-ink-subtle">Running a real Lighthouse pass — this takes ~20-60 seconds.</p>}
      </div>

      {error && <ErrorBanner message={error} />}

      {data?.keyMissing && (
        <div className="rounded-lg border border-amber-500/25 bg-amber-500/[0.07] px-4 py-3 text-sm leading-relaxed text-amber-200/90">
          No Google API key configured. Set <code className="rounded bg-surface-2 px-1.5 py-0.5">GOOGLE_API_KEY</code> (or{" "}
          <code className="rounded bg-surface-2 px-1.5 py-0.5">CRUX_API_KEY</code>) in <code className="rounded bg-surface-2 px-1.5 py-0.5">.env.local</code> and restart.
        </div>
      )}

      {data?.disabled && (
        <div className="rounded-lg border border-amber-500/25 bg-amber-500/[0.07] px-4 py-3 text-sm leading-relaxed text-amber-200/90">
          <strong>PageSpeed Insights API is not enabled for this key.</strong> Enable it at{" "}
          <a
            href="https://console.developers.google.com/apis/api/pagespeedonline.googleapis.com/overview"
            target="_blank"
            rel="noreferrer"
            className="underline"
          >
            console.developers.google.com → PageSpeed Insights API
          </a>{" "}
          (project <code className="rounded bg-surface-2 px-1.5 py-0.5">872969097090</code>), wait ~1-2 minutes, then re-run.
        </div>
      )}

      {running && <Loader label="Running Lighthouse audit…" />}

      {lh && (
        <>
          <div className="rounded-xl border border-hairline bg-surface-1 p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-ink">{data?.finalUrl ?? data?.requestedUrl ?? url}</p>
                <p className="text-xs text-ink-tertiary">
                  {strategy === "mobile" ? "Mobile" : "Desktop"} · analyzed {lh.fetchTime ? new Date(lh.fetchTime).toLocaleString() : ""} · real Lighthouse run
                </p>
              </div>
              <a href={url} target="_blank" rel="noreferrer" className="rounded-md border border-hairline bg-surface-2 px-3 py-1.5 text-xs text-ink-subtle hover:text-ink">
                Open live page ↗
              </a>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <div className="rounded-xl border border-hairline bg-surface-1 p-6 lg:col-span-1">
              <p className="eyebrow">Performance</p>
              {perfScore !== null && (
                <div className="mt-4 flex justify-center">
                  <ScoreRing score={perfScore} size={150} />
                </div>
              )}
            </div>
            <div className="grid grid-cols-2 gap-4 lg:col-span-2 lg:grid-cols-4">
              {otherCats.map(({ key, cat }) => {
                const s = cat?.score !== null && cat?.score !== undefined ? Math.round(cat!.score * 100) : null;
                return (
                  <div key={key} className="flex flex-col items-center justify-center rounded-xl border border-hairline bg-surface-1 p-5">
                    {s !== null ? <ScoreRing score={s} size={72} /> : <span className="text-xs text-ink-tertiary">n/a</span>}
                    <p className="mt-2 text-xs font-medium text-ink-subtle">{key}</p>
                  </div>
                );
              })}
            </div>
          </div>

          {(fieldMetrics.length > 0 || data?.loadingExperience) && (
            <div className="rounded-xl border border-hairline bg-surface-1">
              <div className="flex flex-wrap items-center justify-between border-b border-hairline px-6 py-4">
                <h2 className="section-title">Field data</h2>
                {overall && (
                  <span
                    className={`rounded-md px-2 py-0.5 text-xs font-semibold ${
                      overall === "FAST"
                        ? "bg-emerald-500/10 text-emerald-400"
                        : overall === "AVERAGE"
                        ? "bg-amber-500/10 text-amber-400"
                        : "bg-red-500/10 text-red-300"
                    }`}
                  >
                    {overall.toUpperCase()} · from real CrUX users
                  </span>
                )}
              </div>
              <div className="divide-y divide-hairline-tertiary px-6 py-2">
                {fieldMetrics.length === 0 && <p className="py-4 text-sm text-ink-subtle">No aggregated field data for this page yet.</p>}
                {fieldMetrics.map((m) => (
                  <FieldMetric key={m.key} metric={m} />
                ))}
              </div>
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            {perfScore !== null &&
              otherCats.map(({ key }) => (
                <a key={key} href={`#${key.toLowerCase().replace(/\s+/g, "-")}`} className="rounded-md border border-hairline bg-surface-1 px-3 py-1.5 text-xs text-ink-subtle hover:text-ink">
                  {key}
                </a>
              ))}
          </div>

          <div className="space-y-5">
            {cats?.performance && <CategoryBlock title="Performance" category={cats.performance} audits={lh.audits} />}
            {cats?.accessibility && <CategoryBlock title="Accessibility" category={cats.accessibility} audits={lh.audits} />}
            {cats?.["best-practices"] && <CategoryBlock title="Best Practices" category={cats["best-practices"]} audits={lh.audits} />}
            {cats?.seo && <CategoryBlock title="SEO" category={cats.seo} audits={lh.audits} />}
            {cats?.pwa && <CategoryBlock title="PWA" category={cats.pwa} audits={lh.audits} />}
          </div>

          <p className="text-xs leading-relaxed text-ink-tertiary">
            Powered by the free PageSpeed Insights API (Lighthouse 12+). Scores are lab results for one run from Google&apos;s
            servers; field data is CrUX real-user percentile data over 28 days. Scores will vary between runs.
          </p>
        </>
      )}
    </div>
  );
}