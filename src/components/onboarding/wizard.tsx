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
          {i > 0 && <span className="h-px w-6 bg-zinc-800" />}
          <span
            className={`flex items-center gap-1.5 text-xs ${
              step === i + 1 ? "font-medium text-zinc-100" : step > i + 1 ? "text-zinc-500" : "text-zinc-600"
            }`}
          >
            <span
              className={`flex h-5 w-5 items-center justify-center rounded-full border text-[0.625rem] ${
                step > i + 1
                  ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-400"
                  : step === i + 1
                    ? "border-zinc-600 bg-zinc-800 text-zinc-100"
                    : "border-zinc-800 text-zinc-600"
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
      className={`rounded-lg border px-3 py-2 text-left text-sm transition ${
        selected
          ? "border-emerald-500/50 bg-emerald-500/10 font-medium text-emerald-300"
          : "border-zinc-800 bg-zinc-900 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200"
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
        <p className="animate-pulse text-sm text-zinc-500">Loading…</p>
      </main>
    );
  }

  if (authState === "signedOut") {
    return (
      <main className="flex min-h-screen items-center justify-center px-6">
        <div className="w-full max-w-sm rounded-2xl border border-zinc-800 bg-zinc-900 p-8 text-center shadow-xl shadow-black/20">
          <h1 className="text-xl font-semibold tracking-tight">Sign in to continue</h1>
          <p className="mt-2 text-sm text-zinc-400">
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
        <p className="text-sm font-semibold tracking-tight">Impiseo</p>
        <div className="mt-6">
          <StepDots step={step} />
        </div>

        <div className="mt-4 rounded-2xl border border-zinc-800 bg-zinc-950 p-7">
          {step === 1 && (
            <>
              <h1 className="text-lg font-semibold tracking-tight">What website are we improving?</h1>
              <p className="mt-1.5 text-sm leading-relaxed text-zinc-400">
                This is the site you want more organic traffic for.
              </p>
              <input
                autoFocus
                value={siteInput}
                onChange={(e) => setSiteInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && normalizedSite && setStep(2)}
                placeholder="example.com"
                className="mt-5 w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3.5 py-2.5 text-sm outline-none placeholder:text-zinc-600 focus:border-zinc-600"
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
                  className="rounded-lg bg-white px-4 py-2 text-sm font-medium text-zinc-900 transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:bg-zinc-800 disabled:text-zinc-600"
                >
                  Continue
                </button>
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <h1 className="text-lg font-semibold tracking-tight">Tell us about your product</h1>
              <p className="mt-1.5 text-sm leading-relaxed text-zinc-400">
                The copilot uses this to tailor every recommendation.
              </p>

              <label className="mt-5 block text-xs font-medium uppercase tracking-wide text-zinc-500">
                What is it?
              </label>
              <div className="mt-2 grid grid-cols-2 gap-2">
                {PRODUCT_TYPES.map((t) => (
                  <OptionCard key={t} selected={productType === t} onClick={() => setProductType(t)}>
                    {t}
                  </OptionCard>
                ))}
              </div>

              <label className="mt-5 block text-xs font-medium uppercase tracking-wide text-zinc-500">
                Who is it for?
              </label>
              <input
                value={audience}
                onChange={(e) => setAudience(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && goal && goToPropertyStep()}
                placeholder="e.g. indie founders, UPSC aspirants…"
                className="mt-2 w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3.5 py-2.5 text-sm outline-none placeholder:text-zinc-600 focus:border-zinc-600"
              />

              <label className="mt-5 block text-xs font-medium uppercase tracking-wide text-zinc-500">
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
                  className="text-sm text-zinc-500 transition hover:text-zinc-300"
                >
                  Back
                </button>
                <button
                  disabled={!productType || !audience.trim() || !goal}
                  onClick={goToPropertyStep}
                  className="rounded-lg bg-white px-4 py-2 text-sm font-medium text-zinc-900 transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:bg-zinc-800 disabled:text-zinc-600"
                >
                  Continue
                </button>
              </div>
            </>
          )}

          {step === 3 && (
            <>
              <h1 className="text-lg font-semibold tracking-tight">Pick your Search Console property</h1>
              <p className="mt-1.5 text-sm leading-relaxed text-zinc-400">
                Impiseo reads data from this one property. You&apos;ll be able to add more later.
              </p>

              {sitesLoading && <p className="mt-6 animate-pulse text-sm text-zinc-500">Fetching your properties…</p>}

              {sitesError && (
                <div className="mt-6 rounded-lg border border-red-900/50 bg-red-950/40 px-4 py-3 text-sm text-red-300">
                  {sitesError}
                </div>
              )}

              {sites && sites.length === 0 && !sitesError && (
                <div className="mt-6 rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-3 text-sm text-zinc-400">
                  No verified properties found on this Google account. Verify{" "}
                  <span className="font-medium text-zinc-200">{prettySite(normalizedSite ?? "")}</span> in{" "}
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
                      className={`flex w-full items-center justify-between rounded-lg border px-4 py-3 text-left text-sm transition ${
                        propertyUrl === s.url
                          ? "border-emerald-500/50 bg-emerald-500/10 font-medium text-emerald-300"
                          : "border-zinc-800 bg-zinc-900 text-zinc-300 hover:border-zinc-700"
                      }`}
                    >
                      <span>{prettySite(s.url)}</span>
                      <span className="text-xs text-zinc-500">{s.permissionLevel}</span>
                    </button>
                  ))}
                </div>
              )}

              <div className="mt-7 flex items-center justify-between">
                <button
                  onClick={() => setStep(2)}
                  disabled={saving}
                  className="text-sm text-zinc-500 transition hover:text-zinc-300"
                >
                  Back
                </button>
                <button
                  disabled={!propertyUrl || saving}
                  onClick={finish}
                  className="rounded-lg bg-white px-4 py-2 text-sm font-medium text-zinc-900 transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:bg-zinc-800 disabled:text-zinc-600"
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
