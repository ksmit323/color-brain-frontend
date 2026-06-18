# Color Brain Frontend

A [Dioxus](https://dioxuslabs.com/) 0.7 web application that provides an operator-facing UI for the **Color Brain** first-attempt dye recipe recommendation system. Operators enter a target Lab color, substrate, dye program, and optional process variables; the app calls a local Python backend and displays the model's recommend/abstain decision with supporting evidence.

This repository is the frontend companion to the [Color Brain backend](https://github.com/ksmit323/color-brain-backend) (or the sibling `color-brain-backend` repo in a monorepo layout). It is intended for **local development and internal demos**, not production deployment.

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Prerequisites](#prerequisites)
- [Quick Start](#quick-start)
- [Development](#development)
- [Architecture](#architecture)
- [Backend API Integration](#backend-api-integration)
- [Configuration](#configuration)
- [Project Structure](#project-structure)
- [Development Guidelines](#development-guidelines)
- [Roadmap](#roadmap)
- [Related Repositories](#related-repositories)

## Overview

Color Brain helps textile coloration teams decide whether a factory's own historical dyeing records support a better first-attempt recipe than a technician's manual starting point. The backend is a confidence-gated nearest-history recommender: it retrieves same-substrate historical precedents, scores the probability that the retrieved recipe beats the technician's first attempt, and **recommends only when calibrated confidence is high enough**.

This frontend exposes that logic through a single-page workflow:

1. Load model metadata (known substrates, dye programs, recipe columns).
2. Collect target Lab values and program selection from the operator.
3. Submit a live recommendation request.
4. Display the backend response — recommendation, abstention, confidence tier, nearest historical evidence, and recipe quantities when applicable.

The UI is actively under development. Milestones M1 (API client) and M2 (minimal working page) are complete; polished components, styling, and edge-case handling are planned in M3–M5. See [IMPLEMENTATION_PLAN.md](./IMPLEMENTATION_PLAN.md) for the full milestone breakdown.

## Features

### Implemented

- **Metadata-driven form** — Substrate and dye program dropdowns are populated from `GET /first-attempt/metadata`; values are never hard-coded.
- **Target color input** — Required Lab fields (`L`, `a`, `b`) with client-side numeric validation on submit.
- **Optional process variables** — Yarn weight, water volume, liquor ratio, and cycle time; omitted from the request body when left blank.
- **Async recommendation flow** — Loading, error, and success states with non-blocking form submission via `spawn`.
- **Typed API client** — Serde-modeled request/response types in `src/api.rs` with graceful deserialization defaults.
- **Dev proxy** — `Dioxus.toml` forwards same-origin API paths to the local backend, avoiding CORS during `dx serve`.
- **Single-route app** — One `Home` page at `/`; starter blog/navbar demo removed.

### Planned (M3–M5)

- Dark operational theme with design tokens and responsive layout.
- Extracted components: status indicator, target form, result panel, evidence panel, recipe table.
- Distinct abstention UX, backend-unavailable banner, inline validation, and disabled submit states.
- Lab color swatch rendering and recipe table ordered by `recipe_columns` from metadata.

## Prerequisites

| Tool                                                                   | Version / Notes                                                                              |
| ---------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| [Rust](https://rustup.rs/)                                             | Edition 2021 (tested with rustc 1.95+)                                                       |
| [Dioxus CLI](https://dioxuslabs.com/learn/0.7/getting_started) (`dx`)  | 0.7.x — install via `curl -sSL https://dioxus.dev/install.sh \| sh`                          |
| [Color Brain backend](https://github.com/ksmit323/color-brain-backend) | Python 3.11 + [uv](https://docs.astral.sh/uv/)                                               |
| Prepared dataset                                                       | Required by the backend `serve-first-attempt` command (e.g. `datasets/prepared_dataset.csv`) |

Add the `wasm32-unknown-unknown` target if it is not already installed:

```bash
rustup target add wasm32-unknown-unknown
```

## Quick Start

### 1. Start the backend

From the Color Brain backend repository:

```bash
uv sync --extra dev
uv run color-brain serve-first-attempt datasets/prepared_dataset.csv \
  --host 127.0.0.1 \
  --port 8000
```

Confirm the API is reachable:

```bash
curl http://127.0.0.1:8000/health
curl http://127.0.0.1:8000/first-attempt/metadata
```

### 2. Start the frontend

From this repository:

```bash
dx serve
```

Open the URL printed by the dev server (typically `http://127.0.0.1:8080` or similar). The app loads metadata, populates the form dropdowns, and accepts recommendation submissions.

### End-to-end success criteria

- Metadata loads without error and fills substrate/dye program selects.
- Submitting a valid form returns a recommendation or a clean abstention response in the UI.

## Development

### Common commands

```bash
# Dev server with hot reload (requires backend on :8000)
dx serve

# Production WASM build
dx build

# Format and lint
cargo fmt
cargo clippy -- -D warnings

# Check compilation without serving
dx build
```

### Build targets

The project supports multiple Dioxus platform features via Cargo features:

| Feature         | Description                          |
| --------------- | ------------------------------------ |
| `web` (default) | Browser/WASM target via `dioxus/web` |
| `desktop`       | Native desktop via `dioxus/desktop`  |
| `mobile`        | Mobile via `dioxus/mobile`           |

Local development uses the default `web` feature.

### Async signal safety

`clippy.toml` forbids holding Dioxus signal borrows across `.await` points. The submit handler reads all form signals into owned values **before** awaiting the HTTP call, then writes results afterward. Follow this pattern for any new async code.

## Architecture

```text
┌─────────────────────────────────────────────────────────────┐
│  Browser (WASM)                                             │
│  ┌─────────────┐    ┌──────────────┐    ┌────────────────┐  │
│  │  Home view  │───▶│  api.rs      │───▶│  gloo-net      │  │
│  │  (form UI)  │    │  (types +    │    │  (fetch API)   │  │
│  │             │◀───│   client)    │◀───│                │  │
│  └─────────────┘    └──────────────┘    └───────┬────────┘  │
└─────────────────────────────────────────────────┼───────────┘
                                                  │ same-origin
                                                  │ /health, /first-attempt/*
                                                  ▼
┌─────────────────────────────────────────────────────────────┐
│  dx dev proxy (Dioxus.toml)                                 │
└─────────────────────────────────────────────────┬───────────┘
                                                  ▼
┌─────────────────────────────────────────────────────────────┐
│  Color Brain FastAPI backend (:8000)                        │
│  FirstAttemptLiveService — retrieval + confidence scoring   │
└─────────────────────────────────────────────────────────────┘
```

### Key modules

| Module              | Responsibility                                                                          |
| ------------------- | --------------------------------------------------------------------------------------- |
| `src/main.rs`       | App entry, asset links, `Route` enum, `Router` setup                                    |
| `src/api.rs`        | Serde types and async HTTP client (`get_health`, `get_metadata`, `post_recommendation`) |
| `src/views/home.rs` | First-attempt page: metadata resource, form state, submit handler, result display       |
| `src/components/`   | Shared UI components (placeholder; populated in M3)                                     |

### State management

- `use_resource` loads metadata once on mount.
- `use_signal` holds each form field as a `String` for free-form numeric entry; values are parsed and validated on submit.
- `SubmitState` tracks idle, loading, done, and error states for the recommendation request.

## Backend API Integration

The frontend communicates with three endpoints. During `dx serve`, requests use **same-origin relative paths**; the dev proxy forwards them to `http://127.0.0.1:8000`.

| Method | Path                       | Purpose                                                    |
| ------ | -------------------------- | ---------------------------------------------------------- |
| `GET`  | `/health`                  | Process health check (used by planned status indicator)    |
| `GET`  | `/first-attempt/metadata`  | Known substrates, dye programs, recipe columns, thresholds |
| `POST` | `/first-attempt/recommend` | Score one live target job                                  |

### Request shape (`POST /first-attempt/recommend`)

**Required fields:** `target_l`, `target_a`, `target_b`, `substrate`, `dye_prog`

**Optional fields:** `yarn_weight`, `water_volume`, `liquor_ratio`, `cycle_time`, `request_id`

Optional fields are omitted from the JSON body entirely when unset, matching the backend's documented contract.

### Response behavior

- `recommendation_action` is `"recommend"` or `"abstain"` — the primary branch for UI logic.
- On abstain, `recipe` is empty (`{}`) but nearest historical evidence fields may still be present.
- On recommend (high or medium tier), `recipe` contains dye name → quantity mappings.

### HTTP client choice

The app uses [`gloo-net`](https://docs.rs/gloo-net/) rather than `reqwest` because gloo-net issues requests through the browser `fetch` API, which accepts same-origin relative URLs. On WASM, `reqwest` rejects relative URLs at parse time. Set the `BASE` constant in `src/api.rs` to an absolute URL (e.g. `http://127.0.0.1:8000`) to bypass the dev proxy and call the backend directly.

## Configuration

### `Dioxus.toml`

```toml
[web.app]
title = "color-brain-frontend"

# Dev-only reverse proxy — forwards API paths to the local Python backend
[[web.proxy]]
backend = "http://127.0.0.1:8000/health"

[[web.proxy]]
backend = "http://127.0.0.1:8000/first-attempt"
```

Change the `backend` URLs if the API listens on a different host or port.

### `src/api.rs`

```rust
/// Empty = same-origin relative paths (proxied by dx serve).
/// Set to an absolute URL to bypass the proxy.
const BASE: &str = "";
```

## Project Structure

```text
color-brain-frontend/
├── AGENTS.md                 # Dioxus 0.7 patterns for AI-assisted development
├── CODING_RULES.md           # Engineering principles for this repo
├── IMPLEMENTATION_PLAN.md    # Milestone plan (M1–M5)
├── Cargo.toml                # Dependencies and platform features
├── Dioxus.toml               # App title, assets, dev proxy
├── clippy.toml               # Async/signal borrow lint rules
├── assets/
│   ├── favicon.ico
│   ├── header.svg
│   ├── tailwind.css          # Prebuilt Tailwind v4 utilities
│   └── styling/
│       ├── main.css          # Base dark theme (starter; to be replaced in M3)
│       ├── blog.css          # Legacy starter asset
│       └── navbar.css        # Legacy starter asset
└── src/
    ├── main.rs               # App root, routing, global stylesheets
    ├── api.rs                # Backend types and HTTP client
    ├── components/
    │   └── mod.rs            # Shared components (M3)
    └── views/
        ├── mod.rs
        └── home.rs           # First-attempt recommendation page
```

## Development Guidelines

- Follow [CODING_RULES.md](./CODING_RULES.md): minimum code, surgical changes, verifiable milestones.
- Use [AGENTS.md](./AGENTS.md) as the authoritative Dioxus 0.7 reference (`use_signal`, `use_resource`, `#[component]`, `Routable`).
- Read signal values into owned data before `.await`; never hold `.read()` or `.write()` borrows across await points.
- Model only the API fields the UI needs; rely on `#[serde(default)]` and `skip_serializing_if` for graceful degradation.
- Do not hard-code substrates or dye programs — always source them from metadata.

## Roadmap

| Milestone                 | Status   | Scope                                                        |
| ------------------------- | -------- | ------------------------------------------------------------ |
| M1 — API client + types   | Complete | `src/api.rs`, serde models, `cargo clippy` clean             |
| M2 — Minimal working page | Complete | Form, metadata dropdowns, raw result output, dev proxy       |
| M3 — Polished UI          | Planned  | Dark theme, extracted components, recipe table, color swatch |
| M4 — States & edge cases  | Planned  | Validation, abstention UX, backend-unavailable banner        |
| M5 — Final verification   | Planned  | Full workflow walkthrough, lint/build report                 |

See [IMPLEMENTATION_PLAN.md](./IMPLEMENTATION_PLAN.md) for detailed acceptance criteria per milestone.

## Related Repositories

| Repository                                                             | Role                                                              |
| ---------------------------------------------------------------------- | ----------------------------------------------------------------- |
| [color-brain-backend](https://github.com/ksmit323/color-brain-backend) | Offline validation toolkit, FastAPI server, `first_attempt` model |
| This repo                                                              | Dioxus web UI for live first-attempt recommendations              |

The backend README documents model validation results, API examples, and the `serve-first-attempt` command in full.

---

**Color Brain** is decision support for textile coloration — it recommends reusing proven historical recipes when evidence is strong, and abstains when it is not. This frontend makes that workflow accessible to operators in a browser.
