import { Container } from "./ui";

const COLUMNS: { title: string; links: string[] }[] = [
  { title: "Product", links: ["Features", "How it works", "Integrations", "Changelog"] },
  { title: "Resources", links: ["SEO skills library", "Docs", "API"] },
  { title: "Company", links: ["About", "Contact", "Privacy", "Terms"] },
];

export function Footer() {
  return (
    <footer className="border-t border-[#23252a]/60 py-16">
      <Container>
        <div className="grid gap-10 sm:grid-cols-[1fr_auto] sm:grid-cols-2 lg:grid-cols-[1.5fr_1fr_1fr_1fr]">
          <div>
            <div className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-md bg-[#5e6ad2] text-[11px] font-bold text-white">
                I
              </span>
              <span className="text-sm font-semibold tracking-tight text-[#f7f8f8]">Impiseo</span>
            </div>
            <p className="mt-3 max-w-xs text-xs leading-relaxed text-[#8a8f98]">
              Search performance analytics and content fixes, ranked by the traffic they&apos;re worth.
            </p>
          </div>

          {COLUMNS.map((col) => (
            <div key={col.title}>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-[#d0d6e0]">{col.title}</h3>
              <ul className="mt-3 space-y-2">
                {col.links.map((l) => (
                  <li key={l}>
                    <a href="#" className="text-xs text-[#8a8f98] transition-colors hover:text-[#f7f8f8]">
                      {l}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 flex flex-wrap items-center justify-between gap-3 border-t border-[#23252a]/60 pt-6">
          <p className="text-xs text-[#62666d]">© 2026 Impiseo</p>
          <p className="font-mono text-[11px] text-[#62666d]">impiseobot/0.1 · crawls politely since day one</p>
        </div>
      </Container>
    </footer>
  );
}
