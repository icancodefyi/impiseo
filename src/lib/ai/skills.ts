import fs from "node:fs";
import path from "node:path";

export type Skill = {
  name: string;
  content: string;
};

const MAX_CHARS_PER_SKILL = 24_000;
const MAX_CHARS_ALL_SKILLS = 150_000;
const PROMPT_BUDGET_CHARS = 19_000;

let skillsCache: Skill[] | null = null;

export function loadSkills(): Skill[] {
  if (skillsCache) return skillsCache;

  const dir = path.join(process.cwd(), "seo-skills");
  if (!fs.existsSync(dir)) {
    skillsCache = [];
    return skillsCache;
  }

  const files = fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".md"))
    .sort();

  const skills: Skill[] = [];
  let total = 0;
  for (const file of files) {
    const raw = fs.readFileSync(path.join(dir, file), "utf8").trim();
    const content = raw.length > MAX_CHARS_PER_SKILL ? `${raw.slice(0, MAX_CHARS_PER_SKILL)}…` : raw;
    if (total + content.length > MAX_CHARS_ALL_SKILLS) break;
    total += content.length;
    skills.push({ name: path.basename(file, ".md"), content });
  }

  skillsCache = skills;
  return skillsCache;
}

function topicWords(query: string): string[] {
  return [...new Set((query.toLowerCase().match(/[a-z]{4,}/g) ?? []))];
}

function relevanceScore(skill: Skill, words: string[]): number {
  if (words.length === 0) return 0;
  const haystack = skill.content.toLowerCase();
  let score = 0;
  for (const w of words) {
    const hits = haystack.split(w).length - 1;
    if (hits > 0) score += Math.min(hits, 20);
  }
  return score;
}

export function selectSkills(query: string): Skill[] {
  const all = loadSkills();
  if (all.length === 0) return [];

  const words = topicWords(query);
  const ranked = all
    .map((skill) => ({ skill, score: relevanceScore(skill, words) }))
    .sort((a, b) => b.score - a.score || a.skill.name.localeCompare(b.skill.name));

  const selected: Skill[] = [];
  let used = 0;
  for (const { skill } of ranked) {
    const remaining = PROMPT_BUDGET_CHARS - used;
    if (remaining < 2_000) break;
    const content = skill.content.length > remaining ? `${skill.content.slice(0, remaining)}…` : skill.content;
    selected.push({ name: skill.name, content });
    used += content.length;
  }
  return selected;
}

const ROLE = `You are the Impiseo SEO Copilot — an expert technical SEO consultant embedded in a search-analytics product.

Your knowledge comes from two sources, both provided below:
1. A curated library of SEO expert playbooks and video-transcript teachings ("SKILLS LIBRARY").
2. Real measured data about the user's site from Google Search Console and their crawler.

You never invent findings. You receive verified issues detected by deterministic rules over real crawled data. Your job is to explain WHY each issue matters for this specific page, HOW to fix it step by step, provide concrete drafts (rewritten titles or meta descriptions) where useful, and produce a ready-to-paste implementation brief for the user's AI coding agent. Your advice must sound like a seasoned practitioner from your skills library, not a generic checklist.`;

const METHOD = `HOW TO WORK:
- Ground every explanation in the evidence attached to the finding (title, headings, queries, impressions, word count). Quote the user's actual page data back at them.
- Prefer the highest-leverage move per the skills library (e.g., striking-distance pages ranking 4–20 are cheap wins; one template fix beats fifty page fixes).
- Write steps as concrete actions the user can execute today on their specific CMS/template — name exact sections to edit, words to add, chars to trim.
- When drafting titles: front-load the primary keyword, keep ≤60 chars, preserve brand suffix only if it fits.
- When drafting meta descriptions: 140–160 chars, include the main keyword naturally plus a reason to click.
- Never recommend buying backlinks or spammy tactics. Stay within white-hat practice from the skills library.
- Keep "why" to 2–3 sentences max. Steps: 2–4 items. No fluff, no pleasantries.

THE AGENT PROMPT (agentPrompt field):
The user will paste this into an AI coding agent (Cursor, Claude Code, Copilot Workspace) that has their website's source code open. Write it as a direct task brief the agent can execute without any other context:
- Start with a one-line GOAL stating the outcome in user terms.
- CONTEXT: name the affected page path(s), quote the current title/meta/heading values from the evidence so the agent can locate them.
- LOCATE: tell the agent exactly how to find the right code — e.g. "search the repo for the exact string <current title>" or "find where metadata for this route is defined".
- CHANGE: give the exact new values to write (use your drafts when present). For template-level findings, instruct fixing the shared template/component once.
- CONSTRAINTS: do not change visible page copy beyond this fix; keep existing framework conventions; no new dependencies.
- VERIFY: 1–3 concrete acceptance checks (e.g. rendered <title> equals X and is ≤60 chars).
Plain text with short section labels (GOAL / CONTEXT / LOCATE / CHANGE / CONSTRAINTS / VERIFY). Max ~250 words.`;

const OUTPUT_CONTRACT = `OUTPUT FORMAT — return STRICT JSON only, no markdown fences:
{
  "enhancements": [
    {
      "id": "<copy the id from the input finding exactly>",
      "why": "<why this matters for THIS page specifically>",
      "steps": ["<step 1>", "<step 2>", "..."],
      "draftTitle": "<rewritten title or null>",
      "draftMeta": "<rewritten meta description or null>",
      "agentPrompt": "<self-contained implementation brief for an AI coding agent, per the rules above>"
    }
  ]
}
Rules: every input id must appear exactly once. Omit draftTitle/draftMeta (use null) unless the finding is about titles or meta descriptions. Every enhancement MUST include agentPrompt.`;

export function buildSystemPrompt(query?: string): string {
  const skills = selectSkills(query ?? "");
  const library = skills.length
    ? skills.map((s) => `<skill source="${s.name}">\n${s.content}\n</skill>`).join("\n\n")
    : "No skill files found — rely on standard professional SEO expertise.";

  return `${ROLE}\n\n${METHOD}\n\n=== SKILLS LIBRARY ===\n${library}\n=== END SKILLS LIBRARY ===\n\n${OUTPUT_CONTRACT}`;
}
