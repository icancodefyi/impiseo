import { Container, Eyebrow } from "./ui";

function ImpactCard() {
  const rows = [
    { sev: "high", sevCls: "bg-[#5e6ad2]/15 text-[#828fff]", title: "Tracking gap — 96 clicks, zero views", impact: "impact 9,600" },
    { sev: "medium", sevCls: "bg-white/5 text-[#8a8f98]", title: "Striking distance — ranks #4.2", impact: "impact 1,412" },
    { sev: "low", sevCls: "bg-white/5 text-[#8a8f98]", title: "Title truncated in SERP (×38 pages)", impact: "impact 1,208" },
  ];
  return (
    <div className="flex h-full flex-col rounded-xl border border-[#23252a] bg-[#0c0d10] p-6 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
      <h3 className="text-[22px] font-medium leading-[1.25] tracking-[-0.01em] text-[#f7f8f8]">
        Every issue ranked by the traffic at stake
      </h3>
      <p className="mt-2 max-w-md text-sm leading-relaxed text-[#8a8f98]">
        Severity × impressions. A missing meta on a page nobody sees never reaches your inbox; a tracking gap on
        your top earner floats to the top.
      </p>
      <div className="mt-5 space-y-1.5">
        {rows.map((r) => (
          <div key={r.title} className="flex items-center gap-3 rounded-lg border border-[#23252a]/70 bg-[#101114] px-3.5 py-2.5">
            <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase ${r.sevCls}`}>{r.sev}</span>
            <span className="min-w-0 flex-1 truncate text-xs text-[#d0d6e0]">{r.title}</span>
            <code className="shrink-0 font-mono text-[11px] text-[#62666d]">{r.impact}</code>
          </div>
        ))}
      </div>
    </div>
  );
}

function CrawlerCard() {
  return (
    <div className="flex h-full flex-col rounded-xl border border-[#23252a] bg-[#0c0d10] p-6 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
      <h3 className="text-[22px] font-medium leading-[1.25] tracking-[-0.01em] text-[#f7f8f8]">
        A crawler that plays nice
      </h3>
      <p className="mt-2 text-sm leading-relaxed text-[#8a8f98]">
        ImpiseoBot reads robots.txt, keeps two-second pacing, and revalidates with ETags. Your server barely notices.
      </p>
      <div className="mt-5 rounded-lg border border-[#23252a]/70 bg-[#101114] p-4">
        <div className="flex items-center justify-between font-mono text-[11px]">
          <span className="text-[#d0d6e0]">impiseobot/0.1</span>
          <span className="text-[#62666d]">45 / 138 pages</span>
        </div>
        <div className="mt-2.5 h-1 overflow-hidden rounded-full bg-[#14161a]">
          <div className="h-full w-[33%] rounded-full bg-[#5e6ad2]" />
        </div>
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 font-mono text-[11px] text-[#62666d]">
          <span>robots.txt ✓</span>
          <span>etag 304 ✓</span>
          <span>2s pacing ✓</span>
        </div>
      </div>
    </div>
  );
}

const SKILLS = ["10x-more-traffic.md", "seo-course.md", "chatgpt-recommendation.md", "+3 more"];

function CopilotCard() {
  return (
    <div className="grid gap-8 rounded-xl border border-[#23252a] bg-[#0c0d10] p-6 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] sm:p-8 lg:grid-cols-2 lg:items-center">
      <div>
        <h3 className="text-[22px] font-medium leading-[1.25] tracking-[-0.01em] text-[#f7f8f8]">
          An AI that studied the playbooks
        </h3>
        <p className="mt-2 text-sm leading-relaxed text-[#8a8f98]">
          The copilot is grounded in a curated library of SEO expert transcripts and methodology — the same playbooks
          agencies charge four figures for. Feed it more knowledge anytime; its advice changes immediately.
        </p>
        <div className="mt-4 flex flex-wrap gap-1.5">
          {SKILLS.map((s) => (
            <code key={s} className="rounded-md border border-[#23252a] bg-[#010102] px-2 py-1 font-mono text-[11px] text-[#8a8f98]">
              seo-skills/{s}
            </code>
          ))}
        </div>
      </div>

      <div className="space-y-2.5 rounded-lg border border-[#23252a]/70 bg-[#101114] p-4">
        <div className="font-mono text-[11px] text-[#62666d]">finding → /content/upsc-topper-answer-copies</div>
        <p className="text-sm leading-relaxed text-[#d0d6e0]">
          <span className="font-medium text-[#828fff]">Why it matters:</span> this page already sits at #8.8 for
          “ishita kishore answer copy”. Moving the exact phrase into an H2 is the cheapest position win available.
        </p>
        <ol className="space-y-1.5 text-xs leading-relaxed text-[#8a8f98]">
          <li className="flex gap-2"><span className="font-mono text-[#62666d]">1.</span>Rename H2 to include the full query phrase</li>
          <li className="flex gap-2"><span className="font-mono text-[#62666d]">2.</span>Add a download section targeting it</li>
        </ol>
        <div className="rounded-md border border-[#23252a]/60 bg-[#010102] px-3 py-2 text-xs leading-relaxed text-[#f7f8f8]">
          Draft: Ishita Kishore Answer Copy PDF (AIR 1, 2022) — Free Download
        </div>
      </div>
    </div>
  );
}

export function Features() {
  return (
    <section id="features" className="py-24">
      <Container>
        <div className="max-w-2xl">
          <Eyebrow>FEATURES</Eyebrow>
          <h2 className="mt-4 text-4xl font-semibold leading-[1.1] tracking-[-0.02em] text-[#f7f8f8] sm:text-[44px]">
            From raw data to shipped fixes
          </h2>
          <p className="mt-5 text-base leading-relaxed text-[#d0d6e0]">
            No dashboards you&apos;ll never open again. Impiseo ends where every other tool stops — at the fix itself.
          </p>
        </div>

        <div className="mt-12 grid gap-3 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <ImpactCard />
          </div>
          <CrawlerCard />
          <div className="lg:col-span-3">
            <CopilotCard />
          </div>
        </div>
      </Container>
    </section>
  );
}
