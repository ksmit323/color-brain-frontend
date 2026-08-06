---
artifact_contract: ce-unified-plan/v1
artifact_readiness: requirements-only
product_contract_source: ce-brainstorm
title: Forecast Outlook - Plan
created: 2026-08-06
scope: Standard
---

# Forecast Outlook - Plan

## Goal Capsule

**Objective:** Add a separate, shareable page that lets an operations leader understand the potential savings from Color Brain in their own terms and take the next step to book a pilot. The page must feel AI-native and futuristic (not a generic "calculator"), live at its own URL, and be reachable from the primary nav.

**Product authority:** This plan is the source of product behavior for the Forecast page. `ce-plan` will add the HOW (component layout, state, calculation detail, styling tokens) without inventing new product behavior.

**Open blockers:** Mock HTML not inspected — search found no `calculator` content and shell listing was unavailable (`tbh-linux-sandbox: bwrap probe failed`). Assumptions below are marked where they depend on the mock. Final copy/numbers need ops-validated defaults before build.

## Product Contract

### Actor & Outcome

- **Primary actor:** Mill / dyehouse operations leader (lab manager, production manager, technical manager) responsible for first-attempt / rework rate.
- **Jobs:** "Show me, with my numbers, what Color Brain could save us — credibly, in 60 seconds — so I can justify a pilot to my boss."
- **Desired outcome:** Visitor arrives via nav or direct link, completes a guided preset-based estimate (no signup wall), sees a credible savings range with methodology, and books a pilot / requests contact.

### Success Signals

- Visitor completes full wizard without drop-off (>70% completion in analytics).
- Pilot-booking CTR from this page is measurable and attributable (separate from main `/` demo).
- Ops leaders report numbers feel "believable" not "salesy" (qualitative check: range + expandable methodology reduces skepticism).
- Page is directly linkable and shareable (`/forecast` renders standalone, no dependency on prior navigation).

### In Scope

- New page at dedicated URL with nav entry (desktop + mobile).
- Guided wizard with presets (mill size / type -> tune 6-8 ops inputs -> reveal).
- Client-side savings model showing **range (conservative / expected / optimistic)** + breakdown (rework avoided, dye, water, energy, time) with expandable "How we calculate".
- AI-futuristic visual language distinct from the mock's styling but consistent with Color Brain design tokens.
- Primary CTA: Book a pilot (calendar link / contact) + secondary: share / copy link with current inputs.
- Outbound analytics events for wizard steps and CTA.

### Out of Scope

- No backend persistence or auth for saved estimates (share via URL query string only, if at all in v1).
- No PDF export in v1 (defer; one-pager is a follow-up, not required for believability).
- No fleet benchmark comparison (requires anonymized customer data pipeline — keep as future enhancement).
- No renaming or redesign of the existing `/` first-attempt page.
- No generic "calculator" branding anywhere customer-facing.

### Naming & Routing (Settled)

- **Customer-facing name:** "Forecast" or "Savings Outlook". Nav label: **Forecast** (short, fits nav, pairs with Color Brain's prediction positioning; avoids ambiguity of "Calculator").
- **URL:** `/forecast` (canonical). Alternatives considered: `/outlook`, `/impact`, `/savings`. Decision: `/forecast` is verb-aligned with Color Brain's core ("first-attempt forecast") and matches the chosen "Savings Outlook / Forecast" framing. Keep `/outlook` as optional redirect if marketing prefers later.
- **Repo-relative routing:** Extend `app/src/main.rs:17` `Route` enum from single `#[route("/")] Home` to add `#[route("/forecast")] Forecast`. Introduce layout `NavBar` with `Outlet<Route>` so both `/` and `/forecast` share navigation. New view file: `app/src/views/forecast.rs` (and export from `app/src/views/mod.rs:1-3`).
- **Nav:** Text link "Forecast" in primary nav, active-state styling. Direct URL must render without prior navigation (router sync, not anchor).

### User Flows

**Flow 1 — Explore via nav:**
1. Visitor on `/` sees nav "Forecast" -> clicks -> lands on `/forecast`.
2. Sees step 1: "Choose your mill profile" (presets: small / medium / large, or cotton / blend / synthetic, with helper copy).
3. Step 2: Tune 6-8 ops inputs prefilled from preset (batches/month, current first-attempt or rework %, avg cost per correction, dye cost, water, energy, cycle time). Preset values are editable.
4. As they tune, preview updates subtly (not full reveal) to encourage completion.
5. Step 3: Reveal — animated counters show annual range: conservative / expected / optimistic, plus breakdown cards and "How we calculate" accordion. Disclaimer: "Estimate based on your inputs; actuals vary."
6. CTA row: [Book a pilot] primary, [Copy link] secondary, [Back to try Color Brain] tertiary.

**Flow 2 — Direct link / share:**
1. Visitor opens `/forecast?preset=medium&rework=18&batches=120` (if query-share lands in v1) -> wizard loads with those values already applied, jumps to reveal.

**Flow 3 — Abandon & return:**
1. Browser back/forward preserves wizard state via in-memory signal (no persistence required). Refresh resets to defaults (acceptable for v1).

### Requirements

**Functional:**

1. Page is routable at `/forecast` and appears in the site nav on every route (via shared layout). Direct navigation and refresh must render correctly.
2. Wizard is guided, not free-form: presets collapse choice, then allow tuning. Presets define sensible defaults for all 6-8 inputs so a user can accept defaults and still get a result.
3. Inputs: batches/month, current rework % (or first-attempt %), avg cost per rework (currency), dye, water, energy, cycle time (minutes). Currency defaults to user's locale; calculation uses a single currency symbol for display in v1.
4. Calculation is pure client-side (no network call). Must produce three numbers: conservative / expected / optimistic annual savings, plus breakdown by category. Formula is provisional until ops validates; plan must note it is assumption-backed.
5. Reveal uses **range, not single bold number**. Display: large expected value, flanked by conservative/optimistic in muted style, plus bar or stacked breakdown. "How we calculate" expand shows inputs, assumptions, and that mitigation is not guaranteed.
6. CTA "Book a pilot" links to existing pilot booking destination (calendly / contact form / sales email — whichever the site uses; reuse, don't create new funnel in v1).
7. Copy link copies current URL (with query params if implemented) or plain `/forecast` if not.
8. Analytics: fire events for `forecast_view`, `forecast_preset_select`, `forecast_reveal`, `forecast_cta_click` (naming TBD in plan).

**Non-functional / Visual:**

9. Visual language: **AI, futuristic** — dark/glass, subtle grid, neon accent on active inputs and result numbers, monospaced numerals with animated count-up on reveal, no "shitty" generic calculator card styling from the mock. Must still inherit `app/assets/styling/color_brain.css` tokens (fonts: Space Grotesk / IBM Plex Sans / Mono already loaded in `app/src/main.rs:47`) and not introduce a conflicting theme for the rest of the site.
10. Performance: instant interaction (no async `use_resource` needed); calculation is synchronous `use_memo` from signals.
11. Accessibility: keyboard-navigable wizard, labels for all inputs, range values announced.
12. SEO: `/forecast` has distinct title/meta ("Savings Forecast — Color Brain") and is not blocked from indexing unless marketing decides otherwise.

### Approaches Considered

**A — Forecast Studio (live split-pane simulator):**
Single page, presets left, live result right updating on every slider. Very fast to value, feels like an AI playground. Pros: low friction, great for explorers. Cons: encourages tweaking without completing narrative; single-number bias; harder to capture range + methodology credibility; weaker lead-gen flow.

**B — Guided Outlook Wizard (Recommended):**
Three steps: preset -> tune -> reveal range + methodology. Progress indicator, progressive disclosure, CTA only at reveal. Pros: matches "guided wizard with presets" preference, builds credibility via range + expandable methodology, naturally funnels to pilot booking, works as shareable narrative. Cons: one extra click vs live pane, but mitigated by sensible preset defaults.

**C — Benchmark Overlay:**
B plus anonymized fleet distribution overlay ("mills like yours"). Pros: strongest credibility. Cons: requires data pipeline, privacy review, heavier build — disproportionate carrying cost for v1; defer.

Recommendation: **B** for v1. It satisfies ops-leader credibility (range + methodology), keeps friction low via presets, delivers the AI-futuristic reveal moment, and is the smallest coherent product unit. A can be an alternate layout within the same component if user testing shows split-pane preference; C is a future enhancement.

### Calculation Model (Product-Level, Not Implementation)

- Inputs listed above map to annual savings = (rework reduction delta) * (cost per rework + dye + water + energy + time). Delta is derived from conservative/expected/optimistic improvement assumptions (e.g., rework drops from X% to Y%). Exact coefficients are **explicitly TBD with ops/product**; placeholder values in code must be clearly labeled as provisional and validated before launch.
- Display always as range. Single-number display is a non-goal.

### How This Work Fits Together

- Current site is single-route (`/`) Dioxus app (verified: `app/src/main.rs:14-20`, `app/Cargo.toml:10` `dioxus = { version = "0.7.1", features = ["router"] }`). This work adds the second route and the first shared layout.
- The HTML mock (uninspected due to `bwrap` sandbox probe failure and zero `search` hits for "calculator") is treated as inspiration for fields only, not styling. `ce-plan` should locate the mock file manually if still needed.
- No dependency on `color-brain-backend` (verified: backend hosts `first_attempt` model). Forecast is standalone client calc; pilot booking reuses existing contact.
- Future candidates not in this plan: PDF one-pager, fleet benchmark, persisted/shareable forecasts beyond URL query, localization of currency.

### Outstanding Questions

1. Where should "Book a pilot" route? Existing Calendly / HubSpot / email — confirm single destination to reuse.
2. Provisional coefficients: Who owns the savings formula (ops, finance)? Need validated conservative/expected/optimistic deltas before implementation.
3. Currency: Assume single display currency (e.g., € or $) or detect locale? Decision before visual polish.
4. Query-share: Include `?preset=...&rework=...` in v1 or defer to v1.1?
5. Nav label final: "Forecast" vs "Outlook" — marketing sign-off. URL stays `/forecast` regardless.
6. Analytics taxonomy: confirm event names with existing setup.

### Ready for Planning Check

- [x] Actor, outcome, success signals defined.
- [x] Scope boundaries explicit (in/out) and ambiguity marked (mock not inspected).
- [x] Flows cover primary nav, direct link, and abandon cases.
- [x] Requirements are testable without prescribing implementation files, schemas, or endpoints (file paths inside doc are repo-relative product-impact pointers only, per section contract).
- [x] Naming/URL/nav decisions settled (session-settled: audience=ops leader, name=Savings Outlook/Forecast, inputs=guided wizard with presets, output=range+methodology).
- [x] Next step is `ce-plan` enrichment (ce-plan will resolve HOW: component split, signals, styling, validation).
