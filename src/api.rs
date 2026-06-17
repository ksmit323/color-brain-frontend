//! Types and a small async client for the Color Brain `first_attempt` backend.
//!
//! The app reaches the backend through the dx dev proxy (see `Dioxus.toml`), so requests use
//! same-origin relative paths. Set [`BASE`] to an absolute URL (e.g. `http://127.0.0.1:8000`) to
//! call the backend directly and bypass the proxy.

use std::collections::HashMap;

use serde::{Deserialize, Serialize};

/// Base URL for backend requests. Empty means same-origin (forwarded to `http://127.0.0.1:8000`
/// by the dx dev proxy). Set to an absolute URL to bypass the proxy.
const BASE: &str = "";

/// `GET /health` response.
#[derive(Debug, Deserialize)]
pub struct Health {
    pub status: String,
}

/// `GET /first-attempt/metadata` response.
///
/// Only the fields the UI needs are modelled; serde ignores the rest (`feature_columns`,
/// `residual_model`, `calibration`, ...). The `Vec` fields default to empty so a response that
/// omits one degrades gracefully instead of failing to parse.
#[derive(Debug, Deserialize)]
pub struct Metadata {
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
/// legitimate zero such as `target_a = 0.0`.
#[derive(Debug, Deserialize)]
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
    let response = reqwest::get(format!("{BASE}/health"))
        .await
        .map_err(|e| e.to_string())?;
    let response = response.error_for_status().map_err(|e| e.to_string())?;
    response.json::<Health>().await.map_err(|e| e.to_string())
}

/// Fetch `GET /first-attempt/metadata`.
pub async fn get_metadata() -> Result<Metadata, String> {
    let response = reqwest::get(format!("{BASE}/first-attempt/metadata"))
        .await
        .map_err(|e| e.to_string())?;
    let response = response.error_for_status().map_err(|e| e.to_string())?;
    response.json::<Metadata>().await.map_err(|e| e.to_string())
}

/// Post a recommendation request to `POST /first-attempt/recommend`.
pub async fn post_recommendation(req: &RecommendRequest) -> Result<Recommendation, String> {
    let response = reqwest::Client::new()
        .post(format!("{BASE}/first-attempt/recommend"))
        .json(req)
        .send()
        .await
        .map_err(|e| e.to_string())?;
    let response = response.error_for_status().map_err(|e| e.to_string())?;
    response
        .json::<Recommendation>()
        .await
        .map_err(|e| e.to_string())
}
