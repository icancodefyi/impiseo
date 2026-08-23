import { createHash } from "node:crypto";
import { getCollections } from "@/lib/db";
import type { IdeaDoc, PageContentDoc } from "@/lib/db";
import { fetchAutocomplete } from "@/lib/autocomplete";
import { brandTokenFor, overlapRatio, tokenize } from "@/lib/ideas-engine";

const SEED_LIMIT = 4;
const LETTERS = "abcdefghijklmnopqrstuvwxyz";
const MODIFIERS = ["how", "what", "best", "vs"];
const BUDGET_MS = 20_000;
const CONCURRENCY = 8;
const MAX_DISCOVERY_IDEAS = 10;

type Entry = { text: string; tokens: Set<string>; triggers: Set<string> };

async function mapPool<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, Math.max(items.length, 1)) }, async () => {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i]);
    }
  });
  await Promise.all(workers);
  return results;
}

function trimToTokens(text: string, max: number): string {
  return text.toLowerCase().trim().split(/\s+/).slice(0, max).join(" ");
}

function pageTokens(doc: PageContentDoc): Set<string> {
  return new Set(
    tokenize([doc.path.replace(/\//g, " "), doc.title ?? "", ...doc.headings.map((h) => h.text)].join(" "))
  );
}

/**
 * Discovery phase — finds demand BEYOND the site's current Search Console footprint.
 * Seeds are expanded through Google Autocomplete alphabet-soup mining; every returned
 * phrasing is a real search users type. Clusters with zero coverage in the crawled
 * inventory become "new-topic" ideas. No impression numbers exist for these by
 * definition, so confidence comes from breadth of triggers, not volume.
 */
export async function discoverNewTopics(
  userId: string,
  site: string,
  seedHeads: string[],
  contentDocs: PageContentDoc[]
): Promise<{ ideas: IdeaDoc[]; phrasingsMined: number }> {
  const { users } = await getCollections();
  const user = await users.findOne({ userId });
  // audience is a usable seed ("upsc aspirants"); product type is usually too
  // generic ("docs / education") and pollutes the mining with unrelated demand.
  const profileBits = [user?.product?.audience].filter(
    (v): v is string => Boolean(v && v.trim().length >= 3)
  );

  const seenSeed = new Set<string>();
  const seeds: string[] = [];
  for (const candidate of [...seedHeads, ...profileBits]) {
    const trimmed = trimToTokens(candidate, 5);
    if (!trimmed || seenSeed.has(trimmed)) continue;
    seenSeed.add(trimmed);
    seeds.push(trimmed);
    if (seeds.length >= SEED_LIMIT) break;
  }
  if (seeds.length === 0) return { ideas: [], phrasingsMined: 0 };

  const brand = brandTokenFor(site);
  const deadline = Date.now() + BUDGET_MS;

  const tasks: { q: string; trigger: string }[] = [];
  for (const seed of seeds) {
    for (const letter of LETTERS) tasks.push({ q: `${seed} ${letter}`, trigger: letter });
    for (const mod of MODIFIERS) tasks.push({ q: `${mod} ${seed}`, trigger: mod });
  }

  const lists = await mapPool(tasks, CONCURRENCY, async (t) => {
    if (Date.now() > deadline) return [] as string[];
    try {
      return await fetchAutocomplete(t.q);
    } catch {
      return [] as string[];
    }
  });

  const byText = new Map<string, Entry>();
  lists.forEach((list, i) => {
    const trigger = tasks[i].trigger;
    for (const raw of list ?? []) {
      const text = String(raw).toLowerCase().trim();
      if (!text || text.length > 70) continue;
      if (brand && text.includes(brand)) continue;
      if (seenSeed.has(text)) continue;
      const existing = byText.get(text);
      if (existing) {
        existing.triggers.add(trigger);
        continue;
      }
      const tokens = new Set(tokenize(text));
      if (tokens.size === 0) continue;
      // restatements of the seed itself are not discoveries
      let isRestatement = false;
      for (const seed of seeds) {
        const seedTokens = new Set(seed.split(" "));
        if ([...tokens].every((t) => seedTokens.has(t))) {
          isRestatement = true;
          break;
        }
      }
      if (isRestatement) continue;
      byText.set(text, { text, tokens, triggers: new Set([trigger]) });
    }
  });

  const entries = [...byText.values()];
  const phrasingsMined = entries.length;
  if (entries.length < 2) return { ideas: [], phrasingsMined };

  // Cluster on REMAINDER tokens (completion minus seed words). Clustering on full
  // tokens chains everything through the shared seed words into one mega-cluster.
  const seedTokenSet = new Set(seeds.flatMap((s) => s.split(" ")));
  for (const e of entries) {
    e.tokens = new Set([...e.tokens].filter((t) => !seedTokenSet.has(t)));
  }
  const usable = entries.filter((e) => e.tokens.size > 0);

  const df = new Map<string, number>();
  for (const e of usable) for (const t of e.tokens) df.set(t, (df.get(t) ?? 0) + 1);

  // Facet grouping: each completion joins the group of its dominant remainder
  // token (highest df). No transitive chaining — keeps topics human-meaningful.
  const groups = new Map<string, number[]>();
  usable.forEach((e, i) => {
    let best = "";
    let bestDf = 0;
    for (const t of e.tokens) {
      const d = df.get(t) ?? 0;
      if (d > bestDf || (d === bestDf && t < best)) {
        best = t;
        bestDf = d;
      }
    }
    const g = groups.get(best) ?? [];
    g.push(i);
    groups.set(best, g);
  });

  const debug = process.env.DEBUG_DISCOVERY === "1";
  let killedByCoverage = 0;
  let killedBySupport = 0;

  const inventory = contentDocs.map((doc) => pageTokens(doc));
  const commonRatio = 0.25;

  const ideas: IdeaDoc[] = [];
  for (const group of groups.values()) {
    if (group.length < 2) continue;

    const members = group.map((i) => usable[i].text).sort((a, b) => a.length - b.length);
    const topic = members[0];
    const triggers = new Set(group.flatMap((i) => [...usable[i].triggers]));

    // Distinctive tokens: frequent within the group but NOT generic across all
    // completions and NOT part of the seed itself — those always match existing pages.
    const freq = new Map<string, number>();
    for (const i of group) for (const t of usable[i].tokens) freq.set(t, (freq.get(t) ?? 0) + 1);
    const tops = [...freq.entries()]
      .filter(([t]) => !seedTokenSet.has(t) && df.get(t)! / usable.length <= commonRatio)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4)
      .map(([t]) => t);
    if (tops.length === 0) {
      killedBySupport++;
      continue;
    }

    const coveredBy = inventory.filter((p) => overlapRatio(new Set(tops), p) >= 0.6).length;
    if (coveredBy > 0) {
      killedByCoverage++;
      continue;
    }

    const breadth = triggers.size;
    const support = members.length;
    if (support < 2 && breadth < 3) {
      killedBySupport++;
      continue;
    }

    const confidence: IdeaDoc["confidence"] =
      breadth >= 4 && support >= 4 ? "high" : breadth >= 2 ? "medium" : "low";

    ideas.push({
      id: createHash("sha256").update(`new-topic|${topic}`).digest("hex").slice(0, 16),
      type: "new-topic",
      topic,
      tokens: tops,
      queriesCount: support,
      impressions90d: 0,
      clicks90d: 0,
      ctr: 0,
      weightedPosition: 0,
      projectedClicksPerMonth: { low: 0, high: 0 },
      confidence,
      branded: false,
      evidenceNote: `${support} real phrasings Google completes around this topic across ${breadth} different entry points — none of your crawled pages target it.`,
      evidence: {
        topQueries: members.slice(0, 6).map((q) => ({ query: q, impressions: 0, clicks: 0, position: 0 })),
        coveringPages: [],
        autocompletePhrasings: members.slice(0, 8),
        validated: true,
      },
    });
  }

  const rank = (i: IdeaDoc) =>
    ({ high: 3, medium: 2, low: 1 })[i.confidence] * 100 + i.queriesCount;
  ideas.sort((a, b) => rank(b) - rank(a));

  if (debug) {
    console.log(
      `[discovery] seeds=${JSON.stringify(seeds)} entries=${entries.length} groups=${groups.size} ` +
        `coverageKills=${killedByCoverage} supportKills=${killedBySupport} kept=${ideas.length}`
    );
    for (const i of ideas.slice(0, 15)) {
      console.log(`[discovery]   ${i.confidence} | ${i.topic} | tokens=${i.tokens.join(",")} | n=${i.queriesCount}`);
    }
  }

  return { ideas: ideas.slice(0, MAX_DISCOVERY_IDEAS), phrasingsMined };
}
