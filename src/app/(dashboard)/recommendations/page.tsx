"use client";

import { IconHammer } from "@tabler/icons-react";

export default function RecommendationsPage() {
  const signals = [
    {
      title: "Title & meta rewrites",
      detail: "High impressions + position 5–15 + weak CTR → your snippet is losing the click it already earned.",
      source: "Search Console",
    },
    {
      title: "Content decay alerts",
      detail: "Pages whose clicks/position dropped vs previous period → refresh before rankings slip further.",
      source: "Search Console",
    },
    {
      title: "Tracking gap detection",
      detail: "Google clicks but zero PostHog views → analytics snippet missing or blocked on that page.",
      source: "GSC × PostHog join",
    },
    {
      title: "Striking-distance keywords",
      detail: "Queries at position 8–20 on pages with good engagement → internal links + content expansion to break page 1.",
      source: "Queries × Pages",
    },
  ];

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold tracking-tight">Recommendations</h1>
        <p className="mt-0.5 text-xs text-zinc-500">Actionable fixes ranked by traffic impact</p>
      </div>

      <section className="rounded-xl border border-dashed border-zinc-800 bg-zinc-900/40 px-6 py-10 text-center">
        <IconHammer size={28} className="mx-auto text-zinc-600" stroke={1.5} />
        <h2 className="mt-3 text-sm font-semibold tracking-tight text-zinc-200">Coming in Phase 2–3</h2>
        <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-zinc-400">
          The crawler will fetch each page&apos;s content, apply rules against your Search Console and
          PostHog data, and rank the highest-impact actions here.
        </p>
      </section>

      <section>
        <h2 className="px-1 pb-2 text-[0.6875rem] font-medium uppercase tracking-[0.08em] text-zinc-500">
          What it will detect
        </h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {signals.map((s) => (
            <div key={s.title} className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-medium tracking-tight text-zinc-200">{s.title}</h3>
                <span className="shrink-0 rounded-md bg-zinc-800 px-2 py-0.5 text-[0.625rem] font-medium uppercase tracking-wide text-zinc-400">
                  {s.source}
                </span>
              </div>
              <p className="mt-1.5 text-xs leading-relaxed text-zinc-400">{s.detail}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
