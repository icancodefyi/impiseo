import type { Metadata } from "next";
import { OnboardingWizard } from "@/components/onboarding/wizard";

export const metadata: Metadata = {
  title: "Set up Impiseo",
};

export default function OnboardingPage() {
  return (
    <div className="min-h-screen bg-canvas font-sans text-ink">
      <OnboardingWizard />
    </div>
  );
}
