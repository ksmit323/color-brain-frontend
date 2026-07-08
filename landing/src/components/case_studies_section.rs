//! Case Studies section: five real holdout job comparison cards.

use dioxus::prelude::*;

use crate::case_studies::{CaseStudyCard, CASE_STUDIES};

/// The case-studies block — real anonymized jobs with target / technician / Color Brain swatches.
#[component]
pub fn CaseStudiesSection() -> Element {
    rsx! {
        section { class: "section section--case-studies reveal", id: "case-studies",
            div { class: "container",
                span { class: "eyebrow", "Case studies" }
                h2 { class: "section__title",
                    "Built on real data. Tested on real jobs."
                }
                p { class: "section__lede",
                    "Five high-confidence recommendations from the holdout evaluation — each one a real substrate, a real target color, and a real historical recipe Color Brain surfaced from factory history."
                }
                div { class: "case-grid",
                    for study in CASE_STUDIES {
                        CaseStudyCard { study: *study }
                    }
                }
            }
        }
    }
}
