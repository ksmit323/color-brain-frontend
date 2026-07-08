# Color Brain marketing landing page (colorbrain.co)

## Context

`colorbrain.co` and `app.colorbrain.co` are already provisioned as two separate
CloudFront/S3 targets in `color-brain-infra` (`s3_landing.tf` / `cloudfront_landing.tf` vs.
`s3_app.tf` / `cloudfront_app.tf`). Today the landing bucket only serves one hardcoded
placeholder `index.html` uploaded straight from Terraform (`landing_placeholder.tf`) — there is
no landing-page codebase or deploy pipeline yet.

The existing Framer site (`colorbrain.framer.website`) is the thing being replaced. Its content
outline (nav: Results / How It Works / Who It's For / Case Studies / Request a pilot; hero stat
86.7%; problem stats; 3-step How It Works; Who It's For — Brands/Suppliers/Factories; a 5-job
Case Studies section; founders footer) is a reasonable skeleton, but the founder finds the
execution "stupid and archaic," and an outside footwear-industry contact couldn't tell what the
product does. The only piece explicitly asked to survive is the **Case Studies** section
(concept, not the literal Framer execution).

Decisions already made with the user before this plan:
- **Stack:** Dioxus 0.7 (Rust/WASM), matching the existing app, despite the SEO/animation-library
  tradeoffs of a client-rendered SPA that were raised and accepted.
- **Repo layout:** confirmed via research (an Explore agent read the installed `dx` 0.7.9 CLI
  source and Dioxus's own multi-package docs) — a **separate sibling Cargo project**, not a Cargo
  workspace. The two apps share zero code, so a workspace only adds risk (documented `dx`
  workspace edge cases) for no benefit. `cd landing && dx serve` works exactly like the existing
  app does today, and the existing app's files are untouched.
- **Primary CTA:** "Request a Pilot" (a real on-page form) is the hero's primary action, matching
  the enterprise/pilot sales motion described in the backend's own `concerns.md`. "Open the App"
  is a secondary link (nav + footer) for existing users/investors/technical evaluators.
- **Case studies:** built from real, anonymized holdout data pulled from
  `color-brain-backend/reports/first_attempt_v1/recommendation_export.csv` — not invented numbers.
- **Problem-section stats:** user confirmed they have sourcing for the original Framer figures
  (4–6 attempts to approve a color, 50% first-try failure, $500–$2,000 per failed attempt), so
  those are kept as-is (I could not independently verify them in this repo — internal docs say
  "2 to 4 attempts" — so if that sourcing turns out to be soft, swap in the sourced "2 to 4
  attempts" figure and drop the fail-rate/cost numbers instead).

## Real proof points (source of truth for all copy)

From `color-brain-backend/src/color_brain/first_attempt/docs/nontechnical_report.md` — the
already-vetted, honest public-facing framing:

- Trained on **12,398** real production records; tested on **2,043** future-like holdout jobs it
  never trained on.
- Recommended on **414** of them (**20.3%** coverage) — and won (beat the technician's recorded
  first attempt) **86.7%** of the time it recommended.
- Median improvement of **+0.2082 CIEDE2000** over the technician's first attempt on recommended
  jobs.
- The model **abstains** (stays silent) on the other ~80% — this is a deliberate trust feature,
  not a shortfall, and the copy should preempt "only 20%?" by explaining why selectivity is the
  point.
- It never invents recipes — it retrieves a real historical recipe the factory already used, only
  within the same substrate, and only when confident.

Five real case-study rows selected from `recommendation_export.csv` (recommend + win == True,
`tier == high`, spanning the highest-volume substrates called out in `concerns.md`: PS, AN, PC,
EW, WC — no factory-identifying info, just substrate code + row id + target Lab + the two Delta E
numbers):

| Substrate | Row ID   | Target Lab (L, a, b)      | Technician ΔE | Color Brain ΔE | Improvement |
|-----------|----------|----------------------------|----------------|-----------------|-------------|
| PS        | 23294442 | 92.99, −0.03, 2.14         | 1.164          | 0.234           | 0.930       |
| AN        | 23286357 | 43.28, 5.42, −4.51         | 6.706          | 0.856           | 5.849       |
| PC        | 23307922 | 63.18, 5.79, 10.36         | 1.240          | 0.390           | 0.850       |
| EW        | 23381315 | 92.44, 3.37, −10.90        | 1.073          | 0.153           | 0.921       |
| WC        | 23331924 | 51.14, 11.70, −18.96       | 0.593          | 0.064           | 0.529       |

These become five swatch-comparison cards (target chip / technician-achieved chip / Color Brain
recipe chip, rendered with the same Lab→RGB math already in the app).

## Visual identity (new, for this page only)

Ground rule: keep the two fonts and the "neutral stage, real color is the only saturated thing"
philosophy from the app for brand continuity, but let the marketing page be more alive than the
app's flat instrument-panel look. The signature idea — **the Archive Wall**: the hero's ambient
background is a large field of small swatch chips built from real (anonymized) target Lab colors
from the dataset, mostly dimmed/desaturated, with one chip sharply in focus. On page load, a
single orchestrated CSS keyframe animation lets the dim chips drift/fade while the one true chip
locks into focus — visualizing "search thousands of records, surface the one match." This is
literal product substance used as decoration, not a generic gradient blob, and it reinforces the
brand's "we show real data" ethos.

Tokens (new file, distinct from but related to the app's `color_brain.css`):
- `--stage-0 #0F1114`, `--stage-1 #191C21` (deeper graphite than the app, more dramatic for a
  hero-driven page), `--line #2A2F37`
- `--ink #ECEEF2`, `--ink-dim #9AA2AE`
- `--signal #6EA8FE` (same instrument-blue accent as the app — the one thing that must feel
  identical between landing and app)
- `--tier-high #46C79A`, `--tier-abstain #8B94A1` (reused from the app's confidence-tier palette,
  for the proof/case-study sections — green = won, slate = calibrated silence, never red)
- Fonts: same as the app — Space Grotesk (display, used far bigger/bolder here than the app's
  restrained brand mark), IBM Plex Sans (body), IBM Plex Mono (data readouts *and* small
  instrument-style "eyebrow" labels above section headings — a structural device that reinforces
  "measured, not hyped")

Section-specific devices:
- **How It Works** genuinely is a 3-step sequence (Connect → Search → Recommend or Abstain), so
  numbering there is earned, not decorative.
- **Proof/Validation** numbers render as large mono "readout" digits, not generic gradient stat
  tiles.
- **Who It's For** (Brands / Suppliers / Factories) is not a sequence — no numbering; styled as
  three "specimen label" cards instead of generic feature tiles.
- Motion is CSS-only plus one small vanilla-JS file (no animation library): a ~15-line
  `IntersectionObserver` script (registered via `Dioxus.toml`'s `[web.resource] script`, the same
  mechanism the framework already exposes) toggles a `.is-visible` class per section for
  scroll-reveal; everything else is CSS transitions/keyframes. Respect
  `prefers-reduced-motion`.

## Repo structure

New sibling directory at repo root, independent of the existing app (no changes to existing
`Cargo.toml`, `src/`, `Dioxus.toml`, `assets/`):

```
color-brain-frontend/
  landing/                       # NEW — independent Dioxus 0.7 project
    Cargo.toml                   # own package, dioxus (web feature only, no gloo-net — no backend calls)
    Dioxus.toml                  # own [web.app] title; no [[web.proxy]] needed (fully static)
    assets/
      styling/landing.css        # new token file described above
      script/reveal.js           # small IntersectionObserver scroll-reveal script
      favicon.ico                # copy of the existing favicon for brand consistency
    src/
      main.rs                    # single route, App shell, font/stylesheet links
      lab_color.rs               # lab_to_rgb ported from ../src/components/result_panel.rs
                                  # (intentional duplication — the two apps are deliberately not
                                  # sharing a crate; it's ~30 lines of pure math)
      case_studies.rs            # the 5 real rows above as a static Rust array + the card component
      components/
        hero.rs, nav.rs, problem.rs, how_it_works.rs, proof.rs, case_studies_section.rs,
        who_its_for.rs, contact_form.rs, footer.rs
```

`dx serve` / `dx build` run from inside `landing/` exactly like the existing app does today —
confirmed by reading the installed `dx` 0.7.9 CLI source: it resolves `Dioxus.toml` by walking
up from the invoking crate's own directory, so co-locating two independent Cargo projects in one
git repo (no `[workspace]`) causes no cross-contamination.

## Contact form ("Request a Pilot")

A real on-page form (name, company, email, message) per the user's decision. This is a fully
static site (S3 + CloudFront, no backend) — the domain's email already runs through Google
Workspace (see `route53_email.tf`), and there is **no existing SES/Lambda setup** in
`color-brain-infra` to send mail from AWS.

Recommendation for v1: point the form's submit action at a hosted form-backend service (e.g.
Formspree) that forwards submissions straight to the existing @colorbrain.co inbox. Zero new AWS
infra, no SES sandbox-approval wait, live same-day. This is a one-line swap later (just change the
form's `action` URL) if you'd rather self-host via a small AWS Lambda + SES handler — that's a
clean follow-up project, not a blocker for launch. **Needs from you before I wire it up:** which
service/account to use (or confirm Formspree is fine) and which inbox should receive submissions.

## Deploy pipeline (separate, explicit step — touches shared infra)

1. New `.github/workflows/deploy-landing.yml` in this repo, mirroring the existing
   `deploy.yml` but: builds from `landing/` (`dx build --release --platform web` run with cwd
   `landing/`), syncs to a `LANDING_S3_BUCKET` / `LANDING_CLOUDFRONT_DISTRIBUTION_ID` pair of repo
   variables, and is path-filtered so app-only changes don't redeploy the landing page and
   vice versa.
2. **Terraform change in `color-brain-infra`** (sibling repo, shared state): the current
   `frontend_deploy` IAM role/policy (`iam.tf`) only grants S3 access to the **app** bucket
   (`aws_s3_bucket.app.arn`) — it has no permissions on `aws_s3_bucket.landing`. I'll extend that
   policy's `resources` to include the landing bucket ARN too (same role, same OIDC trust — just a
   broader S3 resource scope), then set the two new repo variables from the existing
   `landing_bucket_name` / `landing_distribution_id` Terraform outputs (already defined).
   **I will prepare this Terraform diff but will not run `terraform apply` without your explicit
   go-ahead** — it's shared cloud state outside this repo.

## Milestones (implement one, verify in a real browser via `dx serve`, pause for review — same
cadence as the app's M1–M5 history)

1. **L1 — Scaffold spike:** create `landing/` as a minimal independent Dioxus project, verify
   `cd landing && dx serve` renders a trivial page. De-risks the sibling-directory approach before
   investing in content.
2. **L2 — Shell:** design tokens (`landing.css`), nav, footer skeleton, font links.
3. **L3 — Hero:** headline/subhead copy fixing the "what does this even do" clarity problem, the
   Archive Wall signature visual + load-in convergence animation, primary ("Request a Pilot") and
   secondary ("Open the App" → `https://app.colorbrain.co`) CTAs.
4. **L4 — Problem / How It Works / Proof:** the three narrative sections, mono readout stat
   treatment for the validated numbers.
5. **L5 — Case Studies:** the 5 real job comparison cards.
6. **L6 — Who It's For + Contact form + final CTA + footer.**
7. **L7 — Polish:** responsive pass, scroll-reveal script, `prefers-reduced-motion`, OG/meta tags
   for link previews, `cargo fmt && cargo clippy && dx build` clean.
8. **L8 — Deploy pipeline** (the explicit, confirm-before-apply step above).

## Verification

- Per milestone: `cargo fmt`, `cargo clippy`, `dx build` (the wasm compile-check authority per
  this repo's established workflow) from inside `landing/`.
- Visual/interaction milestones (L2–L7): run `dx serve` and actually view it in a real browser —
  check the hero animation, scroll-reveal, responsive breakpoints, and reduced-motion behavior,
  not just that it compiles.
- Final: confirm the nav's "Open the App" link points at `https://app.colorbrain.co`, the case
  study numbers match the table above exactly, and the contact form actually delivers a test
  submission to the configured inbox before calling L6 done.
