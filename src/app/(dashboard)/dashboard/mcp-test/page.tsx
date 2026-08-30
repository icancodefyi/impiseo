"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ErrorBanner, PageHeader } from "@/components/widgets";

const KEY_STORE = "impiseo:mcp:key";

type ToolInfo = {
  name: string;
  title?: string;
  description?: string;
  inputSchema?: { properties?: Record<string, unknown> };
};

type Profile = {
  ok?: boolean;
  email?: string;
  activeProperty?: string;
  userId?: string;
};

type RunResult = {
  ok: boolean;
  error?: string;
  message?: string;
  durationMs?: number;
  body?: {
    result?: {
      isError?: boolean;
      structuredContent?: Record<string, unknown>;
      content?: { type: string; text?: string }[];
    };
    error?: { code?: number; message?: string };
  };
};

function baseUrlFor(site?: string | null): string {
  if (!site) return "https://example.com";
  if (site.startsWith("sc-domain:")) return `https://${site.slice("sc-domain:".length)}`;
  return site.replace(/\/$/, "");
}

function defaultParams(base: string): Record<string, Record<string, unknown>> {
  return {
    get_overview: { days: 28 },
    get_queries: { days: 28, limit: 20 },
    get_pages: { days: 28, limit: 20 },
    get_query_opportunities: { days: 28, limit: 20, excludeBranded: true },
    get_ideas: {},
    get_idea_detail: { ideaId: "" },
    list_idea_runs: {},
    get_recommendations: {},
    get_rec_enhancements: {},
    get_page_content: { limit: 20 },
    get_page_html: { page: "/" },
    get_crawl_status: {},
    get_page_queries: { page: "/" },
    get_query_pages: { query: "" },
    run_page_audit: { url: base, strategy: "mobile" },
    get_profile: {},
    list_sites: {},
  };
}

export default function McpTestPage() {
  const [key, setKey] = useState(() =>
    typeof window !== "undefined" ? (localStorage.getItem(KEY_STORE) ?? "") : ""
  );
  const [showKey, setShowKey] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [tools, setTools] = useState<ToolInfo[]>([]);
  const [tool, setTool] = useState("");
  const [paramsText, setParamsText] = useState("");
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<RunResult | null>(null);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");

  const base = useMemo(() => baseUrlFor(profile?.activeProperty), [profile]);

  useEffect(() => {
    const stored = key;
    if (!stored) return;
    const timer = setTimeout(() => {
      connect(stored);
    }, 0);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const tryParseParams = (): Record<string, unknown> | string => {
    const text = paramsText.trim();
    if (!text) return {};
    try {
      const parsed = JSON.parse(text);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) return parsed;
      return "params must be a JSON object";
    } catch (e) {
      return e instanceof Error ? `invalid params JSON: ${e.message}` : "invalid params JSON";
    }
  };

  async function connect(k?: string) {
    const useKey = (k ?? key).trim();
    if (!useKey) return;
    setConnecting(true);
    setError("");
    setResult(null);
    try {
      const profileRes = await fetch("/api/mcp/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: useKey, mode: "call", tool: "get_profile", params: {} }),
      });
      const profileJson = (await profileRes.json()) as RunResult;
      if (!profileRes.ok || !profileJson.ok) {
        throw new Error(profileJson.ok ? String(profileJson.message) : profileJson.message ?? "failed to connect");
      }
      const sc = profileJson.body?.result?.structuredContent as Profile;
      if (!sc?.ok) throw new Error((sc as { error?: string })?.error ?? "get_profile failed");

      const listRes = await fetch("/api/mcp/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: useKey, mode: "list" }),
      });
      const listJson = (await listRes.json()) as RunResult;
      if (!listRes.ok || !listJson.ok) throw new Error("failed to load tool list");

      const result = listJson.body?.result as
        | {
            tools?: { name: string; title?: string; description?: string; inputSchema?: { properties?: Record<string, unknown> } }[];
            structuredContent?: { tools?: { name: string; title?: string; description?: string; inputSchema?: { properties?: Record<string, unknown> } }[] };
          }
        | undefined;
      const loaded = result?.tools ?? result?.structuredContent?.tools ?? [];
      setProfile(sc);
      setTools(loaded);
      setKey(useKey);
      localStorage.setItem(KEY_STORE, useKey);
      if (loaded.length > 0) {
        setTool(loaded[0].name);
        setParamsText(JSON.stringify(defaultParams(baseUrlFor(sc.activeProperty))[loaded[0].name] ?? {}, null, 2));
      }
      setResult({ ok: true, durationMs: profileJson.durationMs, message: `Connected as ${sc.email}` });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setProfile(null);
      setTools([]);
    } finally {
      setConnecting(false);
    }
  };

  const createAndUse = async () => {
    setCreating(true);
    setError("");
    try {
      const res = await fetch("/api/mcp/keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "mcp-test" }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? `HTTP ${res.status}`);
      const j = (await res.json()) as { created: { full: string } };
      await connect(j.created.full);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setCreating(false);
    }
  };

  const forget = () => {
    localStorage.removeItem(KEY_STORE);
    setKey("");
    setProfile(null);
    setTools([]);
    setResult(null);
  };

  const selectTool = (name: string) => {
    setTool(name);
    setParamsText(
      JSON.stringify(defaultParams(base)[name] ?? {}, null, 2)
    );
    setResult(null);
  };

  const run = async () => {
    const parsed = tryParseParams();
    if (typeof parsed === "string") {
      setError(parsed);
      return;
    }
    setRunning(true);
    setError("");
    try {
      const res = await fetch("/api/mcp/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: key.trim(), mode: "call", tool, params: parsed }),
      });
      const j = (await res.json()) as RunResult;
      if (!res.ok) {
        setResult(j);
        if (j.ok === false) setError(j.message ?? "request failed");
        return;
      }
      setResult(j);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setRunning(false);
    }
  };

  const toolInfo = tools.find((t) => t.name === tool);
  const resultText = result?.body?.result?.content?.find((c) => c.type === "text")?.text;
  const resultKeys = Object.keys(result?.body?.result?.structuredContent ?? {});
  const rpcError = result?.body?.error;
  const isErrorResult = Boolean(result?.body?.result?.isError);

  return (
    <div className="space-y-5">
      <PageHeader
        title="MCP Test"
        subtitle="Drive the live Impiseo MCP server from the dashboard and inspect what it returns"
      />

      {error && <ErrorBanner message={error} />}

      {!profile ? (
        <section className="rounded-xl border border-dashed border-hairline bg-surface-1/40 px-6 py-10 text-center">
          <p className="text-[0.9375rem] font-medium text-ink">Connect with one of your API keys</p>
          <p className="mx-auto mt-1.5 max-w-md text-sm text-ink-subtle">
            Paste a key from the{" "}
            <Link href="/dashboard/api-keys" className="text-emerald-300 underline">
              API Keys
            </Link>{" "}
            page. Keys are validated against the MCP server on this account.
          </p>
          <div className="mx-auto mt-5 flex max-w-lg flex-wrap items-center justify-center gap-2">
            <div className="flex min-w-0 flex-1 items-center gap-2 rounded-lg border border-hairline bg-surface-1 px-3 py-2">
              <input
                type={showKey ? "text" : "password"}
                value={key}
                onChange={(e) => setKey(e.target.value)}
                placeholder="imp_xxxxxxxx_yyyyyyyy"
                className="min-w-0 flex-1 bg-transparent font-mono text-sm text-ink outline-none placeholder:text-ink-tertiary"
              />
              <button
                onClick={() => setShowKey((s) => !s)}
                className="cursor-pointer text-xs text-ink-tertiary hover:text-ink-muted"
              >
                {showKey ? "Hide" : "Show"}
              </button>
            </div>
            <button onClick={() => connect()} disabled={connecting || !key.trim()} className="btn-primary">
              {connecting ? "Connecting…" : "Connect"}
            </button>
          </div>
          <div className="mt-3">
            <button
              onClick={createAndUse}
              disabled={creating}
              className="cursor-pointer text-sm text-emerald-300 underline-offset-2 hover:underline"
            >
              {creating ? "Creating…" : "No key yet? Create one and connect"}
            </button>
          </div>
        </section>
      ) : (
        <>
          <section className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-hairline bg-surface-1 px-6 py-4">
            <div className="min-w-0">
              <p className="text-sm text-ink">
                Connected to <span className="font-semibold text-emerald-300">{profile.email}</span>
              </p>
              <p className="mt-0.5 truncate font-mono text-xs text-ink-tertiary">
                active property: {profile.activeProperty ?? "—"} · {tools.length} tools available
              </p>
            </div>
            <div className="flex items-center gap-3">
              <button onClick={() => connect()} disabled={connecting} className="btn-secondary">
                {connecting ? "Reconnecting…" : "Reconnect"}
              </button>
              <button onClick={forget} className="cursor-pointer text-sm text-ink-subtle hover:text-ink-muted">
                Forget key
              </button>
            </div>
          </section>

          <section className="space-y-4 rounded-xl border border-hairline bg-surface-1 p-6">
            <div className="flex flex-wrap items-center gap-3">
              <div className="min-w-0 flex-1">
                <label className="eyebrow block">Tool</label>
                <select
                  value={tool}
                  onChange={(e) => selectTool(e.target.value)}
                  className="input-base mt-1 w-full cursor-pointer"
                >
                  {tools.map((t) => (
                    <option key={t.name} value={t.name}>
                      {t.name}
                    </option>
                  ))}
                </select>
                {toolInfo?.description && (
                  <p className="mt-1.5 text-xs leading-relaxed text-ink-tertiary">{toolInfo.description}</p>
                )}
                {toolInfo?.inputSchema?.properties && (
                  <p className="mt-1 font-mono text-[0.6875rem] text-ink-tertiary">
                    args: {Object.keys(toolInfo.inputSchema.properties).join(", ") || "none"}
                  </p>
                )}
              </div>
            </div>

            <div>
              <label className="eyebrow block">Arguments (JSON)</label>
              <textarea
                value={paramsText}
                onChange={(e) => setParamsText(e.target.value)}
                rows={5}
                spellCheck={false}
                className="mt-1 w-full resize-y rounded-lg border border-hairline bg-canvas px-3 py-2 font-mono text-[0.8125rem] leading-relaxed text-ink outline-none focus:border-ink-tertiary"
              />
              {tool === "run_page_audit" && (
                <p className="mt-1.5 text-xs text-amber-300/80">
                  run_page_audit runs 4 Lighthouse passes — expect 20–90 seconds.
                </p>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button onClick={run} disabled={running} className="btn-primary">
                {running ? "Running…" : "Run tool"}
              </button>
              {result?.durationMs !== undefined && (
                <span className="text-xs tabular-nums text-ink-tertiary">{result.durationMs} ms</span>
              )}
            </div>

            {tool === "run_page_audit" && (
              <details className="rounded-lg border border-hairline px-4 py-3 text-sm text-ink-subtle">
                <summary className="cursor-pointer text-xs font-medium text-ink-muted">
                  Tip: audit a real page on this property
                </summary>
                <p className="mt-2 text-xs leading-relaxed">
                  url {base} is a reasonable default. Desktop nuance: pass <code className="font-mono text-emerald-300">{"{ \"url\": \"" + base + "\", \"strategy\": \"desktop\" }"}</code>.
                </p>
              </details>
            )}

            {result && (
              <div className="overflow-hidden rounded-lg border border-hairline bg-canvas">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-hairline bg-surface-1 px-4 py-2.5">
                  <span
                    className={`text-xs font-medium ${
                      isErrorResult || rpcError || result.ok === false ? "text-red-400" : "text-emerald-300"
                    }`}
                  >
                    {rpcError ? `RPC error ${rpcError.code ?? ""}` : isErrorResult ? "Tool error" : "Result"}
                  </span>
                  {resultKeys.length > 0 && (
                    <span className="flex flex-wrap items-center gap-1.5">
                      {resultKeys.map((k) => (
                        <code key={k} className="rounded bg-surface-2 px-1.5 py-0.5 font-mono text-[0.6875rem] text-ink-muted">
                          {k}
                        </code>
                      ))}
                    </span>
                  )}
                </div>
                <pre className="max-h-[480px] overflow-auto px-4 py-3 font-mono text-[0.75rem] leading-relaxed text-ink-muted">
                  {rpcError
                    ? rpcError.message
                    : resultText ?? JSON.stringify(result.body ?? result, null, 2)}
                </pre>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}