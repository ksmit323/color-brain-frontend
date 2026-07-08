# Color Brain Frontend — Implementation Plan

## Context

We are building the **Color Brain** frontend: an internal demo UI for the `first_attempt`
dye-recipe recommendation model. An operator enters a target Lab color + substrate + dye
program (plus optional process variables), submits to a local Python backend, and sees the
recommendation, confidence, nearest historical evidence, and recipe.

The repo is a fresh **Dioxus 0.7 web app** still carrying the starter _blog_ template. The
goal of this work is to replace that demo UI with one clean, premium, single-page tool that
talks to the real backend at `http://127.0.0.1:8000`. We work in milestones (M1–M5) and
**pause after each one** for review.

This plan follows `CODING_RULES.md`: minimum code, no speculative features, surgical changes,
match existing style, and verify each step concretely.

## Repo facts established in M0 (survey complete)

- **Dioxus 0.7.1** (`Cargo.lock` resolves 0.7.9), `features = ["router"]`, default target `web`.
- Build/run: **`dx serve`** (dev, hot reload), `dx build` (compile). Lint/format: `cargo clippy`,
  `cargo fmt`. No Makefile/justfile, no CI, no tests in the starter.
- **No HTTP client is a direct dependency yet**, but `reqwest 0.12`, `gloo-net`, `web-sys`,
  `serde`, `serde_json`, `tokio` are already resolved transitively in `Cargo.lock`.
- Starter is pure static: **no async, no signals, no fetch.** API patterns confirmed against the
  repo's own `AGENTS.md` (the authoritative 0.7 reference) — `use_signal`, `use_resource`,
  `asset!` + `document::Stylesheet`, `#[component]`, `Routable` enum.
- Asset pattern: `const X: Asset = asset!("/assets/...")` then `document::Link`/`Stylesheet`.
- `clippy.toml` forbids holding `GenerationalRef`/`WriteLock` (signal borrows) across `.await`.
  **Guardrail for our async code:** read signals into owned values _before_ awaiting; write
  results _after_ the await completes. Never hold `.read()`/`.write()` across `.await`.
- Existing files to be replaced: `src/views/home.rs`, `src/views/blog.rs`, `src/views/navbar.rs`,
  `src/components/hero.rs`, `assets/styling/{main,blog,navbar}.css`. `assets/tailwind.css` is a
  prebuilt v4 dump and is **not** used via utility classes — we will keep custom CSS, not Tailwind.

## Confirmed decisions

- **Theme:** my call → **refined dark operational theme** (suits Lab/color work; swatches read
  well on dark). Define CSS design tokens (`:root` custom properties): layered backgrounds, one
  precise accent, monospace for numeric values, and semantic colors for confidence tiers
  (high/med/low/abstain). Lean on the `frontend-design` skill at M3.
- **Backend access:** **dx dev proxy** (no CORS). Add to `Dioxus.toml`:
  ```toml
  [[web.proxy]]
  backend = "http://127.0.0.1:8000/health"
  [[web.proxy]]
  backend = "http://127.0.0.1:8000/first-attempt"
  ```
  The app calls **relative** paths (`/health`, `/first-attempt/metadata`,
  `/first-attempt/recommend`); `dx serve` forwards them to `:8000`. The real backend address
  lives in this one obvious place. Path-prefix matching to be confirmed live at M2.
- **Routing:** the starter already has a `Routable` router — keep it, but reduce to a single
  `Home {}` route. Remove the `#[layout(Navbar)]` and the `Blog` route (blog demo is what we
  replace). No new routing is added.
- **HTTP client:** **`gloo-net`** (`default-features = false, features = ["http","json"]`) — uses
  the browser fetch API, so it accepts the same-origin relative paths the dx proxy design depends
  on. (reqwest was tried first but rejects relative URLs at parse time on wasm — a runtime failure
  `dx build` doesn't catch; switched during M2.)
- **Cadence:** implement + verify one milestone, report, then wait for go-ahead.

## Milestones

### M1 — API client + types _(pause after)_

- `Cargo.toml`: add `gloo-net = { version = "0.6", default-features = false, features = ["http","json"] }`,
  `serde = { version = "1", features = ["derive"] }`. (serde_json comes via gloo-net's json.)
- New `src/api.rs` (single module; types + client together to stay minimal):
  - Types deserialize **only the fields we use** (serde ignores the rest, so `residual_model`,
    `calibration`, `feature_columns` need no modelling). Use `Option<T>` for nullable fields
    (e.g. `effective_t_med`). Model `recipe` as `HashMap<String, f64>`; preserve display order
    later via metadata's `recipe_columns`.
    - `Metadata { status, known_substrates: Vec<String>, known_dye_programs: Vec<String>,
recipe_columns: Vec<String>, history_rows, required/optional_input_fields, ... }`
    - `RecommendRequest` (serde `Serialize`; `request_id`, required Lab/substrate/dye_prog,
      optional process vars as `Option<f64>`).
    - `Recommendation` (response: `recommendation_action`, `abstention_reason`, `tier`,
      `confidence_label`, `confidence_score`, `p_win`, nearest\_\* evidence fields, `recipe`, ...).
  - Three async fns returning `Result<T, String>` (simple error type, no custom error enum):
    `get_health() -> Result<Health, String>`, `get_metadata() -> Result<Metadata, String>`,
    `post_recommendation(req) -> Result<Recommendation, String>`. Base path is relative `""`
    in one `const`.
- `src/main.rs`: add `mod api;`.
- **Verify:** `cargo fmt`, `cargo clippy`, `dx build` (authoritative compile/type check). No UI yet.

### M2 — Minimal working page _(pause after)_

- `Dioxus.toml`: add the two `[[web.proxy]]` entries above.
- `src/main.rs`: Route enum → single `Home {}` (drop `Blog` + `#[layout]`). Remove dead asset
  consts for deleted CSS.
- Delete `src/views/blog.rs`, `src/views/navbar.rs`, `src/components/hero.rs`; update
  `src/views/mod.rs`, `src/components/mod.rs`.
- Rewrite `src/views/home.rs` as the Color Brain page (all logic inline for now):
  - `use_resource` loads `/first-attempt/metadata` on mount.
  - `use_signal` per form field (target_l/a/b as strings, substrate, dye_prog, optional vars).
  - Substrate + dye-program `<select>` populated from metadata (**never hard-coded**).
  - Submit handler: read signals into owned values, build `RecommendRequest`, `spawn` the
    `post_recommendation` await, write the result into a signal afterward (respect the
    no-borrow-across-await rule).
  - Render the `Recommendation` as raw-but-readable text (no styling yet).
- **Verify:** start backend, `dx serve`, confirm metadata populates the dropdowns and a submit
  returns a recommendation end-to-end (the real M2 success criterion).

### M3 — Polished UI _(pause after)_

- New `assets/styling/color_brain.css` with `:root` design tokens (dark theme above). Replace the
  starter CSS links in `main.rs`; drop unused `main/blog/navbar.css` and the Tailwind link if not
  used.
- Extract a few clear components under `src/components/` (not many tiny ones): `StatusIndicator`
  (health/model state), `TargetForm` (Lab + substrate/dye + collapsible optional process vars),
  `ResultPanel` (action/tier/confidence), `EvidencePanel` (nearest\_\* history), `RecipeTable`
  (iterate `recipe_columns` for stable column order; show a Lab color swatch from target L/a/b).
- Add a model/history summary line from metadata (`history_rows`, counts). Responsive layout
  (CSS grid/flex). Make **abstention** a deliberate, calm panel — not an error.
- **Verify:** `dx serve`, visual pass at desktop + narrow widths; `cargo fmt` + `cargo clippy`.

### M4 — States & edge cases _(pause after)_

- Loading states (metadata loading; submitting spinner/disabled button).
- Backend-unavailable state (health/metadata fetch fails → clear banner, retry).
- Required-input validation (target_l/a/b present & numeric, substrate + dye_prog chosen) before
  enabling submit; inline messages.
- Distinct **abstention** state (`recommendation_action == "abstain"`: show `abstention_reason`,
  hide empty recipe, keep evidence).
- Empty/error metadata state. Keep handling practical, not exhaustive.
- **Verify:** exercise each state (stop backend; submit invalid; force an abstaining target).

### M5 — Final verification _(report)_

- Run `cargo fmt`, `cargo clippy`, `cargo test` (none expected), `dx build`.
- `dx serve` against the live backend; manually walk the full workflow.
- Report exact commands run and any remaining limitations.

## Critical files

- Create: `src/api.rs`, `assets/styling/color_brain.css`, M3 components in `src/components/`.
- Modify: `Cargo.toml`, `Dioxus.toml`, `src/main.rs`, `src/views/home.rs`, `src/views/mod.rs`,
  `src/components/mod.rs`.
- Delete: `src/views/blog.rs`, `src/views/navbar.rs`, `src/components/hero.rs`, unused starter CSS.

## Risks / notes

- **Proxy path matching** (M2): if `[[web.proxy]]` prefix forwarding doesn't behave as expected,
  fall back to direct `http://127.0.0.1:8000` calls + backend CORS, or refine proxy entries.
- **reqwest on wasm** (M1): if default features break the wasm build, switch to
  `default-features = false, features = ["json"]` or `gloo-net`.
- **Backend must be running** for M2/M5 end-to-end verification.
- **Unrelated:** `glm_claude_config.json` (untracked) contains a hardcoded API token — should be
  gitignored / not committed. Flagged only; not touched by this work.

## Verification strategy (per milestone)

`cargo fmt && cargo clippy` for style/lint, `dx build` for compile/type check, and `dx serve` with
the live backend for the request/response loop and visual checks. End-to-end success = metadata
populates the dropdowns and a submit returns a recommendation (or a clean abstention) in the UI.
