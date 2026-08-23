"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { IconCheck } from "@tabler/icons-react";

type Me = { loggedIn: boolean; profile: { onboarded: boolean } | null };
type Site = { url: string; permissionLevel: string };

const PRODUCT_TYPES = ["SaaS / tool", "Blog / content", "E-commerce", "Docs / education"];
const GOALS = ["More organic traffic", "More signups / trials", "More sales", "Better engagement"];

function normalizeUrl(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  const candidate = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const url = new URL(candidate);
    if (!url.hostname.includes(".")) return null;
    return url.origin;
  } catch {
    return null;
  }
}

function hostOf(propertyUrl: string) {
  return propertyUrl.startsWith("sc-domain:")
    ? propertyUrl.slice("sc-domain:".length)
    : propertyUrl.replace(/^https?:\/\//, "").replace(/\/$/, "");
}

const norm = (s: string) => s.replace(/^www\./, "").toLowerCase();

function prettySite(url: string) {
  return url.startsWith("sc-domain:") ? url.replace("sc-domain:", "") : url.replace(/^https?:\/\//, "").replace(/\/$/, "");
}

function StepDots({ step }: { step: number }) {
  const labels = ["Website", "Product", "Property"];
  return (
    <div className="flex items-center gap-2">
      {labels.map((label, i) => (
        <div key={label} className="flex items-center gap-2">
          {i > 0 && <span className="h-px w-6 bg-hairline" />}
          <span
            className={`flex items-center gap-1.5 text-xs ${
              step === i + 1 ? "font-medium text-ink" : step > i + 1 ? "text-ink-subtle" : "text-ink-tertiary"
            }`}
          >
            <span
              className={`flex h-5 w-5 items-center justify-center rounded-full border text-[0.625rem] ${
                step > i + 1
                  ? "border-success/40 bg-success/10 text-emerald-400"
                  : step === i + 1
                    ? "border-hairline-strong bg-surface-3 text-ink"
                    : "border-hairline text-ink-tertiary"
              }`}
            >
              {step > i + 1 ? <IconCheck size={11} stroke={2.5} /> : i + 1}
            </span>
            {label}
          </span>
        </div>
      ))}
    </div>
  );
}

function OptionCard({
  selected,
  onClick,
  children,
}: {
  selected: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`cursor-pointer rounded-lg border px-4 py-2.5 text-left text-[0.9375rem] transition-colors ${
        selected
          ? "border-primary/60 bg-primary/10 font-medium text-ink"
          : "border-hairline bg-surface-2/40 text-ink-subtle hover:border-hairline-strong hover:text-ink-muted"
      }`}
    >
      {children}
    </button>
  );
}

export function OnboardingWizard() {
  const router = useRouter();
  const [authState, setAuthState] = useState<"checking" | "signedOut" | "ready">("checking");
  const [step, setStep] = useState(1);
  const [siteInput, setSiteInput] = useState("");
  const [productType, setProductType] = useState("");
  const [audience, setAudience] = useState("");
  const [goal, setGoal] = useState("");
  const [sites, setSites] = useState<Site[] | null>(null);
  const [sitesLoading, setSitesLoading] = useState(false);
  const [sitesError, setSitesError] = useState("");
  const [propertyUrl, setPropertyUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  useEffect(() => {
    fetch("/api/me")
      .then(async (res) => res.json())
      .then((data: Me) => {
        if (!data.loggedIn) {
          setAuthState("signedOut");
        } else if (data.profile?.onboarded) {
          router.replace("/dashboard");
        } else {
          setAuthState("ready");
        }
      })
      .catch(() => setAuthState("signedOut"));
  }, [router]);

  const normalizedSite = normalizeUrl(siteInput);

  function loadSites() {
    setSitesLoading(true);
    setSitesError("");
    fetch("/api/sites")
      .then(async (res) => {
        if (!res.ok) throw new Error((await res.json()).error ?? `HTTP ${res.status}`);
        return res.json();
      })
      .then((data: { sites: Site[] }) => {
        setSites(data.sites ?? []);
        const match = (data.sites ?? []).find(
          (s) => norm(hostOf(s.url)) === norm(hostOf(normalizedSite ?? ""))
        );
        if (match) setPropertyUrl(match.url);
      })
      .catch((e: Error) => setSitesError(e.message))
      .finally(() => setSitesLoading(false));
  }

  function goToPropertyStep() {
    setStep(3);
    loadSites();
  }

  function finish() {
    setSaving(true);
    setSaveError("");
    fetch("/api/onboarding", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        siteUrl: normalizedSite,
        propertyUrl,
        product: { type: productType, audience, goal },
      }),
    })
      .then(async (res) => {
        if (!res.ok) throw new Error((await res.json()).error ?? `HTTP ${res.status}`);
        router.replace("/dashboard");
      })
      .catch((e: Error) => {
        setSaveError(e.message);
        setSaving(false);
      });
  }

  if (authState === "checking") {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <p className="animate-pulse text-sm text-ink-tertiary">Loading…</p>
      </main>
    );
  }

  if (authState === "signedOut") {
    return (
      <main className="flex min-h-screen items-center justify-center px-6">
        <div className="w-full max-w-sm rounded-xl border border-hairline bg-surface-1 p-8 text-center">
          <h1 className="text-[1.25rem] font-semibold tracking-[-0.01em] text-ink">Sign in to continue</h1>
          <p className="mt-2 text-sm text-ink-subtle">
            We need your Google account to read your Search Console properties.
          </p>
          <button
            onClick={() => signIn("google", { redirectTo: "/onboarding" })}
            className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-white px-4 py-2.5 text-sm font-medium text-zinc-900 transition hover:bg-zinc-200"
          >
            Continue with Google
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-12">
      <div className="w-full max-w-lg">
        <div className="flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-md bg-primary text-[11px] font-bold text-white">I</span>
          <span className="text-sm font-semibold tracking-tight text-ink">Impiseo</span>
        </div>
        <div className="mt-6">
          <StepDots step={step} />
        </div>

        <div className="mt-5 rounded-xl border border-hairline bg-surface-1 p-8">
          {step === 1 && (
            <>
              <h1 className="page-title !mt-0">What website are we improving?</h1>
              <p className="mt-1.5 text-sm leading-relaxed text-ink-subtle">
                This is the site you want more organic traffic for.
              </p>
              <input
                autoFocus
                value={siteInput}
                onChange={(e) => setSiteInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && normalizedSite && setStep(2)}
                placeholder="example.com"
                className="input-base mt-5 w-full px-3.5 py-2.5"
              />
              {siteInput.trim() && (
                <p className={`mt-2 text-xs ${normalizedSite ? "text-emerald-400" : "text-red-400"}`}>
                  {normalizedSite ? `Will use ${normalizedSite}` : "Enter a valid URL"}
                </p>
              )}
              <div className="mt-6 flex justify-end">
                <button
                  disabled={!normalizedSite}
                  onClick={() => setStep(2)}
                  className="btn-primary px-4 disabled:bg-surface-3 disabled:text-ink-tertiary disabled:hover:bg-primary"
                >
                  Continue
                </button>
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <h1 className="page-title !mt-0">Tell us about your product</h1>
              <p className="mt-1.5 text-sm leading-relaxed text-ink-subtle">
                The copilot uses this to tailor every recommendation.
              </p>

              <label className="eyebrow mt-6 block">
                What is it?
              </label>
              <div className="mt-2 grid grid-cols-2 gap-2">
                {PRODUCT_TYPES.map((t) => (
                  <OptionCard key={t} selected={productType === t} onClick={() => setProductType(t)}>
                    {t}
                  </OptionCard>
                ))}
              </div>

              <label className="eyebrow mt-6 block">
                Who is it for?
              </label>
              <input
                value={audience}
                onChange={(e) => setAudience(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && goal && goToPropertyStep()}
                placeholder="e.g. indie founders, UPSC aspirants…"
                className="input-base mt-2 w-full px-3.5 py-2.5"
              />

              <label className="eyebrow mt-6 block">
                Your #1 goal right now
              </label>
              <div className="mt-2 flex flex-wrap gap-2">
                {GOALS.map((g) => (
                  <OptionCard key={g} selected={goal === g} onClick={() => setGoal(g)}>
                    {g}
                  </OptionCard>
                ))}
              </div>

              <div className="mt-7 flex items-center justify-between">
                <button
                  onClick={() => setStep(1)}
                  className="cursor-pointer text-sm text-ink-tertiary transition-colors hover:text-ink-muted"
                >
                  Back
                </button>
                <button
                  disabled={!productType || !audience.trim() || !goal}
                  onClick={goToPropertyStep}
                  className="btn-primary px-4 disabled:bg-surface-3 disabled:text-ink-tertiary disabled:hover:bg-primary"
                >
                  Continue
                </button>
              </div>
            </>
          )}

          {step === 3 && (
            <>
              <h1 className="page-title !mt-0">Pick your Search Console property</h1>
              <p className="mt-1.5 text-sm leading-relaxed text-ink-subtle">
                Impiseo reads data from this one property. You&apos;ll be able to add more later.
              </p>

              {sitesLoading && <p className="mt-6 animate-pulse text-sm text-ink-tertiary">Fetching your properties…</p>}

              {sitesError && (
                <div className="mt-6 rounded-lg border border-red-500/25 bg-red-500/[0.07] px-4 py-3 text-sm text-red-300">
                  {sitesError}
                </div>
              )}

              {sites && sites.length === 0 && !sitesError && (
                <div className="mt-6 rounded-lg border border-hairline bg-surface-2/50 px-4 py-3 text-sm text-ink-subtle">
                  No verified properties found on this Google account. Verify{" "}
                  <span className="font-medium text-ink">{prettySite(normalizedSite ?? "")}</span> in{" "}
                  <a href="https://search.google.com/search-console" target="_blank" rel="noreferrer" className="underline">
                    Search Console
                  </a>{" "}
                  and come back.
                </div>
              )}

              {sites && sites.length > 0 && (
                <div className="mt-5 space-y-2">
                  {sites.map((s) => (
                    <button
                      type="button"
                      key={s.url}
                      onClick={() => setPropertyUrl(s.url)}
                      className={`flex w-full items-center justify-between rounded-lg border px-4 py-3 text-left text-sm transition-colors ${
                        propertyUrl === s.url
                          ? "border-primary/60 bg-primary/10 font-medium text-ink"
                          : "border-hairline bg-surface-2/40 text-ink-muted hover:border-hairline-strong"
                      }`}
                    >
                      <span>{prettySite(s.url)}</span>
                      <span className="text-xs text-ink-tertiary">{s.permissionLevel}</span>
                    </button>
                  ))}
                </div>
              )}

              <div className="mt-7 flex items-center justify-between">
                <button
                  onClick={() => setStep(2)}
                  disabled={saving}
                  className="cursor-pointer text-sm text-ink-tertiary transition-colors hover:text-ink-muted"
                >
                  Back
                </button>
                <button
                  disabled={!propertyUrl || saving}
                  onClick={finish}
                  className="btn-primary px-4 disabled:bg-surface-3 disabled:text-ink-tertiary disabled:hover:bg-primary"
                >
                  {saving ? "Setting up…" : "Finish setup"}
                </button>
              </div>
              {saveError && <p className="mt-3 text-right text-xs text-red-400">{saveError}</p>}
            </>
          )}
        </div>
      </div>
    </main>
  );
}
