//! Types and a small async client for the Color Brain `first_attempt` backend.
//!
//! Requests use same-origin relative paths (`/health`, `/first-attempt/...`). gloo-net sends them
//! through the browser fetch API, which resolves relative URLs against the document origin; the dx
//! dev proxy (see `Dioxus.toml`) then forwards them to the backend at `http://127.0.0.1:8000`. Set
//! [`BASE`] to an absolute URL to call the backend directly and bypass the proxy.

use std::collections::HashMap;

use gloo_net::http::Request;
use serde::{Deserialize, Serialize};

/// Base URL for backend requests. Empty means same-origin relative paths (forwarded to
/// `http://127.0.0.1:8000` by the dx dev proxy). Set to an absolute URL to bypass the proxy.
const BASE: &str = "";

/// `GET /health` response. Drives the connection indicator in the app bar.
#[derive(Debug, Clone, Deserialize)]
pub struct Health {
    // Deserialized for completeness; the indicator only cares whether the request succeeded.
    #[allow(dead_code)]
    #[serde(default)]
    pub status: String,
}

/// `GET /first-attempt/metadata` response.
///
/// Only the fields the UI needs are modelled; serde ignores the rest (`feature_columns`,
/// `residual_model`, `calibration`, ...). Every modelled field defaults on absence so a response
/// that omits one degrades gracefully instead of failing to parse.
#[allow(dead_code)] // required/optional_input_fields are reserved for M4 input validation
#[derive(Debug, Clone, Deserialize)]
pub struct Metadata {
    #[serde(default)]
    pub status: String,
    /// Total rows of dyeing history the model trained on. Optional because not every deployment
    /// reports it.
    #[serde(default)]
    pub history_rows: Option<u64>,
    #[serde(default)]
    pub known_substrates: Vec<String>,
    #[serde(default)]
    pub known_dye_programs: Vec<String>,
    /// Ordered recipe dye columns; used to render the recipe table in a stable column order.
    #[serde(default)]
    pub recipe_columns: Vec<String>,
    #[serde(default)]
    pub required_input_fields: Vec<String>,
    #[serde(default)]
    pub optional_input_fields: Vec<String>,
}

/// `POST /first-attempt/recommend` request body.
///
/// `target_l`/`target_a`/`target_b`, `substrate` and `dye_prog` are required. The process
/// variables and `request_id` are optional and are omitted from the body entirely when unset, so
/// the backend sees the same shape as its documented example.
#[derive(Debug, Serialize)]
pub struct RecommendRequest {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub request_id: Option<String>,
    pub target_l: f64,
    pub target_a: f64,
    pub target_b: f64,
    pub substrate: String,
    pub dye_prog: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub yarn_weight: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub water_volume: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub liquor_ratio: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub cycle_time: Option<f64>,
}

/// `POST /first-attempt/recommend` response.
///
/// `recommendation_action` is `"recommend"` or `"abstain"` and is the one field the UI branches
/// on, so it is required. Every other field is optional: the backend may omit or null fields
/// (notably when it abstains), and for numeric values `Option` keeps "absent" distinct from a
/// legitimate zero such as `target_a = 0.0`. (Fields are rendered in the result panel in M3.)
#[allow(dead_code)]
#[derive(Debug, Clone, PartialEq, Deserialize)]
pub struct Recommendation {
    pub recommendation_action: String,
    #[serde(default)]
    pub abstention_reason: String,
    pub tier: Option<String>,
    pub confidence_label: Option<String>,
    pub confidence_score: Option<f64>,
    pub p_win: Option<f64>,
    pub target_l: Option<f64>,
    pub target_a: Option<f64>,
    pub target_b: Option<f64>,
    pub substrate: Option<String>,
    pub dye_prog: Option<String>,
    pub nearest_row_id: Option<String>,
    pub nearest_dyed_at: Option<String>,
    pub nearest_substrate: Option<String>,
    pub nearest_dye_prog: Option<String>,
    pub nearest_result_cq: Option<String>,
    pub nearest_delta_e: Option<f64>,
    pub same_substrate_history_count: Option<u64>,
    pub effective_t_high: Option<f64>,
    pub effective_t_med: Option<f64>,
    /// Dye name -> amount. Empty (`{}`) when the backend abstains.
    #[serde(default)]
    pub recipe: HashMap<String, f64>,
}

/// Fetch `GET /health`.
pub async fn get_health() -> Result<Health, String> {
    let resp = Request::get(&format!("{BASE}/health"))
        .send()
        .await
        .map_err(|e| e.to_string())?;
    if !resp.ok() {
        return Err(format!("HTTP {}", resp.status()));
    }
    resp.json::<Health>().await.map_err(|e| e.to_string())
}

/// Fetch `GET /first-attempt/metadata`.
pub async fn get_metadata() -> Result<Metadata, String> {
    let resp = Request::get(&format!("{BASE}/first-attempt/metadata"))
        .send()
        .await
        .map_err(|e| e.to_string())?;
    if !resp.ok() {
        return Err(format!("HTTP {}", resp.status()));
    }
    resp.json::<Metadata>().await.map_err(|e| e.to_string())
}

/// Post a recommendation request to `POST /first-attempt/recommend`.
pub async fn post_recommendation(req: &RecommendRequest) -> Result<Recommendation, String> {
    let request = Request::post(&format!("{BASE}/first-attempt/recommend"))
        .json(req)
        .map_err(|e| e.to_string())?;
    let resp = request.send().await.map_err(|e| e.to_string())?;
    if !resp.ok() {
        return Err(format!("HTTP {}", resp.status()));
    }
    resp.json::<Recommendation>()
        .await
        .map_err(|e| e.to_string())
}
