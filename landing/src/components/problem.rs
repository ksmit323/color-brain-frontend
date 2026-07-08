//! The problem section: industry pain stats that set up why Color Brain exists.

use dioxus::prelude::*;

/// One mono readout tile in the problem or proof grids.
#[component]
fn Readout(value: String, label: String) -> Element {
    rsx! {
        div { class: "readout",
            span { class: "readout__value", "{value}" }
            span { class: "readout__label", "{label}" }
        }
    }
}

/// Industry pain points and the cost of first-attempt color failure.
#[component]
pub fn Problem() -> Element {
    rsx! {
        section { class: "section section--problem reveal",
            div { class: "container",
                span { class: "eyebrow", "The cost of guessing" }
                h2 { class: "section__title",
                    "Every failed first attempt costs time, material, and the brand's patience."
                }
                p { class: "section__lede",
                    "Most color-matching tools start from a generic model and correct toward your factory over months — after you've already paid for the hardware. Color Brain starts from your own proven dye history on day one."
                }
                div { class: "readout-grid readout-grid--3",
                    Readout {
                        value: "4–6".to_string(),
                        label: "attempts on average to approve a new color".to_string(),
                    }
                    Readout {
                        value: "50%".to_string(),
                        label: "of first attempts miss the target".to_string(),
                    }
                    Readout {
                        value: "$500–$2K".to_string(),
                        label: "typical cost per failed attempt".to_string(),
                    }
                }
            }
        }
    }
}
