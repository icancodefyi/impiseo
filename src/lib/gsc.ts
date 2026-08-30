import { google } from "googleapis";

export function iso(d: Date) {
  return d.toISOString().slice(0, 10);
}

export function addDays(d: Date, n: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

/** Settled GSC window: like the dashboard, excludes the last ~3 days of GSC lag. */
export function gscWindow(days: number) {
  const end = addDays(new Date(), -3);
  const start = addDays(end, -(Math.min(Math.max(days, 1), 90) - 1));
  return { start, end };
}

export type GscRow = {
  keys?: string[];
  clicks?: number;
  impressions?: number;
  ctr?: number;
  position?: number;
};

export type MetricRow = {
  key: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
};

export type QueryPagePair = {
  query: string;
  page: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
};

function toMetricRows(rows: GscRow[]): MetricRow[] {
  return rows.map((r) => ({
    key: r.keys?.[0] ?? "",
    clicks: r.clicks ?? 0,
    impressions: r.impressions ?? 0,
    ctr: r.ctr ?? 0,
    position: r.position ?? 0,
  }));
}

function client(accessToken: string) {
  const oauth2 = new google.auth.OAuth2();
  oauth2.setCredentials({ access_token: accessToken });
  return google.searchconsole({ version: "v1", auth: oauth2 });
}

/** Every (query,page) pair over a window, paged to the max depth — the input to opportunities math. */
export async function fetchAllQueryPagePairs(opts: {
  accessToken: string;
  site: string;
  days: number;
  maxRows?: number;
}): Promise<QueryPagePair[]> {
  const maxRows = Math.min(Math.max(opts.maxRows ?? 25000, 1), 25000);
  const w = gscWindow(opts.days);
  const sc = client(opts.accessToken);

  const out: QueryPagePair[] = [];
  const chunk = 5000;
  for (let startRow = 0; startRow < maxRows; startRow += chunk) {
    const { data } = await sc.searchanalytics.query({
      siteUrl: opts.site,
      requestBody: {
        startDate: iso(w.start),
        endDate: iso(w.end),
        dimensions: ["query", "page"],
        rowLimit: chunk,
        startRow,
      },
    });
    const rows = (data.rows ?? []) as GscRow[];
    for (const r of rows) {
      const pair: QueryPagePair = {
        query: r.keys?.[0] ?? "",
        page: r.keys?.[1] ?? "",
        clicks: r.clicks ?? 0,
        impressions: r.impressions ?? 0,
        ctr: r.ctr ?? 0,
        position: r.position ?? 0,
      };
      out.push(pair);
      if (out.length >= maxRows) return out;
    }
    if (rows.length < chunk) break;
  }
  return out;
}

/** Top pages by impressions over a window (for technical + cross-tool joins). */
export async function fetchTopPages(opts: {
  accessToken: string;
  site: string;
  days: number;
  limit: number;
}): Promise<MetricRow[]> {
  const limit = Math.min(Math.max(opts.limit, 1), 300);
  const w = gscWindow(opts.days);
  const sc = client(opts.accessToken);
  const { data } = await sc.searchanalytics.query({
    siteUrl: opts.site,
    requestBody: {
      startDate: iso(w.start),
      endDate: iso(w.end),
      dimensions: ["page"],
      rowLimit: limit,
    },
  });
  return toMetricRows((data.rows ?? []) as GscRow[]);
}

/** Queries ranking for one page (for keyword-informed drafting). */
export async function fetchPageQueries(opts: {
  accessToken: string;
  site: string;
  days: number;
  url: string;
  limit?: number;
}): Promise<MetricRow[]> {
  const limit = Math.min(Math.max(opts.limit ?? 8, 1), 50);
  const w = gscWindow(opts.days);
  const sc = client(opts.accessToken);
  const { data } = await sc.searchanalytics.query({
    siteUrl: opts.site,
    requestBody: {
      startDate: iso(w.start),
      endDate: iso(w.end),
      dimensions: ["query"],
      dimensionFilterGroups: [
        {
          filters: [{ dimension: "page", operator: "EQUALS", expression: opts.url }],
        },
      ],
      rowLimit: limit,
    },
  });
  return toMetricRows((data.rows ?? []) as GscRow[]);
}