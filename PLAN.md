# Impiseo — Pivot Plan: "Sentry for your organic pipeline"

Decision date: Aug 2026. This document supersedes the dashboard-first direction.

## 1. The Wedge

**Conversion-leak + ranking-drop alerts for content-led SaaS founders.**

One sentence pitch: *"Impiseo watches Search Console + PostHog and tells you the moment
your organic pipeline breaks — a money page slipped, clicks stopped converting, a new
post stalled — then hands your AI agent the fix."*

We are NOT: a dashboard, an SEO auditor, a keyword tool, an AI-visibility tracker.
We are an **interruptive monitoring product**. Presence ≠ sessions. Stay silent until
it matters, then scream.

### The three painkiller alerts (v1)

| # | Alert | Pain psychology | Moat? |
|---|-------|----------------|-------|
| 1 | **Position drop** — "page ranking #3 for 'x' fell to #14" | Loss aversion; nobody checks manually | No (commodity) |
| 2 | **Conversion leak** — "900 clicks last month, zero engaged visits" | Money visibly leaking; feels broken | **YES — requires GSC×behavior join; Ahrefs cannot do this** |
| 3 | **Post-publish tracker** — "indexed day 4 · first rank #18 · climbing" | Closes the 30-day anxiety loop after every publish | Partial |

Alert #2 is the hero metric and appears in every piece of marketing. #1 and #3 make the
product feel complete. Delivery is **email/Slack, not dashboard** — the user never has
to open Impiseo.

## 2. Target Audience

**Beachhead ICP**: technical founder or growth person at a 1–10 person content-led SaaS,
already running PostHog on their marketing site, blog drives meaningful signups.
Instrumentation-minded (they chose PostHog), allergic to vanity dashboards, have credit
card, buy tools without procurement.

Where they are: PostHog community/slack, Hacker News, X build-in-public circles, indie-hacker communities.

**Later expansion**: agencies managing client SEO (multi-property, higher ACV) → GA4-only
companies (adapter widens TAM ~10x).

**Explicitly not targeting yet**: enterprise SEO teams, local biz, e-commerce SKU farms.

## 3. Why Us (Moat)

1. URL-level join of search demand × real behavior — no SEO incumbent has behavior data;
   PostHog will never build SEO detectors.
2. Receipts-only determinism — every alert cites exact numbers; trust is the product.
3. Agent-native remediation — fixes ship as prompts now, PRs later. Matches 2026 workflow.

Competitive reality: Ahrefs WT/Sitebulb alert on crawls/ranks only. Rank trackers
(Nightwatch et al.) are commodity. GEO/AI-visibility startups (Profound et al.) are
funded and their measurement is pseudo-science — avoided deliberately.

## 4. Product Spec

### Data model (new collections)

```
snapshots_daily   { siteUrl, date, page, gsc:{clicks, impressions, position},
                    bh:{ views, engagedVisits, keyEvents? }, capturedAt }
                    -- unique index {siteUrl, date, page}

protected_pages   { siteUrl, path, pinned:boolean, autoScore }   -- top ~20 by clicks + pins

incidents         { id, siteUrl, type: drop|leak|publish|demand, severity,
                    page, evidence:{...exact numbers}, status: open|acked|resolved,
                    detectedForDate, createdAt, resolvedAt }

digests_sent      { siteUrl, sentAt, incidentIds, openTrackId }
```

`BehaviorSource` interface from day one (`src/lib/behavior/posthog.ts` today,
`ga4.ts` later) so the GA4 adapter is additive, not a redesign.

### Detector discipline (the make-or-break)

- Rolling 28-day baselines, day-of-week aware; min-volume floors (e.g. ≥30 clicks/wk).
- Drop = sustained ≥N positions below baseline across ≥3 days, adjusted against
  site-wide movement (filters core-update noise).
- Honest copy: "detected for Aug 20 — GSC reports with ~3-day lag". Never "overnight".
- Every alert carries 👍/👎; 👎 trains thresholds down per site. Target <1 false
  positive per user per month.
- Low-severity findings are absorbed into the Monday digest, never pushed acutely.

### Delivery

- Weekly Monday digest email (Resend + react-email): hero stat (leaks), open incidents,
  top 3 actions with receipts.
- Acute email within hours of confident detection (drop on protected page, new leak).
- Mobile: PWA manifest + service worker + **Web Push** for acute alerts (Android Chrome
  works day one; iOS requires add-to-home-screen). Notification = the alert surface;
  tap opens incident detail.
- Home-screen widget without a native app: public JSON endpoint `/api/widget/[token]`
  returning `{ site, status: "ok" | "incidents", openIncidents, atRiskUsd, lastDigest }`.
  Android users wire it into KWGT/Tasker for a glanceable tile; iOS users via Scriptable.
  Cheap marketing hook ("build your own widget"), no native dev.
- Slack webhook per site — phase 2.
- Each incident detail page = evidence table + fix plan + agent prompt
  (**reuse existing recommendations/[rid] components almost verbatim**).

### UI reshuffle

Nav becomes: **Incidents** (home) · Pages · Research (ideas/discovery demoted here) ·
Integrations · Settings. CTR projections removed from all surfaces.

## 5. Build Roadmap

| Phase | When | Scope |
|---|---|---|
| **0 — Validate** | this week | Reposition landing page; 10 DMs to PostHog-using content founders: "what did you last panic about re: SEO?" Gate: answers cluster on drops/leaks |
| **1 — Core** | wk 1–2 | snapshots_daily pipeline (Vercel Cron + CRON_SECRET), baselines, 3 detectors, incidents storage, demo alert on our own site |
| **2 — Deliver** | wk 3–4 | Resend integration, digest template, incident pages, protected-page auto-selection, PWA + web push, `/api/widget/[token]`, onboard 5–10 design partners (free) |
| **3 — Launch** | mo 2 | Stripe billing, Slack, mute/snooze, HN + PostHog community launch |
| **4 — Widen** | mo 3+ | GA4 adapter, multi-property, agency tier |

Parallel rule: Phase 0 (user does DMs) overlaps Phase 1 (build continues) — snapshots are
needed under every validation outcome.

## 6. Pricing

- **Free**: 1 property, Monday digest only, 7-day history. Word-of-mouth engine.
- **Pro $39/mo** ($29 early-adopter): acute alerts, Slack, unlimited protected pages,
  13-month history, agent prompts.
- **Agency $99/mo**: 10 properties, white-label digests, client report links.
- Design partners: 3 months free ↔ feedback + testimonial.

Unit logic: one saved lead-gen page pays for a year.

## 7. Survival Metrics (decide NOW, not later)

- Activation: ≥70% of connected sites produce ≥1 credible incident in week 1.
- Alert quality: 👎 rate <15%; <1 FP/user/month.
- Retention proxy: week-4 digest open ≥50%.
- Conversion: ≥8% of active free → paid within 60 days of billing launch.
- **Kill switch**: after two cohorts of design partners, if opens <35% or 👎 >15% →
  stop building this direction. The snapshot data still powers dashboards if we retreat.

## 8. Future Vision

1. Monitoring → **autonomous remediation**: confirmed incident → agent opens a PR
   (title/meta/schema fix) → human merges. "The SEO on-call that patches itself."
2. Cohort benchmarks: "pages like yours convert at 4.2% when leak-free" — network effect
   from aggregated snapshots (privacy-safe, opt-in).
3. Multi-channel pipeline watch: same detector pattern applied to newsletter/Referral
   sources once behavior-source abstraction exists.

## 9. Risks & Mitigations

| Risk | Mitigation |
|---|---|
| False positives destroy trust | Strict gates, 👎 feedback loop, digest absorbs marginal cases |
| GSC lag confuses ("overnight" claims) | Honest detection-date labels everywhere |
| PostHog-only TAM too small | BehaviorSource abstraction; GA4 adapter is phase 4 |
| Integration sprawl before signal | ONE source, THREE detectors, TEN inboxes — nothing else |
| Solo-founder bandwidth | No new engines; package what exists (recs, join, crawler, ideas) |
| Google API dependency | Official Search Console API only for monitoring; autocomplete scraping stays research-side, non-critical |

## 10. Immediate Next Actions

**User (validation, days 1–5)**
1. New landing headline: "Know the moment your organic pipeline breaks — conversion
   leaks & ranking drops, from Search Console + PostHog."
2. DM script: "Quick q — you run a blog on PostHog: what's the last SEO thing you
   panicked about (or found out 3 weeks late)? Building something for exactly this."
3. Send to 10 founders. Log answers verbatim in `validation-notes.md`.

**Agent (build, starts immediately)**
1. `snapshots_daily` schema + backfill job for existing sites.
2. Baseline + diff engine with noise gates.
3. Three detectors → `incidents`.
4. Demo digest email rendered from our own upscprepnotes.in data.
