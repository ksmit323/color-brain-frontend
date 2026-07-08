//! Three-step workflow: Connect → Search → Recommend or Abstain.

use dioxus::prelude::*;

/// One numbered step in the How It Works sequence.
#[component]
fn Step(number: String, title: String, body: String) -> Element {
    rsx! {
        div { class: "step",
            span { class: "step__num", "{number}" }
            h3 { class: "step__title", "{title}" }
            p { class: "step__body", "{body}" }
        }
    }
}

/// The product workflow in three earned steps — no decorative numbering elsewhere on the page.
#[component]
pub fn HowItWorks() -> Element {
    rsx! {
        section { class: "section section--alt reveal", id: "how-it-works",
            div { class: "container",
                span { class: "eyebrow", "How it works" }
                h2 { class: "section__title",
                    "Three steps. No new hardware. Fits inside your workflow."
                }
                div { class: "steps",
                    Step {
                        number: "01".to_string(),
                        title: "Connect".to_string(),
                        body: "Share your historical batch records. The more dye jobs you feed in, the sharper and more substrate-specific the recommendations become.".to_string(),
                    }
                    Step {
                        number: "02".to_string(),
                        title: "Search".to_string(),
                        body: "For each new color, Color Brain finds the closest historical job on the same substrate and scores how likely that recipe beats your technician's first attempt.".to_string(),
                    }
                    Step {
                        number: "03".to_string(),
                        title: "Recommend or abstain".to_string(),
                        body: "When confidence is high, Color Brain surfaces a real recipe your factory already ran. When it isn't, it stays silent — abstention is a deliberate trust feature, not a miss.".to_string(),
                    }
                }
            }
        }
    }
}
