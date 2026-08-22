import Link from "next/link";
import { Container } from "./ui";

const LINKS = [
  { label: "Features", href: "#features" },
  { label: "How it works", href: "#how-it-works" },
  { label: "Copilot", href: "#copilot" },
];

export function TopNav() {
  return (
    <header className="sticky top-0 z-50 border-b border-[#23252a]/60 bg-[#010102]/80 backdrop-blur-md">
      <Container>
        <div className="flex h-14 items-center justify-between">
          <a href="/landing" className="flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-md bg-[#5e6ad2] text-[11px] font-bold text-white">
              I
            </span>
            <span className="text-sm font-semibold tracking-tight text-[#f7f8f8]">Impiseo</span>
          </a>

          <nav className="hidden items-center gap-1 md:flex">
            {LINKS.map((l) => (
              <a
                key={l.label}
                href={l.href}
                className="rounded-lg px-3 py-2 text-sm text-[#8a8f98] transition-colors hover:text-[#f7f8f8]"
              >
                {l.label}
              </a>
            ))}
          </nav>

          <div className="flex items-center gap-2.5">
            <Link
              href="/"
              className="hidden h-10 items-center rounded-lg border border-[#23252a] bg-[#0c0d10] px-3.5 text-sm font-medium text-[#f7f8f8] transition-colors hover:border-[#2f3238] hover:bg-[#14161a] sm:inline-flex"
            >
              Open app
            </Link>
            <Link
              href="/"
              className="inline-flex h-10 items-center rounded-lg bg-[#5e6ad2] px-3.5 text-sm font-medium text-white transition-colors hover:bg-[#828fff]"
            >
              Get started
            </Link>
          </div>
        </div>
      </Container>
    </header>
  );
}
