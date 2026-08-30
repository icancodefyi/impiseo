"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ErrorBanner, PageHeader } from "@/components/widgets";

type ApiKeyRow = {
  keyId: string;
  prefix: string;
  name: string;
  createdAt: string;
  lastUsedAt: string | null;
};

function fmtDate(iso: string | null) {
  if (!iso) return "never";
  return new Date(iso).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export default function ApiKeysPage() {
  const [keys, setKeys] = useState<ApiKeyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);
  const [justCreated, setJustCreated] = useState<string | null>(null);
  const [revoking, setRevoking] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const load = useCallback(() => {
    fetch("/api/mcp/keys")
      .then(async (res) => {
        if (!res.ok) throw new Error((await res.json()).error ?? `HTTP ${res.status}`);
        return res.json();
      })
      .then((j: { keys: ApiKeyRow[] }) => {
        setKeys(j.keys);
        setError("");
      })
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const create = async () => {
    setCreating(true);
    setError("");
    try {
      const res = await fetch("/api/mcp/keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name || "default" }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? `HTTP ${res.status}`);
      const j = (await res.json()) as { created: { full: string } };
      setJustCreated(j.created.full);
      setName("");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setCreating(false);
    }
  };

  const revoke = async (prefix: string) => {
    if (!window.confirm("Revoke this API key? Any AI client using it will immediately lose access.")) return;
    setRevoking(prefix);
    setError("");
    try {
      const res = await fetch(`/api/mcp/keys?prefix=${encodeURIComponent(prefix)}`, { method: "DELETE" });
      if (!res.ok) throw new Error((await res.json()).error ?? `HTTP ${res.status}`);
      setKeys((prev) => prev.filter((k) => k.prefix !== prefix));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setRevoking(null);
    }
  };

  const copyKey = async (full: string) => {
    try {
      await navigator.clipboard.writeText(full);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      window.prompt("Copy your API key:", full);
    }
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="API Keys"
        subtitle="Personal keys that let AI agents read your SEO data through the Impiseo MCP server"
      />

      {error && <ErrorBanner message={error} />}

      <section className="rounded-xl border border-hairline bg-surface-1 p-6">
        <h2 className="section-title">Create a key</h2>
        <p className="mt-1 text-sm text-ink-subtle">
          Give it a name so you remember which client uses it (e.g. “Claude”, “VS Code agent”).
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="default"
            maxLength={60}
            className="input-base w-56"
          />
          <button onClick={create} disabled={creating} className="btn-primary">
            {creating ? "Creating…" : "Create API key"}
          </button>
        </div>

        {justCreated && (
          <div className="mt-5 rounded-lg border border-emerald-500/30 bg-emerald-500/[0.07] p-4">
            <p className="text-sm font-medium text-emerald-300">Key created — copy it now.</p>
            <p className="mt-0.5 text-xs text-ink-subtle">
              It is stored hashed and can only be shown this once. Use it as the Bearer token on the MCP endpoint.
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <code className="min-w-0 flex-1 truncate rounded-md bg-surface-2 px-3 py-2 font-mono text-[0.8125rem] text-ink">
                {justCreated}
              </code>
              <button onClick={() => copyKey(justCreated)} className="btn-secondary">
                {copied ? "Copied!" : "Copy"}
              </button>
            </div>
          </div>
        )}
      </section>

      <section className="overflow-hidden rounded-xl border border-hairline bg-surface-1">
        <h2 className="section-title border-b border-hairline px-6 py-4">Your keys</h2>
        {loading ? (
          <p className="px-6 py-10 text-center text-sm text-ink-subtle">Loading…</p>
        ) : keys.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <p className="text-sm text-ink-subtle">No API keys yet.</p>
            <p className="mt-1 text-xs text-ink-tertiary">
              Create one above, then try it in the{" "}
              <Link href="/dashboard/mcp-test" className="text-emerald-300 underline">
                MCP test page
              </Link>
              .
            </p>
          </div>
        ) : (
          <div className="max-h-[440px] overflow-auto">
            <table className="w-full min-w-[560px] text-sm">
              <thead className="sticky top-0 z-[1] bg-surface-1 text-left">
                <tr>
                  <th className="eyebrow px-6 pb-3 pt-3.5 font-medium">Name</th>
                  <th className="eyebrow px-4 pb-3 pt-3.5 font-medium">Key</th>
                  <th className="eyebrow px-4 pb-3 pt-3.5 font-medium">Created</th>
                  <th className="eyebrow px-4 pb-3 pt-3.5 font-medium">Last used</th>
                  <th className="eyebrow px-6 pb-3 pt-3.5 text-right font-medium">Action</th>
                </tr>
              </thead>
              <tbody>
                {keys.map((k) => (
                  <tr key={k.keyId} className="border-t border-hairline-tertiary">
                    <td className="px-6 py-3 font-medium text-ink">{k.name}</td>
                    <td className="px-4 py-3 font-mono text-[0.8125rem] text-ink-muted">
                      imp_{k.prefix}_••••••••••••••
                    </td>
                    <td className="px-4 py-3 tabular-nums text-ink-subtle">{fmtDate(k.createdAt)}</td>
                    <td className="px-4 py-3 tabular-nums text-ink-subtle">{fmtDate(k.lastUsedAt)}</td>
                    <td className="px-6 py-3 text-right">
                      <button
                        onClick={() => revoke(k.prefix)}
                        disabled={revoking === k.prefix}
                        className="cursor-pointer text-sm text-red-400 transition-colors hover:text-red-300"
                      >
                        {revoking === k.prefix ? "Revoking…" : "Revoke"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}