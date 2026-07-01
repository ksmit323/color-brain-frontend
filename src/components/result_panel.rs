//! The verdict header: target Lab sample chip, recommend/abstain outcome, and a confidence meter
//! marked with the calibrated decision gates.

use dioxus::prelude::*;

use crate::api::Recommendation;

/// Convert a CIELAB color (D65 illuminant) to an 8-bit sRGB triple for the on-screen swatch.
/// Out-of-gamut results are clamped per channel, which is acceptable for an indicative swatch.
fn lab_to_rgb(l: f64, a: f64, b: f64) -> (u8, u8, u8) {
    // Lab -> XYZ.
    let fy = (l + 16.0) / 116.0;
    let fx = fy + a / 500.0;
    let fz = fy - b / 200.0;
    let eps = 216.0 / 24389.0;
    let kappa = 24389.0 / 27.0;
    let inv = |t: f64| {
        if t.powi(3) > eps {
            t.powi(3)
        } else {
            (116.0 * t - 16.0) / kappa
        }
    };
    let xr = inv(fx);
    let yr = if l > kappa * eps {
        fy.powi(3)
    } else {
        l / kappa
    };
    let zr = inv(fz);
    // D65 reference white.
    let (x, y, z) = (xr * 0.95047, yr, zr * 1.08883);
    // XYZ -> linear sRGB.
    let rl = 3.2406 * x - 1.5372 * y - 0.4986 * z;
    let gl = -0.9689 * x + 1.8758 * y + 0.0415 * z;
    let bl = 0.0557 * x - 0.2040 * y + 1.0570 * z;
    // Linear -> gamma-encoded sRGB.
    let enc = |c: f64| {
        let c = c.clamp(0.0, 1.0);
        let v = if c <= 0.0031308 {
            12.92 * c
        } else {
            1.055 * c.powf(1.0 / 2.4) - 0.055
        };
        (v * 255.0).round() as u8
    };
    (enc(rl), enc(gl), enc(bl))
}

/// Map an abstention reason code to an operator-facing sentence.
fn humanize_reason(reason: &str) -> &str {
    match reason {
        "no_same_substrate_history" => "There is no dyeing history for this substrate yet.",
        "p_win_below_calibrated_threshold" => {
            "Predicted win probability fell below the calibrated gate for this job."
        }
        "" => "The model declined to recommend a recipe for this job.",
        other => other,
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

    let action_txt = if recommend { "Recommend" } else { "Abstain" };
    let tier_label = if recommend {
        format!("{tier} confidence")
    } else {
        "abstained".to_string()
    };

    rsx! {
        section { class: "verdict verdict--{tier_mod}",
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
                    span { class: "verdict__action", "{action_txt}" }
                    span { class: "tier-chip tier-chip--{tier_mod}", "{tier_label}" }
                }
                div { class: "readout",
                    span { class: "readout__value", "{score_txt}" }
                    span { class: "readout__label", "win probability" }
                }
            }

            div { class: "meter",
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
                        span { b { "t_med " } "{t:.2}" }
                    }
                    if let Some(t) = rec.effective_t_high {
                        span { b { "t_high " } "{t:.2}" }
                    }
                }
            }

            if !recommend {
                p { class: "abstain-note",
                    "{humanize_reason(&rec.abstention_reason)}"
                    if !rec.abstention_reason.is_empty() {
                        " "
                        span { class: "abstain-note__reason", "({rec.abstention_reason})" }
                    }
                }
            }
        }
    }
}
