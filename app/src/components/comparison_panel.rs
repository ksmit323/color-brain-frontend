//! The head-to-head: the technician's first-attempt color error against Color Brain's, who landed
//! closer to target, and by how much. Lower ΔE is better (closer to the target color).

use dioxus::prelude::*;

use crate::api::ReplayDetail;

/// Render the technician-vs-Color-Brain comparison for one replayed job. When Color Brain had no
/// comparable history it abstained and there is nothing to put head-to-head, so the panel says so
/// rather than inventing a number.
#[component]
pub fn ComparisonPanel(detail: ReplayDetail) -> Element {
    let (Some(technician), Some(color_brain)) =
        (detail.technician_delta_e, detail.color_brain_delta_e)
    else {
        return rsx! {
            section { class: "panel",
                h2 { class: "panel__title", "Technician vs Color Brain" }
                p { class: "evidence__empty",
                    "Color Brain abstained — no comparable history for this substrate, so there is "
                    "nothing to compare here."
                }
            }
        };
    };

    // Improvement is technician ΔE − Color Brain ΔE, so a positive value means Color Brain landed
    // closer to target. Fall back to computing it if the backend did not send it.
    let improvement = detail.improvement.unwrap_or(technician - color_brain);
    let win = detail.win.unwrap_or(improvement > 0.0);
    let (badge_mod, verdict) = if win {
        ("win", "Color Brain wins")
    } else {
        ("loss", "Technician wins")
    };
    let magnitude = improvement.abs();
    let closer = if win { "Color Brain" } else { "Technician" };

    rsx! {
        section { class: "panel",
            h2 { class: "panel__title", "Technician vs Color Brain" }
            div { class: "versus",
                div { class: "versus__side versus__side--technician",
                    span { class: "versus__label", "Technician" }
                    span { class: "versus__delta", "{technician:.2}" }
                    span { class: "versus__unit", "ΔE first attempt" }
                }
                div { class: "versus__side versus__side--brain",
                    span { class: "versus__label", "Color Brain" }
                    span { class: "versus__delta", "{color_brain:.2}" }
                    span { class: "versus__unit", "ΔE predicted" }
                }
            }
            div { class: "verdict-row",
                span { class: "win-badge win-badge--{badge_mod}", "{verdict}" }
                span { class: "improvement improvement--{badge_mod}",
                    "{closer} landed {magnitude:.2} ΔE closer to target"
                }
            }
        }
    }
}
