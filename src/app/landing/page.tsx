import { TopNav } from "@/components/landing/nav";
import { Hero } from "@/components/landing/hero";

export const metadata = {
  title: "Impiseo — Fix the SEO issues that actually move traffic",
  description:
    "Impiseo joins Search Console rankings with real user behavior and your page content, then ranks the fixes by traffic impact — with an AI copilot that writes them.",
};

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[#010102] font-sans text-[#f7f8f8]">
      <TopNav />
      <main>
        <Hero />
      </main>
    </div>
  );
}
