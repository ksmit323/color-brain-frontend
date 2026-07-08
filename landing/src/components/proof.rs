//! Holdout validation proof points — large mono readout digits, not hype tiles.

use dioxus::prelude::*;

/// One validation metric rendered as a large mono readout.
#[component]
fn ProofReadout(value: String, label: String, #[props(optional)] accent: bool) -> Element {
    let class = if accent {
        "readout readout--accent"
    } else {
        "readout"
    };
    rsx! {
        div { class: "{class}",
            span { class: "readout__value", "{value}" }
            span { class: "readout__label", "{label}" }
        }
    }
}

/// The holdout evaluation numbers that back every claim on this page.
#[component]
pub fn Proof() -> Element {
    rsx! {
        section { class: "section section--proof reveal", id: "proof",
            div { class: "container",
                span { class: "eyebrow", "Validated holdout" }
                h2 { class: "section__title",
                    "Built on real production data. Tested on jobs it had never seen."
                }
                p { class: "section__lede",
                    "Trained on 12,398 real dye records, then evaluated on 2,043 future-like holdout jobs the model never trained on. It never invents recipes — it retrieves a real historical recipe your factory already used, only within the same substrate, and only when confident."
                }

                div { class: "readout-grid readout-grid--proof",
                    ProofReadout {
                        value: "12,398".to_string(),
                        label: "production records trained on".to_string(),
                    }
                    ProofReadout {
                        value: "2,043".to_string(),
                        label: "unseen holdout jobs tested".to_string(),
                    }
                    ProofReadout {
                        value: "414".to_string(),
                        label: "jobs recommended (20.3% coverage)".to_string(),
                    }
                    ProofReadout {
                        value: "86.7%".to_string(),
                        label: "win rate when it recommends".to_string(),
                        accent: true,
                    }
                    ProofReadout {
                        value: "+0.2082".to_string(),
                        label: "median ΔE improvement on recommended jobs".to_string(),
                    }
                    ProofReadout {
                        value: "~80%".to_string(),
                        label: "abstention rate — calibrated silence, not failure".to_string(),
                    }
                }

                p { class: "proof__footnote",
                    "On the ~80% of jobs where Color Brain abstains, it is saying the evidence isn't strong enough to beat your technician's first attempt. Selectivity is the point — a recommendation you can trust."
                }
            }
        }
    }
}
