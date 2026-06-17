# Frontend Agent Prompt

We are building the Color Brain frontend in a new Rust/Dioxus repo.

Important context:

- This is a Dioxus app, not React/Svelte/etc.
- Dioxus is newer, so do not guess APIs from memory if the repo has examples or docs available.
- The repo currently contains Dioxus starter blog code. Use it to understand the project structure, routing, assets, styling conventions, and Dioxus version. Do not blindly keep the blog UI.
- Before coding, read `CODING_RULES.md` and follow it strictly: simple code, minimal abstractions, surgical changes, no speculative features, and concrete verification.
- Work incrementally in milestones. Do not try to build the whole frontend at once.

## Backend API

The Python backend should be running locally at:

```text
http://127.0.0.1:8000
```

Available endpoints:

```text
GET /health
GET /first-attempt/metadata
POST /first-attempt/recommend
```

`GET /health` returns:

```json
{ "status": "ok" }
```

`GET /first-attempt/metadata` returns fields like:

```json
{
  "status": "ready",
  "history_rows": 10211,
  "known_substrates": ["AN", "PC", "PS"],
  "known_dye_programs": ["P1", "P2"],
  "recipe_columns": ["Dianix Red(D001)", "Dianix Blue(D002)"],
  "feature_columns": [],
  "required_input_fields": ["target_l", "target_a", "target_b", "substrate", "dye_prog"],
  "optional_input_fields": ["yarn_weight", "water_volume", "liquor_ratio", "cycle_time", "request_id", "requested_at"],
  "residual_model": {},
  "calibration": {}
}
```

`POST /first-attempt/recommend` accepts:

```json
{
  "request_id": "demo-1",
  "target_l": 50.0,
  "target_a": 0.0,
  "target_b": 0.0,
  "substrate": "AN",
  "dye_prog": "P1",
  "yarn_weight": 1.0,
  "water_volume": 10.0,
  "liquor_ratio": 10.0,
  "cycle_time": 100.0
}
```

Required fields:

- `target_l`
- `target_a`
- `target_b`
- `substrate`
- `dye_prog`

Optional fields:

- `request_id`
- `requested_at`
- `yarn_weight`
- `water_volume`
- `liquor_ratio`
- `cycle_time`

Response shape:

```json
{
  "request_id": "demo-1",
  "recommendation_action": "recommend",
  "abstention_reason": "",
  "tier": "high",
  "confidence_label": "high",
  "confidence_score": 0.95,
  "p_win": 0.95,
  "target_l": 50.0,
  "target_a": 0.0,
  "target_b": 0.0,
  "substrate": "AN",
  "dye_prog": "P1",
  "nearest_row_id": "row-123",
  "nearest_dyed_at": "2025-01-01 00:00:00",
  "nearest_substrate": "AN",
  "nearest_dye_prog": "P1",
  "nearest_result_cq": "Pass",
  "nearest_delta_e": 0.42,
  "same_substrate_history_count": 1000,
  "effective_t_high": 0.75,
  "effective_t_med": null,
  "recipe": {
    "Dianix Red(D001)": 1.0,
    "Dianix Blue(D002)": 0.0
  }
}
```

If the backend abstains, `recommendation_action` will be `"abstain"` and `recipe` will be `{}`. Abstention is normal product behavior, not an error.

## Product Goal

Build a slick, beautiful, modern, intuitive single-page frontend for the `first_attempt` model. This is an internal demo UI for entering a target dye job and receiving a recommendation from the backend.

## Design Direction

- Build the actual tool as the first screen, not a marketing landing page.
- The UI should feel like a serious industry software tool: clean, premium, precise, and operational.
- Keep the workflow simple:
  1. show backend/model status;
  2. load metadata;
  3. enter target Lab values;
  4. choose substrate and dye program from metadata;
  5. optionally enter process variables;
  6. submit;
  7. show recommendation, confidence, nearest historical evidence, and recipe table.
- Make abstention look intentional and understandable.
- Do not overbuild dashboards, auth, accounts, charts, uploads, or multi-page workflows yet.
- Keep CSS and component structure clean and minimal.

## Milestones

### M0 - Repo Survey Only

- Read `CODING_RULES.md`.
- Inspect `Cargo.toml`, Dioxus version, starter blog structure, existing components, assets, and styling.
- Identify how the app is launched and tested.
- Do not implement yet.
- Report the smallest implementation plan.

### M1 - API Client Types

- Add minimal Rust types for metadata request/response and recommendation request/response.
- Add a small API client module with:
  - `get_health`
  - `get_metadata`
  - `post_recommendation`
- Use the repo's existing HTTP/client conventions if present.
- If no convention exists, choose the simplest Dioxus-compatible approach.
- Verify with build/check.

### M2 - Basic Functional Page

- Replace or bypass the starter blog UI with one working Color Brain page.
- Load metadata on page load.
- Render form fields for required inputs.
- Use dropdowns for substrate and dye program from metadata.
- Submit to `/first-attempt/recommend`.
- Render raw but readable recommendation result.
- Verify the full request/response loop.

### M3 - Polished UI

- Make the page visually impressive but still simple.
- Add:
  - backend status indicator;
  - model/history summary from metadata;
  - target Lab form;
  - optional process-variable section;
  - recommendation result panel;
  - confidence/tier display;
  - nearest historical match evidence;
  - recipe table.
- Ensure responsive layout.
- Avoid clutter and unnecessary explanatory text.

### M4 - States And Edge Cases

- Add loading states.
- Add backend unavailable state.
- Add validation for missing/invalid required inputs.
- Add clear abstention state.
- Add empty metadata/error state.
- Keep error handling practical, not excessive.

### M5 - Final Verification

- Run the repo's formatting/check/test commands.
- Start the app and manually verify it can call the backend.
- Provide exact commands run and any remaining limitations.

## Implementation Constraints

- Keep code minimal.
- Prefer a few clear components over many tiny abstractions.
- Do not introduce global state libraries unless already used by the starter.
- Do not add routing unless the existing Dioxus starter requires it.
- Do not implement auth.
- Do not implement dataset upload.
- Do not mock the backend unless needed temporarily for M1; real API integration is required by M2.
- Do not hard-code substrates or dye programs; load them from metadata.
- Keep the backend base URL configurable if the repo already has an env/config pattern. Otherwise default to `http://127.0.0.1:8000` in one obvious place.

Start with M0 only. Read the repo and report the implementation plan before editing files.
