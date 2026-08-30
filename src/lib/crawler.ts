import * as cheerio from "cheerio";
import { normalizePath } from "./url";
import type { PageContentDoc } from "./db";

const USER_AGENT = "ImpiseoBot/0.1 (+https://impiseo.com/bot)";
const MIN_DELAY_MS = 2000;
const FETCH_TIMEOUT_MS = 15000;
const STALE_AFTER_MS = 7 * 24 * 60 * 60 * 1000;

type RobotsRules = {
  disallow: string[];
  crawlDelayMs: number;
};

const robotsCache = new Map<string, { rules: RobotsRules; fetchedAt: number }>();
const ROBOTS_TTL_MS = 60 * 60 * 1000;

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function fetchWithTimeout(url: string, init?: RequestInit, timeoutMs = FETCH_TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal, redirect: "follow" });
  } finally {
    clearTimeout(timer);
  }
}

function matchesRule(pathAndQuery: string, rule: string): boolean {
  if (rule === "") return false;
  const clean = rule.replace(/\*+$/, "");
  return pathAndQuery.startsWith(clean);
}

export async function getRobots(origin: string): Promise<RobotsRules> {
  const cached = robotsCache.get(origin);
  if (cached && Date.now() - cached.fetchedAt < ROBOTS_TTL_MS) return cached.rules;

  const rules: RobotsRules = { disallow: [], crawlDelayMs: MIN_DELAY_MS };
  try {
    const res = await fetchWithTimeout(`${origin}/robots.txt`, undefined, 8000);
    if (res.ok) {
      const text = await res.text();
      let inStarGroup = false;
      for (const line of text.split(/\r?\n/)) {
        const trimmed = line.split("#")[0].trim();
        if (!trimmed) continue;
        const [rawKey, ...rest] = trimmed.split(":");
        const key = rawKey.trim().toLowerCase();
        const value = rest.join(":").trim();

        if (key === "user-agent") {
          inStarGroup = value === "*";
        } else if (inStarGroup && key === "disallow") {
          if (value !== "") rules.disallow.push(value);
        } else if (inStarGroup && key === "crawl-delay") {
          const secs = Number(value);
          if (!Number.isNaN(secs)) {
            rules.crawlDelayMs = Math.max(MIN_DELAY_MS, secs * 1000);
          }
        }
      }
    }
    // 404 / unreachable robots.txt → allow all
  } catch {
    // be conservative but not blocking on network errors
  }

  robotsCache.set(origin, { rules, fetchedAt: Date.now() });
  return rules;
}

function isAllowed(rules: RobotsRules, url: string): boolean {
  const u = new URL(url);
  const pathAndQuery = `${u.pathname}${u.search}`;
  return !rules.disallow.some((rule) => matchesRule(pathAndQuery, rule));
}

export type CrawlOutcome =
  | { status: "ok"; content: Omit<PageContentDoc, "userId" | "siteUrl" | "path"> }
  | { status: "not_modified" }
  | { status: "blocked_by_robots" }
  | { status: "skipped"; reason: string }
  | { status: "error"; error: string };

function extract(html: string): Pick<
  PageContentDoc,
  "title" | "metaDescription" | "canonical" | "headings" | "wordCount" | "textSample" | "structuredData"
> {
  const $ = cheerio.load(html);

  const title = $("head title").first().text().trim() || null;

  const metaDescription =
    $('meta[name="description"]').attr("content")?.trim() ||
    $('meta[property="og:description"]').attr("content")?.trim() ||
    null;

  const canonicalRaw = $('link[rel="canonical"]').attr("href")?.trim() || null;
  let canonical: string | null = null;
  if (canonicalRaw) {
    try {
      canonical = normalizePath(new URL(canonicalRaw, "https://placeholder.invalid").toString());
    } catch {
      canonical = null;
    }
  }

  const headings: { level: number; text: string }[] = [];
  $("h1, h2, h3").each((_, el) => {
    const text = $(el).text().replace(/\s+/g, " ").trim().slice(0, 200);
    if (text) headings.push({ level: Number(el.tagName.slice(1)), text });
  });

  const structuredData: unknown[] = [];
  $('script[type="application/ld+json"]').each((_, el) => {
    if (structuredData.length >= 10) return;
    try {
      structuredData.push(JSON.parse($(el).contents().text()));
    } catch {
      // malformed JSON-LD — ignore
    }
  });

  const bodyClone = $("body").clone();
  bodyClone.find("script, style, noscript, template, svg, iframe").remove();
  const text = bodyClone.text().replace(/\s+/g, " ").trim();

  return {
    title,
    metaDescription,
    canonical,
    headings,
    wordCount: text ? text.split(" ").length : 0,
    textSample: text.slice(0, 2000),
    structuredData,
  };
}

export async function crawlPage(
  page: { url: string; path: string },
  conditional?: { etag?: string | null; lastModified?: string | null }
): Promise<CrawlOutcome> {
  let parsed: URL;
  try {
    parsed = new URL(page.url);
  } catch {
    return { status: "error", error: `Invalid URL: ${page.url}` };
  }

  const robots = await getRobots(parsed.origin);
  if (!isAllowed(robots, page.url)) {
    return { status: "blocked_by_robots" };
  }

  const reqHeaders: Record<string, string> = { "User-Agent": USER_AGENT };
  if (conditional?.etag) reqHeaders["If-None-Match"] = conditional.etag;
  if (conditional?.lastModified) reqHeaders["If-Modified-Since"] = conditional.lastModified;

  let res: Response;
  try {
    res = await fetchWithTimeout(page.url, { headers: reqHeaders });
  } catch (e) {
    return { status: "error", error: e instanceof Error ? e.message : "fetch failed" };
  }

  if (res.status === 304) {
    return { status: "not_modified" };
  }

  const contentType = res.headers.get("content-type") ?? "";
  if (!res.ok) {
    return { status: "error", error: `HTTP ${res.status}` };
  }
  if (!contentType.includes("text/html")) {
    return { status: "skipped", reason: `non-HTML content-type: ${contentType.split(";")[0]}` };
  }

  let html: string;
  try {
    html = await res.text();
  } catch (e) {
    return { status: "error", error: e instanceof Error ? e.message : "failed to read response body" };
  }
  return {
    status: "ok",
    content: {
      httpStatus: res.status,
      etag: res.headers.get("etag"),
      lastModified: res.headers.get("last-modified"),
      fetchedAt: new Date(),
      ...extract(html),
    },
  };
}

export async function politeDelay(crawlDelayMs?: number) {
  await sleep(Math.max(MIN_DELAY_MS, crawlDelayMs ?? 0));
}

export function staleThreshold() {
  return new Date(Date.now() - STALE_AFTER_MS);
}
