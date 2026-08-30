import type { ProviderAdapter } from "./types";

const DEFAULT_HOST = "https://us.posthog.com";

async function phFetch(host: string, path: string, apiKey: string) {
  return fetch(`${host}${path}`, {
    headers: { Authorization: `Bearer ${apiKey}` },
    cache: "no-store",
  });
}

async function hogQL(host: string, apiKey: string, projectId: number, query: string) {
  const res = await fetch(`${host}/api/projects/${projectId}/query/`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query: { kind: "HogQLQuery", query } }),
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`PostHog query failed (${res.status})`);
  }
  const data = (await res.json()) as { results?: unknown[][] };
  return data.results ?? [];
}

export type PostHogStats = {
  totals: { pageviews: number; visitors: number };
  prevTotals?: { pageviews: number; visitors: number };
  daily: { date: string; views: number; visitors: number }[];
  topPages: { path: string; views: number; visitors: number }[];
};

async function resolveProjectId(base: string, apiKey: string, projectId?: number): Promise<number> {
  if (projectId) return projectId;
  const projects = await phFetch(base, "/api/projects/", apiKey);
  if (!projects.ok) throw new Error("Could not resolve PostHog project.");
  const data = (await projects.json()) as { results?: { id: number }[] };
  const found = data.results?.[0]?.id;
  if (!found) throw new Error("No PostHog project found for this key.");
  return found;
}

export async function fetchPosthogStats(opts: {
  host?: string;
  apiKey: string;
  projectId?: number;
  days: number;
  limit?: number;
}): Promise<PostHogStats> {
  const base = opts.host?.replace(/\/+$/, "") || DEFAULT_HOST;
  const projectId = await resolveProjectId(base, opts.apiKey, opts.projectId);
  const window = `timestamp >= now() - INTERVAL ${opts.days} DAY`;
  const limit = Math.min(Math.max(opts.limit ?? 10, 1), 100);

  const [totalsRows, dailyRows, pagesRows] = await Promise.all([
    hogQL(
      base,
      opts.apiKey,
      projectId,
      `SELECT count(), count(DISTINCT distinct_id) FROM events WHERE event = '$pageview' AND ${window}`
    ),
    hogQL(
      base,
      opts.apiKey,
      projectId,
      `SELECT toDate(timestamp), count(), count(DISTINCT distinct_id) FROM events WHERE event = '$pageview' AND ${window} GROUP BY toDate(timestamp) ORDER BY toDate(timestamp) ASC`
    ),
    hogQL(
      base,
      opts.apiKey,
      projectId,
      `SELECT coalesce(properties.$pathname, '(unknown)'), count(), count(DISTINCT distinct_id) FROM events WHERE event = '$pageview' AND ${window} GROUP BY properties.$pathname ORDER BY count() DESC LIMIT ${limit}`
    ),
  ]);

  const t = totalsRows[0] ?? [];
  return {
    totals: { pageviews: Number(t[0] ?? 0), visitors: Number(t[1] ?? 0) },
    daily: dailyRows.map((r) => ({
      date: String(r[0]),
      views: Number(r[1]),
      visitors: Number(r[2]),
    })),
    topPages: pagesRows.map((r) => ({
      path: String(r[0]),
      views: Number(r[1]),
      visitors: Number(r[2]),
    })),
  };
}

/** Pageview totals for a window that starts `offsetDays` days in the past — used for previous-period deltas. */
export async function fetchPosthogTotals(opts: {
  host?: string;
  apiKey: string;
  projectId?: number;
  days: number;
  offsetDays?: number;
}): Promise<{ pageviews: number; visitors: number }> {
  const base = opts.host?.replace(/\/+$/, "") || DEFAULT_HOST;
  const projectId = await resolveProjectId(base, opts.apiKey, opts.projectId);
  const offset = Math.max(0, opts.offsetDays ?? 0);
  const window = `timestamp >= now() - INTERVAL ${offset + opts.days} DAY AND timestamp < now() - INTERVAL ${offset} DAY`;
  const rows = await hogQL(
    base,
    opts.apiKey,
    projectId,
    `SELECT count(), count(DISTINCT distinct_id) FROM events WHERE event = '$pageview' AND ${window}`
  );
  const t = rows[0] ?? [];
  return { pageviews: Number(t[0] ?? 0), visitors: Number(t[1] ?? 0) };
}

export const posthogAdapter: ProviderAdapter = {
  id: "posthog",
  label: "PostHog",
  description: "Product analytics — pageviews and conversion events for your site.",
  authType: "api_key",

  async validate({ apiKey, host }) {
    if (!apiKey?.startsWith("phx_")) {
      return { ok: false, error: "PostHog personal API keys start with 'phx_'." };
    }
    const base = (host?.trim().replace(/\/+$/, "") || DEFAULT_HOST).replace(
      /https:\/\/us\.i\.posthog\.com/,
      DEFAULT_HOST
    );

    try {
      const me = await phFetch(base, "/api/users/@me/", apiKey);
      if (me.status === 401) {
        return { ok: false, error: "Invalid or expired API key." };
      }
      if (!me.ok) {
        return { ok: false, error: `PostHog returned HTTP ${me.status}.` };
      }
      const profile = (await me.json()) as { email?: string };

      let projectId: number | undefined;
      let projectName: string | undefined;
      const projects = await phFetch(base, "/api/projects/", apiKey);
      if (projects.ok) {
        const data = (await projects.json()) as {
          results?: { id: number; name: string }[];
        };
        const first = data.results?.[0];
        if (first) {
          projectId = first.id;
          projectName = first.name;
        }
      }

      return {
        ok: true,
        meta: {
          host: base,
          accountEmail: profile.email,
          projectId,
          projectName,
        },
      };
    } catch {
      return { ok: false, error: "Could not reach PostHog. Check the region/host." };
    }
  },
};
