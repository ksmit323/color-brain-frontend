//! Nearest historical batch: the closest past dye job the recommendation leans on.

use dioxus::prelude::*;

use crate::api::Recommendation;

/// Show the nearest matching batch from dyeing history (row id, when it ran, its program/result,
/// and the CIEDE2000 distance to the target). When there is no same-substrate history the panel
/// says so plainly rather than rendering empty rows.
#[component]
pub fn EvidencePanel(rec: Recommendation) -> Element {
    let has_match = rec
        .nearest_row_id
        .as_deref()
        .is_some_and(|id| !id.is_empty());

    rsx! {
        section { class: "panel",
            h2 { class: "panel__title", "Source batch" }
            if has_match {
                p { class: "evidence__summary",
                    "This recommendation comes from batch "
                    strong { "{rec.nearest_row_id.clone().unwrap_or_default()}" }
                    ", the closest compatible job in production history."
                }
                dl { class: "evidence__dl",
                    dt { "Source batch" }
                    dd { "{rec.nearest_row_id.clone().unwrap_or_default()}" }
                    if let Some(at) = rec.nearest_dyed_at.as_ref().filter(|s| !s.is_empty()) {
                        dt { "Dyed" }
                        dd { "{at}" }
                    }
                    if let Some(s) = rec.nearest_substrate.as_ref().filter(|s| !s.is_empty()) {
                        dt { "Substrate" }
                        dd { "{s}" }
                    }
                    if let Some(p) = rec.nearest_dye_prog.as_ref().filter(|s| !s.is_empty()) {
                        dt { "Program" }
                        dd { "{p}" }
                    }
                    if let Some(cq) = rec.nearest_result_cq.as_ref().filter(|s| !s.is_empty()) {
                        dt { "Recorded result" }
                        dd { "{cq}" }
                    }
                    if let Some(de) = rec.nearest_delta_e {
                        dt { "Target distance" }
                        dd { class: "evidence__delta", "{de:.2} ΔE00" }
                    }
                    if let Some(n) = rec.same_substrate_history_count {
                        dt { "Substrate history" }
                        dd { "{n} batches" }
                    }
                }
                p { class: "evidence__help", "Lower ΔE means the historical color is closer to this target." }
            } else {
                p { class: "evidence__empty",
                    "No compatible source batch was found in this substrate's history "
                    "({rec.same_substrate_history_count.unwrap_or(0)} recorded batches)."
                }
            }
        }
    }
}
