//! The backtest headline: how often Color Brain's recommendation beat the technician's first
//! attempt across the model's holdout, and by how much. Shown above the replay list and on live
//! recommendations to frame the win probability with real track record.

use dioxus::prelude::*;

use crate::api::ComparisonStats;

/// Render the aggregate "beats the technician" stat. Renders nothing when the model made no
/// recommendations (no win rate to report).
#[component]
pub fn TrackRecord(stats: ComparisonStats) -> Element {
    let (Some(win_rate), Some(median)) = (stats.win_rate, stats.median_improvement) else {
        return rsx! {};
    };

    rsx! {
        p { class: "track-record",
            "Across "
            b { class: "track-record__stat", "{stats.recommended_count}" }
            " past recommendations, Color Brain beat the technician's first attempt "
            b { class: "track-record__stat", "{win_rate * 100.0:.1}%" }
            " of the time — median "
            b { class: "track-record__stat", "{median:.2} ΔE" }
            " closer to target."
        }
    }
}
