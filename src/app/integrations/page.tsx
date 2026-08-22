"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { signIn } from "next-auth/react";
import type { PublicConnection } from "@/lib/providers/types";

type ProviderCardProps = {
  label: string;
  description: string;
  connected: boolean;
  children?: React.ReactNode;
};

function StatusDot({ ok }: { ok: boolean }) {
  return (
    <span className="relative flex h-2 w-2">
      {ok && (
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
      )}
      <span
        className={`relative inline-flex h-2 w-2 rounded-full ${ok ? "bg-emerald-400" : "bg-zinc-600"}`}
      />
    </span>
  );
}

function ProviderCard({ label, description, connected, children }: ProviderCardProps) {
  return (
    <div className="flex flex-col justify-between rounded-xl border border-zinc-800 bg-zinc-900 p-5 shadow-sm">
      <div>
        <div className="flex items-start justify-between gap-3">
          <h2 className="text-[0.9375rem] font-medium tracking-tight text-zinc-100">{label}</h2>
          <span className="flex items-center gap-1.5 rounded-full border border-zinc-800 bg-zinc-950 px-2.5 py-1 text-xs text-zinc-400">
            <StatusDot ok={connected} />
            {connected ? "Connected" : "Not connected"}
          </span>
        </div>
        <p className="mt-2 text-sm leading-relaxed text-zinc-400">{description}</p>
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
        <p className="animate-pulse text-sm text-zinc-500">Loading…</p>
      </main>
    );
  }

  if (!authed) {
    return (
      <main className="flex min-h-screen items-center justify-center px-6">
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-8 text-center">
          <p className="text-sm text-zinc-400">Sign in to manage integrations.</p>
          <Link
            href="/dashboard"
            className="mt-4 inline-block rounded-lg bg-white px-4 py-2 text-sm font-medium text-zinc-900"
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
          <h1 className="text-xl font-semibold tracking-tight">Integrations</h1>
          <p className="mt-1 text-sm text-zinc-500">
            Connect data sources to power your insights.
          </p>
        </div>
        <Link
          href="/dashboard"
          className="rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-400 transition hover:text-zinc-200"
        >
          ← Dashboard
        </Link>
      </header>

      <div className="grid gap-4">
        <ProviderCard
          label="Google Search Console"
          description="Search performance data — clicks, impressions, CTR and average position for your verified properties."
          connected={gscOk}
        >
          {!gscOk && (
            <button
              onClick={() => signIn("google", { redirectTo: "/integrations" })}
              className="rounded-lg bg-white px-4 py-2 text-sm font-medium text-zinc-900 transition hover:bg-zinc-200"
            >
              Connect Google
            </button>
          )}
        </ProviderCard>

        <ProviderCard
          label="PostHog"
          description="Product analytics — join conversion behavior with search traffic to see which pages actually drive signups."
          connected={!!posthog}
        >
          {posthog ? (
            <div className="space-y-3">
              <p className="text-sm text-zinc-300">
                Project:{" "}
                <span className="font-medium">
                  {posthog.projectName ?? posthog.projectId ?? "—"}
                </span>
                {posthog.accountEmail && (
                  <span className="text-zinc-500"> · {posthog.accountEmail}</span>
                )}
              </p>
              <button
                onClick={disconnectPosthog}
                className="rounded-lg border border-red-900/50 bg-red-950/30 px-4 py-2 text-sm font-medium text-red-300 transition hover:bg-red-950/60"
              >
                Disconnect
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-xs text-zinc-500">
                PostHog → Settings → Personal API keys → Create key
              </p>
              <div className="flex flex-wrap gap-2">
                <input
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="phx_..."
                  className="min-w-0 flex-1 rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 font-mono text-sm outline-none placeholder:text-zinc-700 focus:border-zinc-600"
                />
                <select
                  value={region}
                  onChange={(e) => setRegion(e.target.value)}
                  className="rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm outline-none focus:border-zinc-600"
                >
                  <option value="https://us.posthog.com">🇺🇸 US</option>
                  <option value="https://eu.posthog.com">🇪🇺 EU</option>
                </select>
                <button
                  onClick={connectPosthog}
                  disabled={!apiKey.trim() || saving}
                  className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-emerald-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-40"
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
