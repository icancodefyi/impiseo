"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { signIn } from "next-auth/react";
import type { PublicConnection } from "@/lib/providers/types";
import { PostHogLogo, SearchConsoleLogo } from "@/components/landing/logos";

type ProviderCardProps = {
  label: string;
  description: string;
  connected: boolean;
  logo?: React.ReactNode;
  children?: React.ReactNode;
};

function StatusDot({ ok }: { ok: boolean }) {
  return (
    <span className="relative flex h-2 w-2">
      {ok && (
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
      )}
      <span
        className={`relative inline-flex h-2 w-2 rounded-full ${ok ? "bg-emerald-400" : "bg-surface-4"}`}
      />
    </span>
  );
}

function ProviderCard({ label, description, connected, logo, children }: ProviderCardProps) {
  return (
    <div className="flex flex-col justify-between rounded-xl border border-hairline bg-surface-1 p-5">
      <div>
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            {logo}
            <h2 className="text-[0.9375rem] font-medium tracking-tight text-ink">{label}</h2>
          </div>
          <span className="flex items-center gap-1.5 rounded-full border border-hairline bg-canvas px-2.5 py-1 text-xs text-ink-subtle">
            <StatusDot ok={connected} />
            {connected ? "Connected" : "Not connected"}
          </span>
        </div>
        <p className="mt-2 text-sm leading-relaxed text-ink-subtle">{description}</p>
      </div>
      <div className="mt-5">{children}</div>
    </div>
  );
}

export default function IntegrationsPage() {
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [gscOk, setGscOk] = useState(false);
  const [posthog, setPosthog] = useState<PublicConnection | null>(null);

  const [apiKey, setApiKey] = useState("");
  const [region, setRegion] = useState("https://us.posthog.com");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/connections")
      .then((res) => {
        if (res.status === 401) {
          setAuthed(false);
          return null;
        }
        return res.json();
      })
      .then((data) => {
        if (!data) return;
        setAuthed(true);
        const ph = data.connections?.find(
          (c: PublicConnection) => c.provider === "posthog"
        );
        if (ph) {
          setPosthog(ph);
          setRegion(ph.host ?? region);
        }
      })
      .catch(() => setAuthed(false));
    fetch("/api/sites")
      .then((res) => setGscOk(res.ok))
      .catch(() => setGscOk(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const connectPosthog = useCallback(async () => {
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/connections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: "posthog",
          apiKey: apiKey.trim(),
          host: region,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      setPosthog(data.connection);
      setApiKey("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }, [apiKey, region]);

  const disconnectPosthog = useCallback(async () => {
    await fetch("/api/connections?provider=posthog", { method: "DELETE" });
    setPosthog(null);
  }, []);

  if (authed === null) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <p className="animate-pulse text-sm text-ink-tertiary">Loading…</p>
      </main>
    );
  }

  if (!authed) {
    return (
      <main className="flex min-h-screen items-center justify-center px-6">
        <div className="rounded-xl border border-hairline bg-surface-1 p-8 text-center">
          <p className="text-sm text-ink-subtle">Sign in to manage integrations.</p>
          <Link
            href="/dashboard"
            className="mt-4 inline-block rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-hover"
          >
            Go to dashboard
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <header className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-ink">Integrations</h1>
          <p className="mt-1 text-sm text-ink-tertiary">
            Connect data sources to power your insights.
          </p>
        </div>
        <Link
          href="/dashboard"
          className="rounded-lg border border-hairline bg-surface-1 px-3 py-2 text-sm text-ink-subtle transition-colors hover:text-ink-muted"
        >
          ← Dashboard
        </Link>
      </header>

      <div className="grid gap-4">
        <ProviderCard
          label="Google Search Console"
          description="Search performance data — clicks, impressions, CTR and average position for your verified properties."
          connected={gscOk}
          logo={<SearchConsoleLogo className="h-6 w-6" />}
        >
          {!gscOk && (
            <button
              onClick={() => signIn("google", { redirectTo: "/integrations" })}
              className="rounded-lg bg-white px-4 py-2 text-sm font-medium text-zinc-900 transition-colors hover:bg-zinc-200"
            >
              Connect Google
            </button>
          )}
        </ProviderCard>

        <ProviderCard
          label="PostHog"
          description="Product analytics — join conversion behavior with search traffic to see which pages actually drive signups."
          connected={!!posthog}
          logo={<PostHogLogo className="h-6 w-6" />}
        >
          {posthog ? (
            <div className="space-y-3">
              <p className="text-sm text-ink-muted">
                Project:{" "}
                <span className="font-medium text-ink">
                  {posthog.projectName ?? posthog.projectId ?? "—"}
                </span>
                {posthog.accountEmail && (
                  <span className="text-ink-tertiary"> · {posthog.accountEmail}</span>
                )}
              </p>
              <button
                onClick={disconnectPosthog}
                className="rounded-lg border border-red-500/25 bg-red-500/[0.07] px-4 py-2 text-sm font-medium text-red-300 transition-colors hover:bg-red-500/[0.12]"
              >
                Disconnect
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-xs text-ink-tertiary">
                PostHog → Settings → Personal API keys → Create key
              </p>
              <div className="flex flex-wrap gap-2">
                <input
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="phx_..."
                  className="min-w-0 flex-1 rounded-lg border border-hairline bg-canvas px-3 py-2 font-mono text-sm text-ink outline-none placeholder:text-ink-tertiary transition-colors focus:border-primary-focus"
                />
                <select
                  value={region}
                  onChange={(e) => setRegion(e.target.value)}
                  className="rounded-lg border border-hairline bg-canvas px-3 py-2 text-sm text-ink outline-none transition-colors focus:border-primary-focus"
                >
                  <option value="https://us.posthog.com">🇺🇸 US</option>
                  <option value="https://eu.posthog.com">🇪🇺 EU</option>
                </select>
                <button
                  onClick={connectPosthog}
                  disabled={!apiKey.trim() || saving}
                  className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {saving ? "Verifying…" : "Connect"}
                </button>
              </div>
              {error && <p className="text-sm text-red-400">{error}</p>}
            </div>
          )}
        </ProviderCard>
      </div>
    </main>
  );
}
