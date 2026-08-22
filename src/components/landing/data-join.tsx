import { Container, Eyebrow } from "./ui";
import { CrawlerMark, PostHogLogo, SearchConsoleLogo } from "./logos";

const SOURCES = [
  { name: "Search Console", meta: "impressions · clicks · position", Logo: SearchConsoleLogo },
  { name: "PostHog", meta: "views · visitors · behavior", Logo: PostHogLogo },
  { name: "ImpiseoBot", meta: "title · headings · word count", Logo: CrawlerMark },
];

const ROWS = [
  {
    path: "/upsc-topper/garima-lohia-rank-2-2022",
    stats: [
      ["impressions", "1,412"],
      ["clicks", "96"],
      ["views", "12"],
      ["words", "1,626"],
    ],
    tag: "striking distance",
    tagCls: "bg-[#5e6ad2]/15 text-[#828fff]",
  },
  {
    path: "/free-materials/vision-ias-monthly-magazine-v2",
    stats: [
      ["impressions", "893"],
      ["clicks", "31"],
      ["views", "0"],
      ["words", "2,204"],
    ],
    tag: "tracking gap",
    tagCls: "bg-[#27a644]/15 text-[#3fb950]",
  },
];

function Connector() {
  return (
    <div className="flex justify-center py-1">
      <svg width="220" height="34" viewBox="0 0 220 34" fill="none" aria-hidden>
        <path d="M20 0 V12 Q20 17 25 17 H195 Q200 17 200 12 V0" stroke="#23252a" strokeWidth="1" />
        <path d="M110 17 V26" stroke="#23252a" strokeWidth="1" />
        <circle cx="110" cy="30" r="2.5" fill="#5e6ad2" className="animate-pulse" />
      </svg>
    </div>
  );
}

export function DataJoin() {
  return (
    <section className="py-24">
      <Container>
        <div className="max-w-2xl">
          <Eyebrow>THE JOIN</Eyebrow>
          <h2 className="mt-4 text-4xl font-semibold leading-[1.1] tracking-[-0.02em] text-[#f7f8f8] sm:text-[44px]">
            Three signals.
            <br />
            One truth per URL.
          </h2>
          <p className="mt-5 text-base leading-relaxed text-[#d0d6e0]">
            Rankings without behavior is guesswork; content without rankings is trivia. Impiseo fuses Search Console,
            PostHog, and its own crawler into a single record per page — then reasons over it.
          </p>
        </div>

        <div className="mt-12 rounded-2xl border border-[#23252a] bg-[#0c0d10] p-6 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] sm:p-8">
          <div className="grid gap-3 sm:grid-cols-3">
            {SOURCES.map(({ name, meta, Logo }) => (
              <div key={name} className="rounded-lg border border-[#23252a] bg-[#14161a] px-4 py-3.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
                <div className="flex items-center gap-2.5">
                  <Logo className="h-4.5 w-4.5 shrink-0" />
                  <div className="text-sm font-medium tracking-tight text-[#f7f8f8]">{name}</div>
                </div>
                <div className="mt-1.5 font-mono text-xs text-[#8a8f98]">{meta}</div>
              </div>
            ))}
          </div>

          <Connector />

          <div className="space-y-2.5">
            {ROWS.map((r) => (
              <div
                key={r.path}
                className="flex flex-col gap-3 rounded-lg border border-[#23252a] bg-[#101114] px-4 py-3.5 lg:flex-row lg:items-center"
              >
                <code className="w-full shrink-0 truncate font-mono text-xs text-[#d0d6e0] lg:w-72">{r.path}</code>
                <div className="flex flex-1 flex-wrap gap-x-5 gap-y-1">
                  {r.stats.map(([label, value]) => (
                    <span key={label} className="font-mono text-xs text-[#8a8f98]">
                      {label}{" "}
                      <span
                        className={
                          label === "views" && value === "0" ? "font-medium text-[#f7f8f8] underline decoration-[#27a644] decoration-2 underline-offset-4" : "text-[#f7f8f8]"
                        }
                      >
                        {value}
                      </span>
                    </span>
                  ))}
                </div>
                <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-center text-xs font-medium ${r.tagCls}`}>
                  {r.tag}
                </span>
              </div>
            ))}
          </div>

          <p className="mt-5 text-center text-xs text-[#62666d]">
            Every recommendation traces back to one joined record — not a vibe, not an average.
          </p>
        </div>
      </Container>
    </section>
  );
}
