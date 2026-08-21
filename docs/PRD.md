# PRD — SEO Copilot (working name: "SEO Console")

> **One-liner:** An SEO copilot that reads your Google Search Console + your actual page content, then tells you exactly which pages to fix and what to publish next — with the fix already drafted.
>
> **Pitch:** *GSC tells you what happened. We tell you what to do about it.*

---

## 1. Problem

Google Search Console shows site owners raw performance data (clicks, impressions, positions), but:

- It doesn't say **what to do next**
- Recommendations require SEO expertise most founders don't have
- Existing tools (Ahrefs, Semrush) are expensive, bloated, and keyword-first rather than action-first

**Gap:** nobody joins *search performance* × *actual on-page content* into concrete, prioritized fixes with drafts attached.

## 2. Target user

Solo founders and small teams (2–10 people) doing content marketing / SEO without an in-house SEO specialist. Willing to pay $29–79/mo for something that replaces "guessing what to optimize."

## 3. Product loop (customer experience)

1. **Connect** — sign in with Google → pick Search Console property → app backfills 90 days of search data + crawls top ~300 pages by impressions
2. **Review** — dashboard shows a prioritized opportunity list (see §5)
3. **Act** — click any item → content brief or drafted fix (title/meta rewrite, section draft) grounded in the real page content
4. **Return** — weekly digest email summarizing new opportunities + wins/losses (retention driver)

## 4. Feature scope

### ✅ Shipped (MVP foundation)

| Feature | Detail |
|---|---|
| Google OAuth login | NextAuth v5 (`next-auth@beta`), Google provider, scopes: `openid email profile webmasters.readonly`, `access_type=offline` + `prompt=consent` for refresh tokens |
| Token lifecycle | Access token stored in encrypted JWT session; auto-refresh via `refreshAccessToken()` in `jwt` callback |
| Property picker | Lists verified GSC properties via `sites.list` |
| Stats API | `/api/stats?site=&days=7\|28\|90` — clicks, impressions, CTR, impression-weighted avg position, period-over-period deltas, daily timeseries, top 25 queries, top 25 pages |
| Dashboard UI | KPI cards w/ deltas, dual-axis area chart, sortable query/page tables with position badges |

### ⬜ Phase 1 — Foundation (blocks everything else)

| Item | Why |
|---|---|
| Postgres (Supabase/Neon) + Drizzle ORM | Persistence; history beyond GSC's 16-month window |
| Move Google tokens from JWT cookie → DB (encrypted) | Background jobs must pull data while user is offline |
| Auth gate (email allowlist / invite codes) | Currently any Gmail can log in and consume quota |
| Daily ingestion cron per property | Store `query × page × date × device × country` rows; use Inngest/Vercel Cron |

### ⬜ Phase 2 — Page content pipeline

Decision recorded: **crawl rendered website content; do NOT request codebase/GitHub access.**

- Crawl top ~300 pages by impressions (not the whole site)
- Plain `fetch` first; headless browser fallback only for JS-heavy sites
- Extract: title, meta description, canonical, H1–H3 outline, visible text, word count, structured data
- Tables: `pages`, `page_content`
- Etiquette: robots.txt compliance, ~1 req/2s per domain, weekly re-crawl or on-demand, honor ETag/Last-Modified

### ⬜ Phase 3 — Recommendation engine

Deterministic rules first (cheap, explainable, trustworthy), LLM layer second (drafts, polish). Each rule outputs `{type, page, query, evidence, suggestedAction}`.

| # | Rule | Signal | Output |
|---|---|---|---|
| 1 | **Striking distance** *(build first)* | Position 5–15 + impressions ≥ threshold | "Optimize these pages to hit page 1" list |
| 2 | **CTR fixer** | High impressions, CTR below position-predicted baseline | AI-rewritten title/meta, side-by-side with current |
| 3 | **Content decay** | Position dropped >2 spots week-over-week | Refresh alert w/ historical chart |
| 4 | **Cannibalization** | 2+ pages ranking for same query | Consolidate suggestion |
| 5 | **Content gaps** | Queries earning clicks with no matching/dedicated page | New post ideas, clustered by topic |
| 6 | **Content-aware check** (needs Phase 2) | Query terms missing from page title/headings/body | Concrete "add section X" + LLM-drafted section using real page context |

LLM layer: batch opportunities → content briefs (outline + target keywords + word count) + drafted fixes. Provider TBD (OpenAI/Anthropic).

### ⬜ Phase 3.5 — Integrations framework + product analytics join

Built as a **provider connector system** (not hardcoded integrations) so new sources plug in without schema changes.

**Unified model**

```
connections {
  id, user_id,
  provider,               -- 'gsc' | 'posthog' | future: ga4, search-ads, stripe...
  credentials_enc,        -- encrypted JSON (OAuth tokens or API keys)
  status,                 -- active | error | expired
  connected_at
}
```

```ts
interface ProviderAdapter {
  id: string;
  label: string;
  authType: "oauth" | "api_key";
  validate(creds): Promise<{ ok: boolean; error?: string }>;
  ingest(ctx: { connectionId: string; from: Date; to: Date }): Promise<Row[]>;
}
```

Launch providers (only these two at MVP):
- **GSC** — `authType: oauth`, flows through NextAuth (already implemented); feeds impressions/clicks/position
- **PostHog** — `authType: api_key` (personal API key + project ID, validated on save); feeds pageviews/conversions

UI: `/integrations` settings page with connector cards (Connected / Not connected states). Dashboard sections depending on a missing provider show contextual upsell ("Connect PostHog to unlock conversion insights").

Join key: GSC `page` dimension ↔ PostHog `$pathname`.

- Nightly ingestion of pageviews + conversion events (customer picks which events count as conversions)
- Extend `daily_metrics` with `conversions` column
- New opportunity rules:
  - **Conversion gap**: high organic traffic + zero/near-zero conversions → intent mismatch or CTA failure alert
  - **Revenue-first prioritization**: pages converting well but ranking poorly → weight striking-distance opportunities by estimated value
  - **Page ROI score**: revenue-per-click across all pages → sort every opportunity list by impact

### ⬜ Phase 4 — SaaS packaging

- **Stripe billing**: Free (1 site, rules only) → $29/mo (3 sites + AI briefs) → $79/mo (10 sites + digests + exports)
- Weekly digest email (retention engine)
- Onboarding: connect → backfill → first 5 opportunities in <60s

## 5. Data model (target)

```
users               (id, email, role)
google_tokens       (user_id, access_token_enc, refresh_token_enc, expiry)
properties          (id, user_id, gsc_site_url, display_name)
daily_metrics       (property_id, date, query, page, device, country,
                     clicks, impressions, ctr, position)          -- ingested nightly
pages               (id, property_id, url, title, meta_description,
                     h1, headings_json, word_count, last_crawled_at)
page_content        (page_id, text_content, etag, last_modified)
opportunities       (id, property_id, type, page_url, query, evidence_json,
                     suggested_action, status, created_at)
briefs              (id, opportunity_id, model, prompt, output_md, created_at)
```

## 6. Known constraints & gotchas (discovered during build)

- GSC data lags ~3 days → stats end-date = today − 3
- GSC retains only 16 months of data → own DB is the moat
- OAuth clients in **Testing mode**: refresh tokens expire after 7 days → production needs verification or dedicated approved client
- Every Google Cloud project used for GSC API calls must have **Search Console API enabled** (separate switch from OAuth)
- NextAuth v5 beta quirks: augment types via `@auth/core/jwt`; mutate `token` instead of returning spread objects (index-signature typing)

## 7. Future / parked ideas

- Competitor SERP data via third-party SERP API
- Push fixes as PRs (requires GitHub integration — revisit only after strong demand)

## 8. Non-goals

- Keyword research volume databases (Ahrefs/Semrush territory)
- Rank-tracking grids by geo/device
- Full technical SEO audits (screaming-frog territory)
- Codebase/repo access for customers
