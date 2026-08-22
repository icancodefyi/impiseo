import Link from "next/link";
import { Container, Eyebrow } from "./ui";

const FINDINGS = [
  { title: '"garima lohia ethics answer copy" ranks #4.2 but isn\'t in your title', sev: "medium", sevCls: "bg-[#5e6ad2]/15 text-[#828fff]" },
  { title: "38 pages have titles longer than ~60 chars", sev: "low", sevCls: "bg-white/5 text-[#8a8f98]" },
  { title: "Search clicks with zero tracked views", sev: "high", sevCls: "bg-[#27a644]/15 text-[#3fb950]" },
];

function ProductMockup() {
  return (
    <div className="overflow-hidden rounded-2xl border border-[#23252a] bg-[#0c0d10] shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_24px_80px_-24px_rgba(0,0,0,0.9)]">
      <div className="flex items-center gap-1.5 border-b border-[#23252a] px-4 py-3">
        <span className="h-2.5 w-2.5 rounded-full bg-[#1b1d22]" />
        <span className="h-2.5 w-2.5 rounded-full bg-[#1b1d22]" />
        <span className="h-2.5 w-2.5 rounded-full bg-[#1b1d22]" />
        <span className="ml-3 text-xs text-[#62666d]">impiseo.app/recommendations</span>
      </div>

      <div className="grid grid-cols-[132px_1fr] sm:grid-cols-[160px_1fr]">
        <aside className="border-r border-[#23252a] p-3">
          {["Overview", "Pages", "Queries", "Recommendations", "Integrations"].map((item, i) => (
            <div
              key={item}
              className={`mb-0.5 truncate rounded-md px-2 py-1.5 text-[11px] ${
                i === 3 ? "bg-[#14161a] font-medium text-[#f7f8f8]" : "text-[#8a8f98]"
              }`}
            >
              {item}
            </div>
          ))}
        </aside>

        <div className="p-4 pt-3">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-semibold tracking-tight text-[#f7f8f8]">Recommendations</div>
              <div className="mt-0.5 text-[11px] text-[#8a8f98]">12 issues · ranked by traffic impact</div>
            </div>
            <div className="rounded-lg bg-[#5e6ad2] px-2.5 py-1.5 text-[11px] font-medium text-white">
              Generate AI fix plans
            </div>
          </div>

          <div className="mt-3 space-y-1.5">
            {FINDINGS.map((f) => (
              <div key={f.title} className="flex items-center gap-2.5 rounded-lg border border-[#23252a]/70 bg-[#101114] px-3 py-2.5">
                <span className={`shrink-0 rounded px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide ${f.sevCls}`}>
                  {f.sev}
                </span>
                <span className="truncate text-[11px] text-[#d0d6e0]">{f.title}</span>
              </div>
            ))}
          </div>

          <div className="mt-3 rounded-lg border border-[#23252a]/70 bg-[#101114] p-3">
            <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-[#828fff]">
              ✦ AI fix plan — striking distance
            </div>
            <p className="mt-1.5 text-[11px] leading-relaxed text-[#8a8f98]">
              This page already sits at #4.2 for a query with 480 monthly impressions. Adding the exact phrase to the H2 is the cheapest position win available…
            </p>
            <div className="mt-2 rounded-md bg-[#010102] px-2.5 py-2 text-[11px] leading-relaxed text-[#d0d6e0]">
              Draft title: <span className="text-[#f7f8f8]">Garima Loia Ethics (GS4) Answer Copy PDF — AIR 2, 2022</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function Hero() {
  return (
    <section className="pb-20 pt-20 sm:pt-28">
      <Container>
        <div className="mx-auto max-w-3xl text-center">
          <Eyebrow>SEARCH × BEHAVIOR × CONTENT</Eyebrow>
          <h1 className="mt-4 text-[40px] font-semibold leading-[1.05] tracking-[-0.02em] text-[#f7f8f8] sm:text-[56px] lg:text-[72px] lg:tracking-[-0.03em]">
            Fix the SEO issues that actually move traffic
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-base leading-relaxed text-[#d0d6e0] sm:text-lg">
            Impiseo joins Search Console rankings with real user behavior and your actual page content — then hands you a ranked list of fixes and an AI copilot that writes them.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link href="/dashboard" className="inline-flex h-10 items-center rounded-lg bg-[#5e6ad2] px-3.5 text-sm font-medium text-white transition-colors hover:bg-[#828fff]"
            >
              Start free
            </Link>
            <a
              href="#how-it-works"
              className="inline-flex h-10 items-center rounded-lg border border-[#23252a] bg-[#0c0d10] px-3.5 text-sm font-medium text-[#f7f8f8] transition-colors hover:border-[#2f3238] hover:bg-[#14161a]"
            >
              See how it works
            </a>
          </div>
        </div>

        <div className="mt-16">
          <ProductMockup />
        </div>
      </Container>
    </section>
  );
}
