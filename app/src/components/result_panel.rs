//! The verdict header: target Lab sample chip, recommend/abstain outcome, and a confidence meter
//! marked with the calibrated decision gates.

use dioxus::prelude::*;

use crate::api::Recommendation;
use crate::components::lab_to_rgb;

/// Map an abstention reason code to an operator-facing sentence.
fn humanize_reason(reason: &str) -> &str {
    match reason {
        "no_same_substrate_history" => {
            "Color Brain could not find compatible history for this substrate."
        }
        "p_win_below_calibrated_threshold" => {
            "The historical evidence did not clear the confidence required for a recommendation."
        }
        "" => "There was not enough evidence to recommend a proven recipe for this job.",
        _ => "There was not enough evidence to recommend a proven recipe for this job.",
    }
}

/// Render the outcome header for a recommendation: the target sample chip, the recommend/abstain
/// verdict with its tier, the confidence readout, and a meter showing where the win probability
/// falls relative to the calibrated `t_med` / `t_high` gates.
#[component]
pub fn ResultPanel(rec: Recommendation) -> Element {
    let recommend = rec.recommendation_action == "recommend";
    let tier = rec.tier.as_deref().unwrap_or("abstain");
    let tier_mod = match tier {
        "high" => "high",
        "medium" => "med",
        _ => "abstain",
    };

    let (l, a, b) = (
        rec.target_l.unwrap_or(0.0),
        rec.target_a.unwrap_or(0.0),
        rec.target_b.unwrap_or(0.0),
    );
    let (r, g, bl) = lab_to_rgb(l, a, b);

    // The meter compares the win probability against the gates; confidence_score equals p_win when
    // present. Fall back between them so the fill still renders if one is null.
    let prob = rec
        .p_win
        .or(rec.confidence_score)
        .unwrap_or(0.0)
        .clamp(0.0, 1.0);
    let score = rec.confidence_score.or(rec.p_win);
    let score_txt = score
        .map(|s| format!("{:.0}%", s * 100.0))
        .unwrap_or_else(|| "—".to_string());

    let action_txt = if recommend {
        "Recommended recipe found"
    } else {
        "No confident recipe found"
    };
    let tier_label = match tier {
        "high" => "High confidence",
        "medium" => "Medium confidence",
        _ => "Recommendation withheld",
    };
    let substrate = rec.substrate.as_deref().unwrap_or("Substrate not reported");
    let program = rec.dye_prog.as_deref().unwrap_or("Program not reported");

    rsx! {
        section { class: "verdict verdict--{tier_mod}", aria_live: "polite",
            div { class: "verdict__head",
                div { class: "chip",
                    div {
                        class: "chip__sample",
                        background_color: "rgb({r},{g},{bl})",
                    }
                    div { class: "chip__read",
                        span { b { "L " } "{l:.1}" }
                        span { b { "a " } "{a:.1}" }
                        span { b { "b " } "{b:.1}" }
                    }
                }
                div { class: "verdict__summary",
                    h2 {
                        id: "result-heading",
                        class: "verdict__action",
                        tabindex: "-1",
                        "{action_txt}"
                    }
                    span { class: "tier-chip tier-chip--{tier_mod}", "{tier_label}" }
                    p { class: "verdict__context", "{substrate} · Program {program}" }
                }
                div { class: "readout",
                    span { class: "readout__value", "{score_txt}" }
                    span { class: "readout__label", "chance to beat a typical first attempt" }
                }
            }

            div { class: "meter",
                div { class: "meter__label",
                    span { "Estimated recommendation advantage" }
                    span { "{score_txt}" }
                }
                div { class: "meter__track",
                    div {
                        class: "meter__fill meter__fill--{tier_mod}",
                        width: "{prob * 100.0}%",
                    }
                    if let Some(t) = rec.effective_t_med {
                        div { class: "meter__tick", left: "{t * 100.0}%" }
                    }
                    if let Some(t) = rec.effective_t_high {
                        div { class: "meter__tick", left: "{t * 100.0}%" }
                    }
                }
                div { class: "meter__legend",
                    if let Some(t) = rec.effective_t_med {
                        span { b { "Recommendation gate " } "{t * 100.0:.0}%" }
                    }
                    if let Some(t) = rec.effective_t_high {
                        span { b { "High-confidence gate " } "{t * 100.0:.0}%" }
                    }
                }
            }

            if recommend {
                p { class: "verdict__guidance",
                    "Review the historical recipe below before applying it to production."
                }
            } else {
                p { class: "abstain-note",
                    strong { "Continue with the standard lab-matching process." }
                    span { "{humanize_reason(&rec.abstention_reason)}" }
                }
            }
        }
    }
}
