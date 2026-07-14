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

/// Aggregate backtest headline: how Color Brain did against the technician across the whole
/// holdout. `win_rate`/`median_improvement` are `None` when the model made no recommendations.
#[derive(Debug, Clone, PartialEq, Deserialize)]
pub struct ComparisonStats {
    #[serde(default)]
    pub recommended_count: u64,
    pub win_rate: Option<f64>,
    pub median_improvement: Option<f64>,
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
    /// Backtest headline used by the replay-proof and live "vs technician" views.
    #[serde(default)]
    pub comparison_stats: Option<ComparisonStats>,
}

impl Metadata {
    /// Dye program codes in chronological order for dropdowns (`1`, `2`, `11` — not `1`, `11`, `2`).
    pub fn dye_programs_chronological(&self) -> Vec<String> {
        sort_dye_programs_chronologically(self.known_dye_programs.clone())
    }
}

/// Sort dye program codes in ascending chronological/id order for UI dropdowns.
///
/// Pure numeric codes sort numerically. Alphanumeric codes like `P1` sort by prefix then number.
pub fn sort_dye_programs_chronologically(mut programs: Vec<String>) -> Vec<String> {
    programs.sort_by_key(|program| dye_program_sort_key(program));
    programs
}

#[derive(Debug, Clone, PartialEq, Eq, PartialOrd, Ord)]
struct DyeProgramSortKey {
    prefix: String,
    number: u64,
    raw: String,
}

fn dye_program_sort_key(s: &str) -> DyeProgramSortKey {
    let raw = s.trim().to_string();
    if let Ok(number) = raw.parse::<u64>() {
        return DyeProgramSortKey {
            prefix: String::new(),
            number,
            raw,
        };
    }

    let mut prefix = String::new();
    let mut digits = String::new();
    let mut in_digits = false;
    for c in raw.chars() {
        if c.is_ascii_digit() {
            in_digits = true;
            digits.push(c);
        } else if !in_digits {
            prefix.push(c);
        }
    }

    DyeProgramSortKey {
        prefix: prefix.to_ascii_lowercase(),
        number: digits.parse().unwrap_or(u64::MAX),
        raw,
    }
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

/// One past dye job in the replay list. It pairs the technician's first-attempt color error with
/// Color Brain's recommendation outcome, as scored offline on the model's holdout window.
///
/// The comparison fields are `Option` because a job with no comparable same-substrate history has
/// no Color Brain result to compare against (the backend abstains). `recommendation_action` is the
/// field the UI branches on, so it is required.
#[derive(Debug, Clone, PartialEq, Deserialize)]
pub struct ReplayJob {
    pub row_id: String,
    #[serde(default)]
    pub substrate: String,
    #[serde(default)]
    pub dye_prog: String,
    pub technician_delta_e: Option<f64>,
    pub color_brain_delta_e: Option<f64>,
    pub improvement: Option<f64>,
    pub win: Option<bool>,
    pub recommendation_action: String,
}

/// `GET /first-attempt/history` response.
#[derive(Debug, Clone, PartialEq, Deserialize)]
pub struct HistoryResponse {
    #[serde(default)]
    pub jobs: Vec<ReplayJob>,
}

/// `GET /first-attempt/replay/{row_id}` response: the full head-to-head for one past job. It is a
/// deliberate superset of [`Recommendation`] (see [`From<ReplayDetail>`]) so the existing verdict
/// and evidence panels can be reused for the confidence meter and nearest-batch view.
#[allow(dead_code)]
#[derive(Debug, Clone, PartialEq, Deserialize)]
pub struct ReplayDetail {
    pub row_id: String,
    pub technician_delta_e: Option<f64>,
    pub color_brain_delta_e: Option<f64>,
    pub improvement: Option<f64>,
    pub win: Option<bool>,
    pub p_win: Option<f64>,
    pub tier: Option<String>,
    pub confidence_label: Option<String>,
    pub recommendation_action: String,
    #[serde(default)]
    pub abstention_reason: String,
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
    #[serde(default)]
    pub recipe: HashMap<String, f64>,
}

/// Adapt a replay detail into a [`Recommendation`] so [`ResultPanel`](crate::components::ResultPanel)
/// and [`EvidencePanel`](crate::components::EvidencePanel) can render the confidence meter and
/// nearest-batch evidence without duplicating them. `color_brain_delta_e` is the same quantity as
/// `nearest_delta_e`. Fields absent from the offline export (`same_substrate_history_count`, the
/// calibration gates) are left `None`, which those panels already tolerate.
impl From<ReplayDetail> for Recommendation {
    fn from(detail: ReplayDetail) -> Self {
        Recommendation {
            recommendation_action: detail.recommendation_action,
            abstention_reason: detail.abstention_reason,
            tier: detail.tier,
            confidence_label: detail.confidence_label,
            confidence_score: detail.p_win,
            p_win: detail.p_win,
            target_l: detail.target_l,
            target_a: detail.target_a,
            target_b: detail.target_b,
            substrate: detail.substrate,
            dye_prog: detail.dye_prog,
            nearest_row_id: detail.nearest_row_id,
            nearest_dyed_at: detail.nearest_dyed_at,
            nearest_substrate: detail.nearest_substrate,
            nearest_dye_prog: detail.nearest_dye_prog,
            nearest_result_cq: detail.nearest_result_cq,
            nearest_delta_e: detail.color_brain_delta_e,
            same_substrate_history_count: None,
            effective_t_high: None,
            effective_t_med: None,
            recipe: detail.recipe,
        }
    }
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

/// Fetch `GET /first-attempt/history` — the past jobs available to replay.
pub async fn get_history() -> Result<HistoryResponse, String> {
    let resp = Request::get(&format!("{BASE}/first-attempt/history"))
        .send()
        .await
        .map_err(|e| e.to_string())?;
    if !resp.ok() {
        return Err(format!("HTTP {}", resp.status()));
    }
    resp.json::<HistoryResponse>()
        .await
        .map_err(|e| e.to_string())
}

/// Fetch `GET /first-attempt/replay/{row_id}` — the full technician-vs-Color-Brain comparison for
/// one past job. `row_id` is used as a path segment; batch ids in this dataset are plain tokens.
pub async fn get_replay(row_id: &str) -> Result<ReplayDetail, String> {
    let resp = Request::get(&format!("{BASE}/first-attempt/replay/{row_id}"))
        .send()
        .await
        .map_err(|e| e.to_string())?;
    if !resp.ok() {
        return Err(format!("HTTP {}", resp.status()));
    }
    resp.json::<ReplayDetail>().await.map_err(|e| e.to_string())
}

#[cfg(test)]
mod tests {
    use super::sort_dye_programs_chronologically;

    #[test]
    fn dye_programs_sort_numeric_codes_chronologically() {
        let sorted = sort_dye_programs_chronologically(vec![
            "11".into(),
            "2".into(),
            "60".into(),
            "1".into(),
        ]);
        assert_eq!(sorted, vec!["1", "2", "11", "60"]);
    }

    #[test]
    fn dye_programs_sort_alphanumeric_codes_by_prefix_then_number() {
        let sorted =
            sort_dye_programs_chronologically(vec!["P11".into(), "P2".into(), "P1".into()]);
        assert_eq!(sorted, vec!["P1", "P2", "P11"]);
    }
}
