import { Container, Eyebrow } from "./ui";

const STEPS = [
  {
    n: "01",
    title: "Connect your sources",
    body: "Sign in with Google, paste a PostHog key. No code, no GTM surgery — read-only scopes, revoked anytime from Integrations.",
    mock: (
      <div className="space-y-1.5">
        {[
          ["Google Search Console", "connected", "bg-[#27a644]/15 text-[#3fb950]"],
          ["PostHog", "connected", "bg-[#27a644]/15 text-[#3fb950]"],
          ["Groq copilot", "optional", "bg-white/5 text-[#8a8f98]"],
        ].map(([name, status, cls]) => (
          <div key={name} className="flex items-center justify-between rounded-lg border border-[#23252a]/70 bg-[#101114] px-3 py-2">
            <span className="text-xs text-[#d0d6e0]">{name}</span>
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${cls}`}>{status}</span>
          </div>
        ))}
      </div>
    ),
  },
  {
    n: "02",
    title: "Sync, crawl, join",
    body: "One click pulls your top pages from Search Console, crawls their live content politely, and fuses everything into one record per URL.",
    mock: (
      <div className="space-y-1.5 font-mono text-[11px] text-[#8a8f98]">
        <div className="flex justify-between rounded-lg border border-[#23252a]/70 bg-[#101114] px-3 py-2"><span>sync gsc</span><span className="text-[#3fb950]">300 urls</span></div>
        <div className="flex justify-between rounded-lg border border-[#23252a]/70 bg-[#101114] px-3 py-2"><span>crawl batch</span><span>5 / 2s pacing</span></div>
        <div className="flex justify-between rounded-lg border border-[#23252a]/70 bg-[#101114] px-3 py-2"><span>join per url</span><span className="text-[#828fff]">ready</span></div>
      </div>
    ),
  },
  {
    n: "03",
    title: "Ship the fixes",
    body: "Findings arrive ranked by traffic at stake. Open one, get an expert-grounded fix plan with ready-to-paste drafts. Fix, re-crawl, watch the dot move up.",
    mock: (
      <div className="space-y-1.5">
        <div className="flex items-center gap-2 rounded-lg border border-[#23252a]/70 bg-[#101114] px-3 py-2">
          <span className="rounded bg-[#5e6ad2]/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-[#828fff]">medium</span>
          <span className="truncate text-xs text-[#d0d6e0]">“ishita kishore answer copy” ranks #8.8</span>
        </div>
        <div className="rounded-lg border border-[#23252a]/70 bg-[#101114] px-3 py-2 text-xs leading-relaxed text-[#f7f8f8]">
          Draft: Ishita Kishore Answer Copy PDF (AIR 1, 2022) — Free Download
        </div>
        <div className="px-1 pt-1 font-mono text-[11px] text-[#62666d]">#8.8 → #4.x · est. +340 clicks/mo</div>
      </div>
    ),
  },
];

export function HowItWorks() {
  return (
    <section id="how-it-works" className="py-24">
      <Container>
        <div className="max-w-2xl">
          <Eyebrow>HOW IT WORKS</Eyebrow>
          <h2 className="mt-4 text-4xl font-semibold leading-[1.1] tracking-[-0.02em] text-[#f7f8f8] sm:text-[44px]">
            Live in ten minutes.
            <br />
            Useful for years.
          </h2>
        </div>

        <div className="mt-12 divide-y divide-[#23252a] border-y border-[#23252a]">
          {STEPS.map((s) => (
            <div key={s.n} className="grid items-center gap-8 py-10 lg:grid-cols-2 lg:gap-16">
              <div className="flex gap-6">
                <span className="font-mono text-sm text-[#62666d]">{s.n}</span>
                <div>
                  <h3 className="text-[22px] font-medium leading-[1.25] tracking-[-0.01em] text-[#f7f8f8]">{s.title}</h3>
                  <p className="mt-2 max-w-md text-sm leading-relaxed text-[#8a8f98]">{s.body}</p>
                </div>
              </div>
              <div className="rounded-xl border border-[#23252a] bg-[#0c0d10] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] lg:max-w-md lg:justify-self-end w-full">
                {s.mock}
              </div>
            </div>
          ))}
        </div>
      </Container>
    </section>
  );
}
