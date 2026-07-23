# Color Brain Landing

Public marketing site for **Color Brain**, served at [colorbrain.co](https://colorbrain.co).

Static single-page site built with [Astro](https://astro.build/) 7. Optional Three.js / GSAP enhance the hero “dye-history brain”; the page stays fully readable without them.

This package is independent of [`../app`](../app) (the operator WASM UI). Shared repo conventions: [../CODING_RULES.md](../CODING_RULES.md). High-level monorepo deploy overview: [../README.md](../README.md).

---

## Prerequisites

| Tool | Notes |
| --- | --- |
| [Node.js](https://nodejs.org/) | 24.x recommended (matches CI) |
| npm | Lockfile committed (`package-lock.json`) |

No backend is required to run the landing site.

---

## Quick start

```bash
cd landing
npm ci
npm run dev
```

| Command | Purpose |
| --- | --- |
| `npm run dev` | Dev server with HMR |
| `npm run build` | `astro check` + production build → `dist/` |
| `npm run preview` | Serve the production build locally |

Site URL for absolute links / sitemap-style metadata is set in `astro.config.mjs` (`site: "https://colorbrain.co"`).

---

## What the page is

One long scroll composed in `src/pages/index.astro`:

| Section | Role |
| --- | --- |
| Nav | Sticky chrome; CTAs to contact and the app |
| Hero + How it works | Share a sticky visual stage (constellation / poster) |
| Problem | Cost of guessing / rework framing |
| Proof | Holdout metrics (precision, coverage, abstention) |
| Case studies | Five validated jobs with Lab target plates |
| Who it’s for | Brands / suppliers / factories |
| Contact | Pilot request form (Formspree) |
| Footer | Site links and founders |

---

## Architecture

### Page and styles

- **Sections** live as Astro components under `src/components/`.
- **Global design system** is `src/styles/global.css` (tokens, reset, buttons, reveal helpers). Component-scoped CSS stays next to each `.astro` file.
- **Design rule:** monochrome chrome. Saturated color is real production dye data (brain nodes, case-study plates), not a brand accent palette. Semantic status colors (`--win`, `--fail`, `--abstain`) match the app.

### Scroll stage and brain

Hero and how-it-works sit over a sticky visual layer (`StageLayer.astro`):

1. **Poster** — build-time CSS color burst from `src/data/palette.ts` (always available).
2. **WebGL brain** — `src/lib/brain/` (Three.js). Booted only after the page checks WebGL2 and `prefers-reduced-motion`. Fades in over the poster when the first frame is ready (`.is-live`).

| Mode | When | Behavior |
| --- | --- | --- |
| `full` | Fine pointer, wider viewports | Scroll-scrubbed camera flight through the state space, aligned to how-it-works beats: query enters at its Lab point, a retrieval wave spreads through substrate-compatible clusters only, the matched recipe flares as confidence clears the gate, then the network stills (abstention). The stage frame dissolves to full-bleed during the dive. |
| `ambient` | Coarse pointer or narrow viewport | Lighter drifting constellation |

Brain code is **dynamically imported** so reduced-motion / no-WebGL visitors never download Three.js. Nodes use CIELAB coordinates and real Lab→sRGB colors from palette + case-study anchors (`src/lib/brain/data.ts`, `src/lib/lab.ts`). The query is the AN case study's real target Lab and the match node sits at Color Brain's real recommended Lab, so the query↔match gap on screen is the actual ΔE 0.856.

### Motion

`src/lib/motion.ts` handles reveal-on-scroll, hero word-split, and smooth anchor scrolling. Reveal styles apply only when `html.has-js` is set (inline script in `index.astro`), so no-JS visitors see content immediately. Reduced motion skips tweens.

### Case studies

- Data: `src/data/caseStudies.ts` (curated holdout jobs).
- Lab geometry / swatches: `src/lib/lab.ts` (aligned with the app’s Lab→sRGB conversion).
- Tab browser + plate animation: `src/lib/caseBrowser.ts` (DOM is source of truth).

### Contact

Plain HTML `POST` to Formspree — no client JS. Endpoint is configured in `src/components/Contact.astro`.

### Fonts

| Face | Source | Why |
| --- | --- | --- |
| Clash Display, Satoshi | Fontshare CDN | EULA forbids committing files to a public repo |
| IBM Plex Mono | `public/fonts/` (OFL) | Self-hosted |

Metric-tuned fallbacks in `global.css` limit layout shift when webfonts swap in.

### Static assets

`public/` is copied as-is to the site root (`favicon.ico`, `cb_logo.svg`, fonts). Hashed JS/CSS land under `dist/_astro/` at build time.

---

## Editing content safely

- **Copy / sections** — edit the relevant `src/components/*.astro` or `index.astro` head metadata.
- **Proof numbers / case studies** — update data modules and component copy together so metrics stay consistent.
- **Palette / brain anchors** — `src/data/palette.ts` and case-study Lab targets feed the constellation; regenerating the visual is deterministic from that data.
- **Contact endpoint** — `FORM_ACTION` in `Contact.astro`.

Prefer progressive enhancement: keep the poster and HTML useful without the brain or GSAP.

---

## Production deploy

Workflow: [../.github/workflows/deploy-landing.yml](../.github/workflows/deploy-landing.yml)

- Triggers on `main` when `landing/**` (or the workflow file) changes, or via `workflow_dispatch`.
- Node 24 → `npm ci` → `npm run build` → sync `dist/` to S3 → CloudFront invalidation.
- Two-pass S3 sync: HTML/public assets (short cache) and `_astro/` (immutable long cache). Avoid a separate `s3 cp --metadata-directive REPLACE` that only sets `Cache-Control` — that drops `Content-Type` and browsers refuse CSS/JS (`binary/octet-stream`).

GitHub **repository variables** (from `color-brain-infra` Terraform outputs):

| Variable | Purpose |
| --- | --- |
| `AWS_DEPLOY_ROLE_ARN` | OIDC deploy role |
| `LANDING_S3_BUCKET` | Landing bucket |
| `LANDING_CLOUDFRONT_DISTRIBUTION_ID` | Landing distribution |

Infra for the bucket, distribution, and DNS is managed in **`color-brain-infra`**, not this package.

---

## Related

| Link | Role |
| --- | --- |
| [../README.md](../README.md) | Repo overview (landing + app) |
| [../app](../app) | Operator recommendation UI |
| `color-brain-infra` | S3 / CloudFront / IAM / DNS |
| [color-brain-backend](https://github.com/ksmit323/color-brain-backend) | Model API and validation reports (source of proof metrics) |
