import type { Metadata } from "next";
import { OnboardingWizard } from "@/components/onboarding/wizard";

export const metadata: Metadata = {
  title: "Set up Impiseo",
};

export default function OnboardingPage() {
  return (
    <div className="min-h-screen bg-zinc-950 font-sans text-zinc-100">
      <OnboardingWizard />
    </div>
  );
}
