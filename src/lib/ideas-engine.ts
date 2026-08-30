import { createHash } from "node:crypto";
import { google } from "googleapis";
import { getCollections } from "@/lib/db";
import type { IdeaDoc, IdeaRunDoc } from "@/lib/db";
import { validateTopic } from "@/lib/autocomplete";
import { aiEnabled, chatJSON } from "@/lib/ai/client";
import { selectSkills } from "@/lib/ai/skills";
import { discoverNewTopics } from "@/lib/discovery-engine";
import { normalizePath } from "@/lib/url";

export const IDEA_WINDOW_DAYS = 90;

const MAX_QUERIES = 5000;
const MIN_CLUSTER_IMPR = 30;
const GAP_MIN_IMPR = 100;
const SD_MIN_IMPR = 100;
const MM_MIN_IMPR = 300;
const WE_MIN_CLICKS = 10;
const AUTOCOMPLETE_TOP_N = 12;
const MAX_IDEAS = 24;

type QueryRow = {
  query: string;
  clicks: number;
  impressions: number;
  position: number;
};

type GscRow = {
  keys?: string[];
  clicks?: number;
  impressions?: number;
  ctr?: number;
  position?: number;
};

type InventoryPage = {
  path: string;
  tokens: Set<string>;
};

type Cluster = {
  members: QueryRow[];
  tokens: Map<string, number>;
  impressions: number;
  clicks: number;
};

function iso(d: Date) {
  return d.toISOString().slice(0, 10);
}

// Organic CTR averages by position — conservative industry curve, interpolated.
const CTR_CURVE: [number, number][] = [
  [1, 0.28],
  [2, 0.15],
  [3, 0.1],
  [4, 0.07],
  [5, 0.05],
  [6, 0.04],
  [7, 0.032],
  [8, 0.026],
  [9, 0.021],
  [10, 0.017],
  [12, 0.012],
  [15, 0.008],
  [20, 0.005],
];

export function expectedCtr(pos: number): number {
  if (!Number.isFinite(pos) || pos <= CTR_CURVE[0][0]) return CTR_CURVE[0][1];
  const last = CTR_CURVE[CTR_CURVE.length - 1];
  if (pos >= last[0]) return last[1];
  for (let i = 0; i < CTR_CURVE.length - 1; i++) {
    const [p1, c1] = CTR_CURVE[i];
    const [p2, c2] = CTR_CURVE[i + 1];
    if (pos >= p1 && pos <= p2) return c1 + ((c2 - c1) * (pos - p1)) / (p2 - p1);
  }
  return last[1];
}

const STOPWORDS = new Set([
  "a", "an", "the", "and", "or", "but", "of", "in", "on", "for", "to", "with", "at", "by",
  "from", "is", "are", "was", "were", "be", "been", "it", "its", "this", "that", "these",
  "those", "how", "what", "when", "where", "which", "who", "why", "can", "do", "does",
  "did", "vs", "versus", "best", "top", "my", "your", "i", "you", "we", "our", "me",
]);

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length >= 2 && !STOPWORDS.has(t));
}

export { tokenize };

export function brandTokenFor(site: string): string | null {
  let host = site.replace(/^sc-domain:/, "").replace(/^https?:\/\//, "").replace(/\/.*$/, "");
  host = host.replace(/^www\./, "").toLowerCase();
  const core = host.split(".")[0] ?? "";
  const token = core.replace(/[^a-z0-9]/g, "");
  return token.length >= 4 ? token : null;
}

async function pullQueryData(
  site: string,
  accessToken: string
): Promise<{ totals: QueryRow[]; landingsByQuery: Map<string, Set<string>>; partialData: boolean }> {
  const oauth2 = new google.auth.OAuth2();
  oauth2.setCredentials({ access_token: accessToken });
  const searchconsole = google.searchconsole({ version: "v1", auth: oauth2 });

  const end = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
  const start = new Date(end.getTime() - (IDEA_WINDOW_DAYS - 1) * 24 * 60 * 60 * 1000);

  const [totalsRes, pageQueryRes] = await Promise.allSettled([
    searchconsole.searchanalytics.query({
      siteUrl: site,
      requestBody: {
        startDate: iso(start),
        endDate: iso(end),
        dimensions: ["query"],
        rowLimit: 25000,
      },
    }),
    searchconsole.searchanalytics.query({
      siteUrl: site,
      requestBody: {
        startDate: iso(start),
        endDate: iso(end),
        dimensions: ["page", "query"],
        rowLimit: 25000,
      },
    }),
  ]);

  if (totalsRes.status !== "fulfilled") throw totalsRes.reason;

  const totalsMap = new Map<string, QueryRow>();
  for (const r of ((totalsRes.value.data.rows ?? []) as GscRow[]) ?? []) {
    const q = r.keys?.[0] ?? "";
    if (!q) continue;
    const prev = totalsMap.get(q);
    if (prev) {
      prev.clicks += r.clicks ?? 0;
      prev.impressions += r.impressions ?? 0;
      continue;
    }
    totalsMap.set(q, {
      query: q,
      clicks: r.clicks ?? 0,
      impressions: r.impressions ?? 0,
      position: r.position ?? 0,
    });
  }

  const landingsByQuery = new Map<string, Set<string>>();
  let partialData = false;
  if (pageQueryRes.status === "fulfilled") {
    for (const r of ((pageQueryRes.value.data.rows ?? []) as GscRow[]) ?? []) {
      const path = normalizePath(r.keys?.[0] ?? "");
      const q = (r.keys?.[1] ?? "").toLowerCase();
      if (!path || !q) continue;
      const set = landingsByQuery.get(q) ?? new Set<string>();
      set.add(path);
      landingsByQuery.set(q, set);
    }
  } else {
    // The page+query dimension failed. Without it we cannot distinguish true
    // coverage gaps from "query that lands somewhere", so idea classes shift
    // unpredictably. Flag the run so callers can warn the user (and the ideas
    // route never lets a degraded run overwrite a healthier prior one).
    partialData = true;
    console.error("[ideas-engine] page+query dimension failed (partial data):", pageQueryRes.reason);
  }

  return { totals: [...totalsMap.values()], landingsByQuery, partialData };
}

export function overlapRatio(a: Set<string>, b: Set<string>): number {
  const smaller = a.size <= b.size ? a : b;
  const larger = a.size <= b.size ? b : a;
  if (smaller.size === 0) return 0;
  let hits = 0;
  for (const t of smaller) if (larger.has(t)) hits++;
  return hits / smaller.size;
}

export class UnionFind {
  private parent: number[];
  constructor(n: number) {
    this.parent = Array.from({ length: n }, (_, i) => i);
  }
  find(i: number): number {
    while (this.parent[i] !== i) {
      this.parent[i] = this.parent[this.parent[i]];
      i = this.parent[i];
    }
    return i;
  }
  union(a: number, b: number) {
    const ra = this.find(a);
    const rb = this.find(b);
    if (ra !== rb) this.parent[Math.max(ra, rb)] = Math.min(ra, rb);
  }
}

function clusterQueries(rows: QueryRow[]): Cluster[] {
  const sorted = [...rows].sort((a, b) => b.impressions - a.impressions).slice(0, MAX_QUERIES);
  const tokenSets = sorted.map((r) => new Set(tokenize(r.query)));

  const df = new Map<string, number>();
  for (const ts of tokenSets) {
    for (const t of ts) df.set(t, (df.get(t) ?? 0) + 1);
  }
  // A token is only allowed to link queries when it is rare enough to be meaningful.
  const rareMax = Math.max(2, Math.ceil(sorted.length * 0.02));
  const linkable = new Set([...df.entries()].filter(([, c]) => c <= rareMax).map(([t]) => t));

  const byToken = new Map<string, number[]>();
  tokenSets.forEach((ts, i) => {
    for (const t of ts) {
      if (!linkable.has(t)) continue;
      const list = byToken.get(t) ?? [];
      list.push(i);
      byToken.set(t, list);
    }
  });

  const uf = new UnionFind(sorted.length);
  for (const list of byToken.values()) {
    for (let x = 0; x < list.length; x++) {
      for (let y = x + 1; y < list.length; y++) {
        const a = list[x];
        const b = list[y];
        if (overlapRatio(tokenSets[a], tokenSets[b]) >= 0.5) uf.union(a, b);
      }
    }
  }

  const groups = new Map<number, number[]>();
  sorted.forEach((_, i) => {
    const root = uf.find(i);
    const g = groups.get(root) ?? [];
    g.push(i);
    groups.set(root, g);
  });

  const clusters: Cluster[] = [];
  for (const g of groups.values()) {
    let impressions = 0;
    let clicks = 0;
    const tokens = new Map<string, number>();
    for (const i of g) {
      const r = sorted[i];
      impressions += r.impressions;
      clicks += r.clicks;
      for (const t of tokenSets[i]) tokens.set(t, (tokens.get(t) ?? 0) + r.impressions);
    }
    if (impressions < MIN_CLUSTER_IMPR || tokens.size === 0) continue;
    clusters.push({ members: g.map((i) => sorted[i]), tokens, impressions, clicks });
  }
  return clusters.sort((a, b) => b.impressions - a.impressions);
}

function buildInventory(contentDocs: { path: string; title: string | null; headings: { level: number; text: string }[] }[]): InventoryPage[] {
  return contentDocs.map((c) => ({
    path: c.path,
    tokens: new Set(
      tokenize([c.path.replace(/\//g, " "), c.title ?? "", ...c.headings.map((h) => h.text)].join(" "))
    ),
  }));
}

function topTokens(cluster: Cluster, n: number): string[] {
  return [...cluster.tokens.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([t]) => t);
}

function classify(
  cluster: Cluster,
  landings: Set<string> | undefined,
  inventory: InventoryPage[]
): IdeaDoc | null {
  const { impressions, clicks } = cluster;
  const weightedPosition =
    cluster.members.reduce((acc, m) => acc + m.position * m.impressions, 0) / impressions;
  const ctr = impressions > 0 ? clicks / impressions : 0;
  const head = [...cluster.members].sort((a, b) => b.impressions - a.impressions)[0];

  const tops = topTokens(cluster, 5);
  const coveringPages = inventory
    .filter((p) => overlapRatio(new Set(tops), p.tokens) >= 0.6)
    .slice(0, 6)
    .map((p) => p.path);

  const hasLanding = Boolean(landings && landings.size > 0);
  const monthlyImpr = impressions / (IDEA_WINDOW_DAYS / 30);
  const round = (v: number) => Math.max(0, Math.round(v));

  let type: IdeaDoc["type"];
  let note: string;
  let low = 0;
  let high = 0;

  if (!hasLanding && coveringPages.length === 0 && impressions >= GAP_MIN_IMPR) {
    type = "gap";
    low = round(expectedCtr(8) * monthlyImpr * 0.7);
    high = round(expectedCtr(5) * monthlyImpr);
    note = `${impressions} impressions over ${IDEA_WINDOW_DAYS}d with no crawled page targeting it — demand exists, coverage doesn't.`;
  } else if (weightedPosition <= 3 && clicks >= WE_MIN_CLICKS) {
    type = "winner-expansion";
    const monthlyClicks = clicks / (IDEA_WINDOW_DAYS / 30);
    low = round(monthlyClicks * 0.25);
    high = round(monthlyClicks * 0.75);
    note = `Already ranking #${weightedPosition.toFixed(1)} with ${clicks} clicks/${IDEA_WINDOW_DAYS}d — validated sibling phrasings deserve their own pages.`;
  } else if (
    impressions >= MM_MIN_IMPR &&
    weightedPosition <= 10 &&
    ctr < expectedCtr(weightedPosition) * 0.5
  ) {
    type = "intent-mismatch";
    const uplift = Math.max(0, expectedCtr(weightedPosition) - ctr) * monthlyImpr;
    low = round(uplift * 0.5);
    high = round(uplift);
    note = `${impressions} impressions at #${weightedPosition.toFixed(1)} but only ${(ctr * 100).toFixed(1)}% CTR vs ${(expectedCtr(weightedPosition) * 100).toFixed(1)}% typical for that spot — snippet/page fails the demand.`;
  } else if (weightedPosition > 3 && weightedPosition <= 20 && impressions >= SD_MIN_IMPR) {
    type = "striking-distance";
    low = round(Math.max(0, expectedCtr(5) - ctr) * monthlyImpr);
    high = round(Math.max(0, expectedCtr(3) - ctr) * monthlyImpr);
    note = `Ranks #${weightedPosition.toFixed(1)} against ${impressions} impressions/90d — pages hitting #3 pull ~${Math.round(expectedCtr(3) * 100)}% CTR vs your ${(ctr * 100).toFixed(1)}%.`;
  } else {
    return null;
  }

  if (low === 0 && high === 0) return null;

  const confidence: IdeaDoc["confidence"] =
    impressions >= 1000 && cluster.members.length >= 5 ? "high" : impressions >= 250 || cluster.members.length >= 3 ? "medium" : "low";

  return {
    id: createHash("sha256").update(`${type}|${head.query}`).digest("hex").slice(0, 16),
    type,
    topic: head.query,
    tokens: tops,
    queriesCount: cluster.members.length,
    impressions90d: impressions,
    clicks90d: clicks,
    ctr,
    weightedPosition: Number(weightedPosition.toFixed(1)),
    projectedClicksPerMonth: { low, high },
    confidence,
    branded: false,
    evidenceNote: note,
    evidence: {
      topQueries: [...cluster.members]
        .sort((a, b) => b.impressions - a.impressions)
        .slice(0, 6)
        .map((m) => ({ query: m.query, impressions: m.impressions, clicks: m.clicks, position: Number(m.position.toFixed(1)) })),
      coveringPages,
      autocompletePhrasings: [],
      validated: false,
    },
  };
}

async function attachAutocomplete(ideas: IdeaDoc[]): Promise<void> {
  const ranked = [...ideas].sort((a, b) => b.projectedClicksPerMonth.high - a.projectedClicksPerMonth.high);
  const targets = ranked.slice(0, AUTOCOMPLETE_TOP_N);
  await Promise.allSettled(
    targets.map(async (idea) => {
      const result = await validateTopic(idea.topic, idea.tokens);
      idea.evidence.autocompletePhrasings = result.phrasings;
      idea.evidence.validated = result.validated;
    })
  );
}

/**
 * Discovery seeds must be TOPICAL, not person-name long-tails. The highest-
 * impression clusters are often dominated by topper names ("garima lohia
 * marksheet") — mining autocomplete around names yields gossip queries about
 * other people, not content demand the site can own.
 *
 * Heuristic prefilter: head must contain a topical anchor (a token used by many
 * distinct queries), must not be brand-adjacent, and must differ from already
 * picked seeds. When AI is available it picks 3 themes from the candidates but
 * may only return verbatim candidates — never invented phrases.
 */
async function pickDiscoverySeeds(clusters: Cluster[], rows: QueryRow[], brand: string | null): Promise<string[]> {
  const globalDf = new Map<string, number>();
  for (const r of rows) {
    for (const t of new Set(tokenize(r.query))) globalDf.set(t, (globalDf.get(t) ?? 0) + 1);
  }
  const minAnchorDf = Math.max(8, Math.ceil(rows.length * 0.01));

  const candidates: string[] = [];
  const candidateSets: Set<string>[] = [];
  for (const c of clusters) {
    const head = c.members.reduce((a, b) => (b.impressions > a.impressions ? b : a)).query;
    const tokens = new Set(tokenize(head));
    if (brand && [...tokens].some((t) => t.includes(brand))) continue;
    if (![...tokens].some((t) => (globalDf.get(t) ?? 0) >= minAnchorDf)) continue;
    if (candidateSets.some((s) => [...tokens].filter((t) => s.has(t)).length >= 2)) continue;
    candidates.push(head);
    candidateSets.push(tokens);
    if (candidates.length >= 10) break;
  }
  if (candidates.length === 0) return [];

  if (!aiEnabled()) return candidates.slice(0, 3);

  try {
    const res = await chatJSON<{ seeds: string[] }>(
      `You select keyword-research seed phrases for one website's content strategy.
Given candidate search queries (real demand this site already appears for), choose exactly 3 seeds representing broad evergreen CONTENT THEMES worth building pages around.
HARD RULES:
- Copy candidates VERBATIM — inventing or editing phrases is a violation.
- NEVER pick queries about specific private individuals (person names, marksheets, personal answer copies, salaries).
- Prefer themes like syllabus, preparation strategy, book lists, exam patterns, study material.
Return STRICT JSON: {"seeds":["<candidate>","<candidate>","<candidate>"]}`,
      JSON.stringify(candidates)
    );
    const valid = (res.seeds ?? [])
      .map((s) => String(s).toLowerCase().trim())
      .filter((s) => candidates.includes(s));
    return valid.length >= 2 ? valid.slice(0, 3) : [];
  } catch (err) {
    console.error("[ideas-engine] ai seed selection failed:", err);
    return [];
  }
}

export async function runIdeaResearch(userId: string, site: string, accessToken: string): Promise<IdeaRunDoc> {
  const { page_content } = await getCollections();
  const contentDocs = await page_content.find({ userId, siteUrl: site }).toArray();

  const { totals, landingsByQuery, partialData } = await pullQueryData(site, accessToken);

  const brand = brandTokenFor(site);
  let brandedFiltered = 0;
  const rows: QueryRow[] = [];
  for (const t of totals) {
    if (brand && t.query.toLowerCase().includes(brand)) {
      brandedFiltered++;
      continue;
    }
    rows.push(t);
  }

  const clusters = clusterQueries(rows);
  const inventory = buildInventory(contentDocs);

  const ideas: IdeaDoc[] = [];
  for (const cluster of clusters) {
    const head = cluster.members.reduce((a, b) => (b.impressions > a.impressions ? b : a));
    const landings = landingsByQuery.get(head.query.toLowerCase());
    const idea = classify(cluster, landings, inventory);
    if (idea) ideas.push(idea);
  }

  ideas.sort((a, b) => b.projectedClicksPerMonth.high - a.projectedClicksPerMonth.high);
  const capped = ideas.slice(0, MAX_IDEAS);
  await attachAutocomplete(capped);

  // Discovery phase — demand beyond the current Search Console footprint.
  let discoveryPhrasings = 0;
  let discoveryTopics = 0;
  try {
    const seedHeads = await pickDiscoverySeeds(clusters, rows, brand);
    const discovery = await discoverNewTopics(userId, site, seedHeads, contentDocs);
    capped.push(...discovery.ideas);
    discoveryPhrasings = discovery.phrasingsMined;
    discoveryTopics = discovery.ideas.length;
  } catch (err) {
    console.error("[ideas-engine] discovery phase failed (non-fatal):", err);
  }

  return {
    userId,
    siteUrl: site,
    generatedAt: new Date(),
    stats: {
      windowDays: IDEA_WINDOW_DAYS,
      queriesAnalyzed: totals.length,
      brandedFiltered,
      clustersFormed: clusters.length,
      ideasReturned: capped.length,
      aiPackaged: false,
      discoveryPhrasings,
      discoveryTopics,
      partialData,
    },
    ideas: capped,
  };
}

// ---- AI packaging pass: strictly grounded in the receipts produced above ----

type AiPackage = {
  ideas: { id: string; angle: string; outline: string[] }[];
};

export async function packageIdeasWithAI(run: IdeaRunDoc): Promise<IdeaRunDoc> {
  if (!aiEnabled() || run.ideas.length === 0) return run;

  const measured = run.ideas.filter((i) => i.type !== "new-topic").slice(0, 8);
  const fresh = run.ideas.filter((i) => i.type === "new-topic").slice(0, 6);
  const payload = [...measured, ...fresh].map((i) => ({
    id: i.id,
    type: i.type,
    topic: i.topic,
    impressions90d: i.impressions90d,
    clicks90d: i.clicks90d,
    avgPosition: i.weightedPosition,
    ctr: Number((i.ctr * 100).toFixed(1)),
    projectedClicksPerMonth: i.projectedClicksPerMonth,
    evidenceNote: i.evidenceNote,
    googleAutocompletePhrasings: i.evidence.autocompletePhrasings.slice(0, 6),
    existingCoveringPages: i.evidence.coveringPages,
  }));

  const system = `You are Impiseo's Content Research Analyst embedded in an SEO product.

You receive topic clusters mined deterministically from the user's own Google Search Console data and their crawled page inventory. Every number in the input is VERIFIED measured data. Your job is to package each cluster into a concrete content idea.

HARD RULES — violations make the output useless:
- You NEVER invent topics, keywords, or demand that is not present in the input.
- You NEVER cite any metric that is not in the input for that idea.
- When GoogleAutocompletePhrasings exist, ground the outline's section beats in those real phrasings.
- For "gap" and "new-topic" ideas assume a NEW page must be built; for others assume improving/expanding EXISTING pages (reference existingCoveringPages when non-empty).
- For "new-topic" ideas there are no impression numbers by definition (demand beyond the site's current footprint) — the receipts are the autocomplete phrasings themselves. Never fabricate volume.
- Angle: 1-2 sentences stating exactly what to create and why, quoting at least one receipt number or real phrasing.
- Outline: 3-5 concrete section beats (working H2s), each tied to the real phrasings/queries provided.
- No fluff, no pleasantries, no disclaimers inside the JSON values.`;

  const user = `SITE CONTEXT:\n${JSON.stringify(payload)}\n\nReturn STRICT JSON only: {"ideas":[{"id":"<copy exactly>","angle":"<1-2 sentences>","outline":["<beat 1>","<beat 2>"]}]} — every input id must appear exactly once.`;

  const skills = selectSkills("content ideas keyword research striking distance content strategy");
  const library = skills.length ? `\n\nREFERENCE PLAYBOOKS (style guidance only):\n${skills.map((s) => `<skill source="${s.name}">\n${s.content.slice(0, 6000)}\n</skill>`).join("\n")}` : "";

  const result = await chatJSON<AiPackage>(system + library, user);

  const byId = new Map(result.ideas?.map((p) => [p.id, p]) ?? []);
  for (const idea of run.ideas) {
    const match = byId.get(idea.id);
    if (match?.angle && Array.isArray(match.outline) && match.outline.length > 0) {
      idea.angle = String(match.angle).slice(0, 400);
      idea.outline = match.outline.slice(0, 5).map((o) => String(o).slice(0, 140));
    }
  }
  run.stats.aiPackaged = true;
  return run;
}
