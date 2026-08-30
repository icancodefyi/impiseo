import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "MCP Server — Impiseo",
  description:
    "Connect Impiseo's organic search data to any AI agent over the Model Context Protocol.",
};

type ToolDoc = {
  name: string;
  desc: string;
  returns?: string;
  params: [string, string, string][] | [];
};

const TOOLS: ToolDoc[] = [
  {
    name: "get_profile",
    desc: "Account identity, plan context, connected properties and the active Search Console property.",
    returns: "{ ok, userId, email, onboarded, product, properties[], activeProperty, createdAt }",
    params: [] as [string, string, string][],
  },
  {
    name: "list_sites",
    desc: "All Search Console properties on the account with permission level, plus the active one.",
    returns: "{ ok, activeProperty, properties: [{ url, permissionLevel, addedAt }] }",
    params: [] as [string, string, string][],
  },
  {
    name: "get_overview",
    desc: "Dashboard-style totals, previous-period totals, daily series, top 25 queries and top 25 pages.",
    returns:
      "{ ok, range: { start, end, prevStart, prevEnd }, totals, prevTotals, series: [{ date, clicks, impressions }], queries[], pages[] }",
    params: [
      ["site", "string", "GSC property URL. Defaults to active property."],
      ["days", "number", "Window in days, 1–90 (default 28)."],
    ],
  },
  {
    name: "get_queries",
    desc: "Top organic queries sorted by clicks, with impressions, CTR and position.",
    returns:
      "{ ok, site, range, offset, limit, count, queries: [{ key, clicks, impressions, ctr, position }] }",
    params: [
      ["site", "string", "GSC property URL. Defaults to active property."],
      ["days", "number", "Window in days, 1–90 (default 28)."],
      ["offset", "number", "Row offset for paging, 0–25000 (default 0)."],
      ["limit", "number", "Max rows, 1–300 (default 100)."],
    ],
  },
  {
    name: "get_pages",
    desc: "Top organic pages sorted by clicks, joined with each page's crawled title, meta description and word count when available.",
    returns:
      "{ ok, site, range, offset, limit, count, pages: [{ path, clicks, impressions, ctr, position, title, metaDescription, wordCount, httpStatus }] }",
    params: [
      ["site", "string", "GSC property URL. Defaults to active property."],
      ["days", "number", "Window in days, 1–90 (default 28)."],
      ["offset", "number", "Row offset for paging, 0–25000 (default 0)."],
      ["limit", "number", "Max rows, 1–300 (default 100)."],
    ],
  },
  {
    name: "get_page_queries",
    desc: "The queries sending traffic to one page — live from Search Console.",
    returns: "{ ok, page, normalizedPath, count, queries: [{ page, query, clicks, impressions, ctr, position }] }",
    params: [
      ["site", "string", "GSC property URL. Defaults to active property."],
      ["page", "string", "Required. The page path (e.g. /blog/post-1)."],
      ["days", "number", "Window in days, 1–90 (default 28)."],
      ["limit", "number", "Max rows, 1–300 (default 50)."],
    ],
  },
  {
    name: "get_query_pages",
    desc: "Which pages rank for one query — live from Search Console.",
    returns: "{ ok, query, count, pages: [{ query, page, clicks, impressions, ctr, position }] }",
    params: [
      ["site", "string", "GSC property URL. Defaults to active property."],
      ["query", "string", "Required. The exact query to filter by."],
      ["days", "number", "Window in days, 1–90 (default 28)."],
      ["limit", "number", "Max rows, 1–100 (default 20)."],
    ],
  },
  {
    name: "get_query_opportunities",
    desc: "Runs the opportunities math across every query: the best-ranking page, the words that page misses vs the query, projected clicks at top 3 and top 1, clicks left on the table (headroom), intent, cluster, and a deterministic fixing suggestion. Live GSC + stored crawl content; paged with offset + limit.",
    returns:
      "{ ok, site, range, offset, limit, count, total, queries: [{ query, clicks, impressions, ctr, position, intent, topPagePath, pageTitle, matchScore, missingTerms[], clusterId, clusterTopic, clusterSize, projectedTop3, headroomTop3, projectedTop1, headroomTop1, fixing }] }",
    params: [
      ["site", "string", "GSC property URL. Defaults to active property."],
      ["days", "number", "Window in days, 1–90 (default 28)."],
      ["offset", "number", "Row offset for paging, 0–25000 (default 0)."],
      ["limit", "number", "Max rows, 1–500 (default 100)."],
      ["minImpressions", "number", "Only queries with at least this many impressions (default 0 = all)."],
      ["queryContains", "string", "Only queries containing this substring (case-insensitive)."],
      ["excludeBranded", "boolean", "Drop queries containing the brand token (default true)."],
    ],
  },
  {
    name: "get_ideas",
    desc: "Latest content-ideas run (gap, striking-distance, intent-mismatch, winner-expansion, new-topic) with stats and every idea's summary.",
    returns:
      "{ ok, hasRun, generatedAt, stats: { queriesAnalyzed, ideasReturned, … }, ideas: [{ id, type, topic, queriesCount, impressions90d, … }] }",
    params: [
      ["site", "string", "GSC property URL. Defaults to active property."],
    ],
  },
  {
    name: "get_idea_detail",
    desc: "Full detail for one idea: evidence, top queries, covering pages, autocomplete phrasings, AI angle and outline.",
    returns: "{ ok, found, idea: { id, type, topic, evidence, angle?, outline? } }",
    params: [
      ["site", "string", "GSC property URL. Defaults to active property."],
      ["ideaId", "string", "Required. The idea id from get_ideas."],
    ],
  },
  {
    name: "list_idea_runs",
    desc: "History of idea-generation runs with their stats (without the full idea payload).",
    returns: "{ ok, count, runs: [{ userId, siteUrl, generatedAt, stats }] }",
    params: [
      ["site", "string", "GSC property URL. Defaults to active property."],
    ],
  },
  {
    name: "get_recommendations",
    desc: "Runnable recs engine output: meta/title/thin-content/striking-distance fixes with impact scores. Grouped recs include per-page evidence — each affected path with its title, meta description and word count.",
    returns:
      "{ ok, count, recommendations: [{ id, type, severity, path, title, detail, action, impact, paths?: [{ path, impressions, title, metaDescription, wordCount }] }] }",
    params: [
      ["site", "string", "GSC property URL. Defaults to active property."],
    ],
  },
  {
    name: "get_rec_enhancements",
    desc: "Stored AI fix plans for recommendations: why, steps, draft title/meta, agent prompt.",
    returns: "{ ok, count, enhancements: [{ recId, fingerprint, why, steps[], draftTitle, draftMeta, agentPrompt }] }",
    params: [
      ["site", "string", "GSC property URL. Defaults to active property."],
      ["recId", "string", "Optional. A specific rec id to fetch, e.g. /blog/post::missing-meta."],
    ],
  },
  {
    name: "get_page_content",
    desc: "Crawled on-page data we stored: title, meta description, headings, word count, structured data, http status. Not a live fetch.",
    returns:
      "{ ok, count, pages: [{ path, httpStatus, title, metaDescription, canonical, headings[], wordCount, textSample, structuredData[], fetchedAt }] }",
    params: [
      ["site", "string", "GSC property URL. Defaults to active property."],
      ["path", "string", "Exact normalized path to look up."],
      ["prefix", "string", "Path prefix to filter, e.g. /blog."],
      ["limit", "number", "Max rows, 1–500 (default 200)."],
    ],
  },
  {
    name: "get_page_html",
    desc: "Live-fetches one of your own pages right now and parses its DOM: title, meta description, canonical, word count, every heading with its level and on-page order, plus the raw HTML (optional). Best for DOM/structure auditing.",
    returns:
      "{ ok, origin, url, finalUrl, httpStatus, contentType, fetchedAt, sizeBytes, title, metaDescription, canonical, wordCount, headings: [{ level, text, position }], html }",
    params: [
      ["site", "string", "GSC property URL. Defaults to active property."],
      ["page", "string", "Required. Page path (e.g. /blog/post-1) or full URL on the same origin."],
      ["includeHtml", "boolean", "Include the raw HTML in the response (default false)."],
    ],
  },
  {
    name: "get_crawl_status",
    desc: "How many pages have metrics, how many have been content-crawled, and the last sync time.",
    returns: "{ ok, site, pagesWithMetrics, pagesWithContent, lastSyncedAt }",
    params: [
      ["site", "string", "GSC property URL. Defaults to active property."],
    ],
  },
];

function ParamTable({ params }: { params: [string, string, string][] }) {
  if (params.length === 0) {
    return (
      <p className="text-xs italic text-ink-tertiary">No parameters — reads your active property.</p>
    );
  }
  return (
    <div className="mt-3 overflow-x-auto rounded-lg border border-hairline">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-hairline bg-surface-2/60">
            <th className="px-3 py-2 font-mono text-xs font-medium text-ink-muted">param</th>
            <th className="px-3 py-2 font-mono text-xs font-medium text-ink-muted">type</th>
            <th className="px-3 py-2 font-mono text-xs font-medium text-ink-muted">description</th>
          </tr>
        </thead>
        <tbody>
          {params.map(([name, type, desc]) => (
            <tr key={name} className="border-b border-hairline last:border-b-0">
              <td className="px-3 py-2 align-top font-mono text-[0.8125rem] text-emerald-300">{name}</td>
              <td className="px-3 py-2 align-top font-mono text-[0.8125rem] text-ink-subtle">{type}</td>
              <td className="px-3 py-2 align-top text-[0.8125rem] text-ink-subtle">{desc}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Code({ children }: { children: string }) {
  return (
    <pre className="mt-3 overflow-x-auto rounded-lg border border-hairline bg-surface-1 p-4 text-[0.8125rem] leading-relaxed text-emerald-300">
      {children}
    </pre>
  );
}

export default function McpDocsPage() {
  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-6 py-12">
      <header className="mb-12">
        <Link
          href="/"
          className="mb-6 inline-flex items-center gap-1.5 text-sm font-medium text-ink-subtle transition-colors hover:text-ink"
        >
          ← Impiseo
        </Link>
        <h1 className="page-title">Impiseo MCP Server</h1>
        <p className="page-subtitle mt-2">
          Expose all of Impiseo’s organic-search data — Search Console metrics, crawled page content,
          content ideas and AI recommendations — to any AI agent over the{" "}
          <a
            href="https://modelcontextprotocol.io"
            target="_blank"
            rel="noreferrer"
            className="text-emerald-300 underline decoration-emerald-300/40 underline-offset-2 hover:decoration-emerald-300"
          >
            Model Context Protocol
          </a>
          . Read-only and authenticated with your personal API key.
        </p>
      </header>

      <section className="mb-10">
        <h2 className="mb-3 text-lg font-semibold tracking-[-0.01em] text-ink">How it works</h2>
        <ul className="list-disc space-y-1.5 pl-5 text-[0.9375rem] leading-relaxed text-ink-subtle">
          <li>The server connects directly to your database and Google Search Console — it does not need the dashboard up.</li>
          <li>Every tool call is authorized with your <code className="font-mono text-[0.8125rem] text-emerald-300">imp_…</code> personal API key.</li>
          <li>It is strictly read-only: the AI can see and analyze everything but cannot change or delete data.</li>
          <li>It runs standalone at <code className="font-mono text-[0.8125rem] text-emerald-300">http://localhost:3777/mcp</code> by default.</li>
        </ul>
      </section>

      <section className="mb-10">
        <h2 className="mb-3 text-lg font-semibold tracking-[-0.01em] text-ink">Response format</h2>
        <p className="mb-3 text-[0.9375rem] leading-relaxed text-ink-subtle">
          Every tool returns the same stable envelope, so you never need to sniff the shape of a
          response. Success carries{" "}
          <code className="font-mono text-[0.8125rem] text-emerald-300">ok: true</code> plus the
          tool’s payload; failures carry{" "}
          <code className="font-mono text-[0.8125rem] text-emerald-300">ok: false</code> and a
          human-readable <code className="font-mono text-[0.8125rem] text-emerald-300">error</code>.
          The real object is delivered in{" "}
          <code className="font-mono text-[0.8125rem] text-emerald-300">structuredContent</code>{" "}
          (no JSON-in-JSON); <code className="font-mono text-[0.8125rem] text-emerald-300">content[0].text</code>{" "}
          holds a pretty-printed copy for debugging.
        </p>
        <Code>{`{ "ok": true, "activeProperty": "sc-domain:example.com", "count": 3, "queries": [ … ] }

{ "ok": false, "error": "Invalid params: …" }`}</Code>
      </section>

      <section className="mb-10">
        <h2 className="mb-3 text-lg font-semibold tracking-[-0.01em] text-ink">1. Get a personal API key</h2>
        <p className="text-[0.9375rem] leading-relaxed text-ink-subtle">
          Create and revoke keys from the dashboard under{" "}
          <code className="font-mono text-[0.8125rem] text-emerald-300">Dashboard → API Keys</code>, or mint one
          from the server directly. Keys resolve to your <em>own</em> data only:
        </p>
        <Code>{`# from the dashboard:  Dashboard → API Keys → Create API key
#   key:  imp_ab12cd_XYZabc123   (shown once, stored hashed)

# or from the impiseo-mcp repo:
pnpm tsx src/keygen.ts "you@example.com" "my-agent"

# hand that key to any MCP client as the Authorization: Bearer token`}</Code>
      </section>

      <section className="mb-10">
        <h2 className="mb-3 text-lg font-semibold tracking-[-0.01em] text-ink">2. Run the server</h2>
        <p className="text-[0.9375rem] leading-relaxed text-ink-subtle">
          Clone <code className="font-mono text-[0.8125rem] text-emerald-300">impiseo-mcp</code>, set three env vars, start:
        </p>
        <Code>{`# .env
MONGO_URI=mongodb+srv://…            # same cluster the app uses
GOOGLE_CLIENT_ID=…apps.googleusercontent.com   # same creds the app was authorized with
GOOGLE_CLIENT_SECRET=…

pnpm install
pnpm dev            # listens on http://localhost:3777/mcp`}</Code>
        <p className="mt-2 text-sm leading-relaxed text-ink-tertiary">
          The Google client id/secret are only used to refresh the access token for live Search Console
          queries. Everything else is read from the database.
        </p>
      </section>

      <section className="mb-10">
        <h2 className="mb-3 text-lg font-semibold tracking-[-0.01em] text-ink">3. Connect your client</h2>
        <p className="text-[0.9375rem] leading-relaxed text-ink-subtle">
          Add it as a <strong>Streamable HTTP</strong> MCP server with a bearer token header:
        </p>
        <Code>{`# Claude Desktop / claude code: ~/.claude.json → mcpServers
"impiseo": {
  "type": "http",
  "url": "http://localhost:3777/mcp",
  "headers": { "Authorization": "Bearer imp_ab12cd_XYZabc123" }
}`}</Code>
        <Code>{`# raw HTTP (Streamable HTTP protocol)
curl -N -X POST http://localhost:3777/mcp \\
  -H "Authorization: Bearer imp_ab12cd_XYZabc123" \\
  -H "Content-Type: application/json" \\
  -H "Accept: application/json, text/event-stream" \\
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-03-26","capabilities":{},"clientInfo":{"name":"curl","version":"0"}}}'`}</Code>
      </section>

      <section className="mb-10">
        <h2 className="mb-3 text-lg font-semibold tracking-[-0.01em] text-ink">4. Tools</h2>
        <p className="mb-6 text-[0.9375rem] leading-relaxed text-ink-subtle">
          All parameters are optional unless marked <span className="font-semibold text-ink">Required</span>.
          Without a <code className="font-mono text-[0.8125rem] text-emerald-300">site</code>, each tool uses your{" "}
          <em>active property</em>.
        </p>
        <div className="space-y-5">
          {TOOLS.map((tool) => (
            <div key={tool.name} className="rounded-xl border border-hairline bg-surface-1 p-5">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-mono text-[0.9375rem] font-semibold text-ink">{tool.name}</h3>
                <span className="rounded-full border border-hairline bg-canvas px-2.5 py-0.5 text-[0.6875rem] font-medium uppercase tracking-wide text-ink-tertiary">
                  read-only
                </span>
              </div>
              <p className="mt-1.5 text-sm leading-relaxed text-ink-subtle">{tool.desc}</p>
              <p className="mt-2 font-mono text-[0.8125rem] leading-relaxed text-ink-tertiary">
                <span className="uppercase tracking-wide text-ink-muted">returns </span>
                {tool.returns ?? "an { ok: true, ... } object with the tool-specific fields."}
              </p>
              <ParamTable params={tool.params} />
            </div>
          ))}
        </div>
      </section>

      <section className="mb-10">
        <h2 className="mb-3 text-lg font-semibold tracking-[-0.01em] text-ink">Notes</h2>
        <ul className="list-disc space-y-1.5 pl-5 text-[0.9375rem] leading-relaxed text-ink-subtle">
          <li>GSC numbers reflect a ~3-day publishing lag — the server queries fully-settled days.</li>
          <li>Out-of-range parameters are rejected with a clear message; limits come from the tool’s JSON schema (e.g. <code className="font-mono text-[0.8125rem] text-emerald-300">days</code> 1–90, <code className="font-mono text-[0.8125rem] text-emerald-300">limit</code> up to 300, <code className="font-mono text-[0.8125rem] text-emerald-300">offset</code> up to 25000).</li>
          <li>Page through <code className="font-mono text-[0.8125rem] text-emerald-300">get_queries</code> / <code className="font-mono text-[0.8125rem] text-emerald-300">get_pages</code> with <code className="font-mono text-[0.8125rem] text-emerald-300">offset + limit</code> to export everything.</li>
          <li><code className="font-mono text-[0.8125rem] text-emerald-300">get_query_opportunities</code> analyzes every query (not just the top 25); its headroom figures are projections from an industry CTR curve, so treat them as estimates. Exports are capped at 25,000 GSC rows.</li>
          <li>Live tools (overview, queries, pages, page_queries, query_pages, page_html) hit Google or the live site on every call; cached crawl, idea and recommendation tools read stored data instantly.</li>
          <li>Manage keys in the dashboard under <code className="font-mono text-[0.8125rem] text-emerald-300">Dashboard → API Keys</code> — revoking a key stops it working immediately.</li>
        </ul>
      </section>

      <footer className="pt-6 text-sm text-ink-tertiary">
        Questions?{" "}
        <Link href="/dashboard" className="text-emerald-300 underline underline-offset-2">
          Go to your dashboard
        </Link>
      </footer>
    </main>
  );
}