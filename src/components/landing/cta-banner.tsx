import Link from "next/link";

import { Container } from "./ui";

export function CtaBanner() {
  return (
    <section className="py-24">
      <Container>
        <div className="rounded-xl border border-[#23252a] bg-[#0c0d10] px-6 py-14 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] sm:rounded-2xl sm:py-20">
          <h2 className="mx-auto max-w-2xl text-3xl font-semibold leading-[1.15] tracking-[-0.02em] text-[#f7f8f8] sm:text-[40px]">
            Your site already knows what to fix.
            <br className="hidden sm:block" /> Start listening.
          </h2>
          <p className="mx-auto mt-4 max-w-lg text-base leading-relaxed text-[#8a8f98]">
            Free while in beta. Connect Search Console and see your first ranked fix list before your coffee cools.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/dashboard"
              className="inline-flex h-10 items-center rounded-lg bg-[#5e6ad2] px-3.5 text-sm font-medium text-white transition-colors hover:bg-[#828fff]"
            >
              Get started free
            </Link>
            <Link
              href="/#how-it-works"
              className="inline-flex h-10 items-center rounded-lg border border-[#23252a] bg-[#010102] px-3.5 text-sm font-medium text-[#f7f8f8] transition-colors hover:border-[#2f3238]"
            >
              See how it works
            </Link>
          </div>
        </div>
      </Container>
    </section>
  );
}
