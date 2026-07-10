//! Case Studies section: tabbed target swatches flip between five real holdout jobs.

use dioxus::prelude::*;

use crate::case_studies::{CaseStudy, CaseStudyDetail, CASE_STUDIES};

/// Target-color tab for the case-study picker.
#[component]
fn CaseTab(study: CaseStudy, is_active: bool, on_select: EventHandler<()>) -> Element {
    let tab_class = if is_active {
        "case-tab case-tab--active"
    } else {
        "case-tab"
    };

    rsx! {
        button {
            class: "{tab_class}",
            r#type: "button",
            aria_selected: "{is_active}",
            onclick: move |_| on_select.call(()),
            div {
                class: "case-tab__chip",
                background_color: "{study.target.to_css()}",
            }
            span { class: "case-tab__label", "{study.substrate}" }
            if study.technician_missed_spec() {
                span { class: "case-tab__flag" }
            }
        }
    }
}

/// The case-studies block — pick a job by target swatch, then compare the three achieved colors.
#[component]
pub fn CaseStudiesSection() -> Element {
    let mut active = use_signal(|| 0usize);
    let count = CASE_STUDIES.len();

    let prev = move |_| {
        active.set((active() + count - 1) % count);
    };
    let next = move |_| {
        active.set((active() + 1) % count);
    };

    rsx! {
        section { class: "section section--case-studies reveal", id: "case-studies",
            div { class: "container",
                span { class: "eyebrow", "Case studies" }
                h2 { class: "section__title",
                    "Built on real data. Tested on real jobs."
                }
                p { class: "section__lede",
                    "Five high-confidence holdout wins — pick a target color to see the technician's first attempt next to Color Brain's historical recipe match."
                }

                div { class: "case-browser",
                    div { class: "case-browser__tabs",
                        for (index, study) in CASE_STUDIES.iter().enumerate() {
                            CaseTab {
                                key: "{study.row_id}",
                                study: *study,
                                is_active: active() == index,
                                on_select: move |_| active.set(index),
                            }
                        }
                    }

                    div { class: "case-browser__panel",
                        button {
                            class: "case-browser__nav",
                            r#type: "button",
                            aria_label: "Previous case study",
                            onclick: prev,
                            "←"
                        }
                        CaseStudyDetail { study: CASE_STUDIES[active()] }
                        button {
                            class: "case-browser__nav",
                            r#type: "button",
                            aria_label: "Next case study",
                            onclick: next,
                            "→"
                        }
                    }

                    p { class: "case-browser__hint",
                        "{active() + 1} of {count} · ΔE above {crate::case_studies::TECHNICIAN_FAIL_DE:.1} means the technician missed first-attempt spec"
                    }
                }
            }
        }
    }
}
