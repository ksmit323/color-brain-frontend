# Color Brain Frontend

Browser frontends for **Color Brain** — decision support for textile coloration. The system retrieves a factory’s own historical dye recipes and recommends one only when calibrated confidence is high enough; otherwise it abstains.

This repository holds two independent packages (no shared runtime, no Cargo/npm workspace):

| Package | Stack | Purpose | Production |
| --- | --- | --- | --- |
| [`landing/`](./landing) | [Astro](https://astro.build/) 7, TypeScript, Three.js, GSAP | Public marketing site | [colorbrain.co](https://colorbrain.co) |
| [`app/`](./app) | [Dioxus](https://dioxuslabs.com/) 0.7 (Rust → WASM) | Operator UI for live first-attempt recommendations | [app.colorbrain.co](https://app.colorbrain.co) |

Infrastructure (S3, CloudFront, IAM, DNS) lives in the sibling **`color-brain-infra`** Terraform repo. The API lives in **`color-brain-backend`**.

---

## Prerequisites

Shared:

- Git
- Access to the backend (local or deployed) when working on the app

Landing only:

| Tool | Notes |
| --- | --- |
| [Node.js](https://nodejs.org/) | 24.x recommended (matches CI) |
| npm | Comes with Node; lockfile is committed |

App only:

| Tool | Notes |
| --- | --- |
| [Rust](https://rustup.rs/) | Edition 2021 |
| `wasm32-unknown-unknown` | `rustup target add wasm32-unknown-unknown` |
| [Dioxus CLI](https://dioxuslabs.com/learn/0.7/getting_started) (`dx`) | 0.7.x — `curl -sSL https://dioxus.dev/install.sh \| sh` |
| Backend | [color-brain-backend](https://github.com/ksmit323/color-brain-backend) with a prepared dataset |

---

## Landing site (`landing/`)

Static single-page marketing site. Sections include hero, how-it-works (scroll-driven “brain” narrative), problem, proof metrics, case studies, audience cards, pilot contact form, and footer.

**Package docs:** [`landing/README.md`](./landing/README.md) (dev, architecture, content, deploy).

### Design notes

- Near-black UI chrome; saturated color comes from real production dye data (constellation + case-study plates), not decorative accents.
- Display/body fonts (Clash Display, Satoshi) load from Fontshare CDN (EULA forbids vendoring in a public repo). IBM Plex Mono is self-hosted under `landing/public/fonts/`.
- Contact form is a plain HTML POST to Formspree (`landing/src/components/Contact.astro`).

### Local development

```bash
cd landing
npm ci
npm run dev
```

| Command | Purpose |
| --- | --- |
| `npm run dev` | Astro dev server |
| `npm run build` | Typecheck (`astro check`) + production build → `landing/dist/` |
| `npm run preview` | Serve the production build locally |

### Architecture (landing)

- **Page assembly** — `src/pages/index.astro` composes section components.
- **Scroll stage** — Hero + how-it-works share a sticky visual layer (`StageLayer.astro`): a CSS color-burst poster always present; a WebGL dye-history constellation fades in when available.
- **Brain** — `src/lib/brain/` (Three.js). Loaded lazily after WebGL2 + reduced-motion checks so no-JS / reduced-motion visitors keep the poster only. Desktop uses scroll-scrubbed “full” mode; coarse pointers / narrow viewports use lighter “ambient” mode.
- **Motion** — `src/lib/motion.ts` (reveal-on-scroll, headline word-split). Reveal CSS only applies when `html.has-js` is set so no-JS users still see content.
- **Case studies** — Curated holdout jobs in `src/data/caseStudies.ts`; Lab→sRGB and plate geometry in `src/lib/lab.ts`; tab UI in `src/lib/caseBrowser.ts`.

### Production deploy (landing)

Workflow: [`.github/workflows/deploy-landing.yml`](./.github/workflows/deploy-landing.yml)

- Triggers on pushes to `main` that touch `landing/**` (or manual `workflow_dispatch`).
- Builds with Node 24 → `npm ci` → `npm run build`.
- Syncs `dist/` to the landing S3 bucket (two-pass: HTML/public assets vs hashed `_astro/` with long cache). **Do not** re-upload with `s3 cp --metadata-directive REPLACE` alone — that strips `Content-Type` and browsers refuse CSS/JS.
- Invalidates the landing CloudFront distribution.

Required GitHub **repository variables** (values from Terraform outputs in `color-brain-infra`):

| Variable | Purpose |
| --- | --- |
| `AWS_DEPLOY_ROLE_ARN` | OIDC role for frontend deploys |
| `LANDING_S3_BUCKET` | Landing bucket name |
| `LANDING_CLOUDFRONT_DISTRIBUTION_ID` | Landing distribution ID |

---

## Operator app (`app/`)

Dioxus 0.7 single-page WASM app. Operators enter a target Lab color, substrate, dye program, and optional process variables; the UI calls the backend and shows recommend vs abstain, confidence, nearest historical evidence, recipe quantities, and (when available) historical replay comparisons.

**Package docs:** [`app/README.md`](./app/README.md) (dev, architecture, API, deploy).

### Features

- Metadata-driven substrate / dye-program selects (`GET /first-attempt/metadata` — never hard-coded).
- Live recommendation submit with loading, validation, error, recommend, and abstain states.
- Result UI: status indicator, form, result panel, evidence, recipe table, track-record / comparison panels, history/replay hooks.
- Same-origin relative API paths in production and in local dev (see proxy below).
- Custom dark operational theme (`assets/styling/color_brain.css`).

### Local development

Start the backend (from the backend repo), then the app:

```bash
# Backend (example)
uv run color-brain serve-first-attempt datasets/prepared_dataset.csv \
  --host 127.0.0.1 --port 8000

# App
cd app
dx serve
```

Open the URL printed by `dx` (typically `http://127.0.0.1:8080`).

| Command | Purpose |
| --- | --- |
| `dx serve` | Dev server + hot reload |
| `dx build --release --platform web` | Production WASM build |
| `cargo fmt` / `cargo clippy -- -D warnings` | Format / lint |
| `cargo test` | Unit tests (e.g. dye-program sort in `api.rs`) |

### Dev proxy and API base URL

During `dx serve`, `Dioxus.toml` proxies same-origin paths to the local FastAPI process:

- `/health` → `http://127.0.0.1:8000/health`
- `/first-attempt` → `http://127.0.0.1:8000/first-attempt`

The client uses **relative** URLs via [`gloo-net`](https://docs.rs/gloo-net/) (browser `fetch`). On WASM, `reqwest` rejects relative URLs at parse time.

```rust
// app/src/api.rs
const BASE: &str = ""; // same-origin; set an absolute URL to bypass the proxy
```

In production, CloudFront on `app.colorbrain.co` serves the static WASM app from S3 and forwards `/health` and `/first-attempt/*` to App Runner, so the same relative paths work without CORS.

### Backend endpoints used

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/health` | Connection indicator |
| `GET` | `/first-attempt/metadata` | Substrates, dye programs, recipe columns, backtest stats |
| `POST` | `/first-attempt/recommend` | Score one live target job |
| `GET` | `/first-attempt/history` | Past jobs available to replay |
| `GET` | `/first-attempt/replay/{row_id}` | Technician vs Color Brain detail for one job |

**Recommend body (required):** `target_l`, `target_a`, `target_b`, `substrate`, `dye_prog`  
**Optional:** process variables and `request_id` — omitted from JSON when unset.

UI branching key: `recommendation_action` is `"recommend"` or `"abstain"`.

### App layout (code)

| Area | Role |
| --- | --- |
| `src/main.rs` | Launch, assets, single `/` route |
| `src/api.rs` | Serde models + HTTP client |
| `src/views/home.rs` | Page orchestration, submit/replay state |
| `src/components/*` | Form, results, evidence, recipe, status, history, etc. |
| `assets/styling/color_brain.css` | Design tokens and component styles |

### Async / signal rule

`clippy.toml` forbids holding Dioxus signal borrows across `.await`. Read form signals into owned values **before** the HTTP call; write results **after**. Follow this for any new async handlers.

### Production deploy (app)

Workflow: [`.github/workflows/deploy.yml`](./.github/workflows/deploy.yml)

- Triggers on pushes to `main` that touch `app/**` (or manual `workflow_dispatch`).
- Installs Rust + `wasm32-unknown-unknown`, caches Cargo/`app/target`, installs `dioxus-cli` 0.7.9, runs `dx build --release --platform web`.
- Syncs the resolved `target/dx/.../release/web/public` directory to the app S3 bucket and invalidates CloudFront.

Required GitHub **repository variables**:

| Variable | Purpose |
| --- | --- |
| `AWS_DEPLOY_ROLE_ARN` | OIDC role for frontend deploys |
| `S3_BUCKET` | App bucket name |
| `CLOUDFRONT_DISTRIBUTION_ID` | App distribution ID |

---

## Deployment overview

```text
Push to main
  ├─ landing/**  →  Deploy landing  →  S3 landing + CloudFront  →  colorbrain.co
  └─ app/**      →  Deploy app      →  S3 app + CloudFront     →  app.colorbrain.co
                                                              └─ /health, /first-attempt/*
                                                                   → App Runner (backend)
```

Both workflows use AWS OIDC (`id-token: write`); there are no long-lived AWS keys in GitHub secrets for these deploys. Infra changes (buckets, distributions, role trust, DNS) are applied via **`color-brain-infra`**, not this repo.

---

## Engineering conventions

- **[CODING_RULES.md](./CODING_RULES.md)** — simplicity, surgical diffs, verifiable goals.
- **[AGENTS.md](./AGENTS.md)** — authoritative Dioxus 0.7 reference for the app (`use_signal`, `use_resource`, `#[component]`, no legacy `cx` / `Scope` / `use_state`).
- Prefer minimum code that solves the current problem; avoid speculative abstraction.
- Landing: keep motion progressive (poster first, WebGL optional). App: source domain options from metadata only.

Historical milestone notes for the app live in [`app/IMPLEMENTATION_PLAN.md`](./app/IMPLEMENTATION_PLAN.md); treat the codebase as source of truth when the plan and code disagree.

---

## Related repositories

| Repository | Role |
| --- | --- |
| [color-brain-backend](https://github.com/ksmit323/color-brain-backend) | FastAPI service, `first_attempt` model, offline validation |
| `color-brain-infra` | AWS Terraform (S3, CloudFront, App Runner, Route53, deploy IAM) |
| This repo | Marketing site + operator WASM app |

---

**Color Brain** recommends proven historical recipes when the evidence is strong, and stays silent when it is not.
