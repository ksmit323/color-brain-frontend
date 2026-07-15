# Color Brain App

Operator-facing UI for **Color Brain** first-attempt dye recipe recommendations, served at [app.colorbrain.co](https://app.colorbrain.co).

A [Dioxus](https://dioxuslabs.com/) 0.7 single-page app compiled to WebAssembly. Operators enter a target job; the UI calls the backend and surfaces a recommend or abstain decision with confidence, historical evidence, and recipe quantities when the model clears its calibrated gate.

This package is independent of [`../landing`](../landing) (public marketing site). Shared conventions: [../CODING_RULES.md](../CODING_RULES.md). Dioxus 0.7 API reference: [../AGENTS.md](../AGENTS.md). Monorepo deploy overview: [../README.md](../README.md).

---

## Prerequisites

| Tool | Notes |
| --- | --- |
| [Rust](https://rustup.rs/) | Edition 2021 |
| `wasm32-unknown-unknown` | `rustup target add wasm32-unknown-unknown` |
| [Dioxus CLI](https://dioxuslabs.com/learn/0.7/getting_started) (`dx`) | 0.7.x — `curl -sSL https://dioxus.dev/install.sh \| sh` |
| [color-brain-backend](https://github.com/ksmit323/color-brain-backend) | Local FastAPI process for development |
| Prepared dataset | Required by the backend `serve-first-attempt` command |

---

## Quick start

### 1. Start the backend

From the backend repository (example):

```bash
uv sync --extra dev
uv run color-brain serve-first-attempt datasets/prepared_dataset.csv \
  --host 127.0.0.1 \
  --port 8000
```

Smoke-check:

```bash
curl http://127.0.0.1:8000/health
curl http://127.0.0.1:8000/first-attempt/metadata
```

### 2. Start the app

```bash
cd app
dx serve
```

Open the URL printed by the dev server (typically `http://127.0.0.1:8080`). Metadata should populate the form; a valid submit returns a recommend or abstain result.

| Command | Purpose |
| --- | --- |
| `dx serve` | Dev server with hot reload |
| `dx build --release --platform web` | Production WASM build |
| `cargo fmt` | Format |
| `cargo clippy -- -D warnings` | Lint |
| `cargo test` | Unit tests (e.g. dye-program sort in `api.rs`) |

Default Cargo feature is `web` (browser/WASM). `desktop` and `mobile` features exist in `Cargo.toml` but are not used for production deploys.

---

## What the app does

Color Brain is a confidence-gated nearest-history recommender: it retrieves same-substrate historical precedents and recommends a proven recipe only when calibrated confidence is high enough. This UI is the operator workflow for that decision.

1. Load model metadata (substrates, dye programs, recipe columns, backtest stats).
2. Collect target Lab color, substrate, dye program, and optional process variables.
3. Submit a live recommendation request.
4. Show recommend vs abstain, confidence, nearest-batch evidence, and recipe when applicable.

Optional historical replay (technician vs Color Brain on holdout jobs) is implemented in the client; the picker is currently gated off for demos via `SHOW_REPLAY_PANEL` in `src/views/home.rs` until the product wants it live.

---

## Architecture

```text
Browser (WASM)
  Home view  ──►  api.rs (types + client)  ──►  gloo-net (fetch)
       ▲                                              │
       └──────────────────────────────────────────────┘
                    same-origin relative paths
                    /health, /first-attempt/*
                              │
              ┌───────────────┴────────────────┐
              │  local: dx proxy (Dioxus.toml) │
              │  prod:  CloudFront → App Runner│
              └───────────────┬────────────────┘
                              ▼
                    Color Brain FastAPI backend
```

| Module | Responsibility |
| --- | --- |
| `src/main.rs` | Launch, document assets, single `/` route |
| `src/api.rs` | Serde models and async HTTP client |
| `src/views/home.rs` | Page orchestration: resources, form, submit/replay state |
| `src/components/*` | Form, results, evidence, recipe, status, comparison, history |
| `assets/styling/color_brain.css` | Design tokens and component styles |

### Components

| Component | Role |
| --- | --- |
| `StatusIndicator` | Backend reachability pill |
| `TargetForm` | Job ticket: Lab, substrate, program, optional process vars |
| `ResultPanel` | Recommend/abstain verdict, confidence meter, Lab swatch |
| `EvidencePanel` | Nearest historical batch (ΔE, program, result) |
| `RecipeTable` | Dye amounts in metadata column order (zeros omitted) |
| `TrackRecord` | Holdout headline (win rate / median improvement) |
| `HistoryPicker` / `ComparisonPanel` | Replay list and head-to-head (when enabled) |

### State

- `use_resource` loads health, metadata, and (if enabled) history on mount.
- Form fields are `String` signals for free-form entry; values are parsed and validated on submit.
- `SubmitState` / `ReplayState` track idle, loading, done, validation, and error paths.
- `ActiveView` chooses which result column is shown when both live and replay are used.

### Async and signals

`clippy.toml` forbids holding Dioxus signal borrows across `.await`. Read signals into owned values **before** the HTTP call; write results **after**. New async handlers must follow the same pattern.

---

## Backend integration

HTTP uses [`gloo-net`](https://docs.rs/gloo-net/) so relative URLs work on WASM via browser `fetch`. On WASM, `reqwest` rejects relative URLs at parse time.

```rust
// src/api.rs — empty = same-origin (proxied locally / CloudFront in prod)
const BASE: &str = "";
```

Set `BASE` to an absolute URL (e.g. `http://127.0.0.1:8000`) only when intentionally bypassing the proxy.

### Dev proxy

`Dioxus.toml` (dev only):

```toml
[[web.proxy]]
backend = "http://127.0.0.1:8000/health"

[[web.proxy]]
backend = "http://127.0.0.1:8000/first-attempt"
```

### Endpoints

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/health` | Connection indicator |
| `GET` | `/first-attempt/metadata` | Substrates, dye programs, recipe columns, comparison stats |
| `POST` | `/first-attempt/recommend` | Score one live target job |
| `GET` | `/first-attempt/history` | Past jobs available to replay |
| `GET` | `/first-attempt/replay/{row_id}` | Full technician vs Color Brain detail |

**Recommend body — required:** `target_l`, `target_a`, `target_b`, `substrate`, `dye_prog`  
**Optional** (omitted from JSON when unset): `yarn_weight`, `water_volume`, `liquor_ratio`, `cycle_time`, `request_id`

Client validation on submit:

- Lab: L\* ∈ [0, 100], a\*/b\* ∈ [−128, 127]
- Substrate and dye program required
- Optional process fields, if present, must be numbers &gt; 0

UI branch key: `recommendation_action` is `"recommend"` or `"abstain"`. On abstain, `recipe` is empty but nearest-history fields may still be present. Only model the response fields the UI needs; serde defaults tolerate missing optional fields.

Substrates and dye programs are **never hard-coded** — always from metadata. Dye programs are sorted chronologically for dropdowns (`sort_dye_programs_chronologically` in `api.rs`).

---

## Production deploy

Workflow: [../.github/workflows/deploy.yml](../.github/workflows/deploy.yml)

- Triggers on `main` when `app/**` (or the workflow file) changes, or via `workflow_dispatch`.
- Installs Rust + WASM target, caches Cargo/`app/target`, installs `dioxus-cli` 0.7.9, runs `dx build --release --platform web`.
- Syncs `target/dx/.../release/web/public` to the app S3 bucket and invalidates CloudFront.

GitHub **repository variables** (from `color-brain-infra` Terraform outputs):

| Variable | Purpose |
| --- | --- |
| `AWS_DEPLOY_ROLE_ARN` | OIDC deploy role |
| `S3_BUCKET` | App static bucket |
| `CLOUDFRONT_DISTRIBUTION_ID` | App distribution |

In production, CloudFront on `app.colorbrain.co` serves the static WASM app from S3 and forwards `/health` and `/first-attempt/*` to App Runner. The browser keeps same-origin relative paths — no CORS configuration in this package.

Infra for buckets, distribution, API routing, and IAM is managed in **`color-brain-infra`**, not here.

---

## Conventions

- Follow [../CODING_RULES.md](../CODING_RULES.md): minimum code, surgical diffs, verifiable goals.
- Use [../AGENTS.md](../AGENTS.md) for Dioxus 0.7 (`use_signal`, `use_resource`, `#[component]`; no legacy `cx` / `Scope` / `use_state`).
- Prefer graceful degradation over hard failures when the API omits optional fields.
- Historical milestone notes: [IMPLEMENTATION_PLAN.md](./IMPLEMENTATION_PLAN.md) — treat the codebase as source of truth when they disagree.

---

## Related

| Link | Role |
| --- | --- |
| [../README.md](../README.md) | Repo overview (app + landing) |
| [../landing](../landing) | Public marketing site |
| [color-brain-backend](https://github.com/ksmit323/color-brain-backend) | FastAPI service and model validation |
| `color-brain-infra` | S3, CloudFront, App Runner routing, deploy IAM |
