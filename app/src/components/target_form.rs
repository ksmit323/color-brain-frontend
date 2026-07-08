//! The job-ticket form: target Lab color, substrate/program, and optional process variables.

use dioxus::prelude::*;

/// The form's raw text fields, grouped so [`Home`](crate::views::Home) can own the state and pass
/// it down as a single reactive prop. Values stay as strings for free-form numeric entry and are
/// parsed on submit. Signals are `Copy`, so this whole struct is `Copy`.
#[derive(Clone, Copy, PartialEq)]
pub struct FormFields {
    pub target_l: Signal<String>,
    pub target_a: Signal<String>,
    pub target_b: Signal<String>,
    pub substrate: Signal<String>,
    pub dye_prog: Signal<String>,
    pub yarn_weight: Signal<String>,
    pub water_volume: Signal<String>,
    pub liquor_ratio: Signal<String>,
    pub cycle_time: Signal<String>,
}

/// A single labelled text input bound to a string signal. Used for every numeric field so the
/// form markup stays flat.
#[component]
fn Field(label: String, placeholder: String, mut value: Signal<String>) -> Element {
    rsx! {
        label { class: "field",
            span { class: "field__label", "{label}" }
            input {
                class: "field__input",
                inputmode: "decimal",
                placeholder,
                value,
                oninput: move |e| value.set(e.value()),
            }
        }
    }
}

/// The recommendation request form. The substrate and dye-program options come from backend
/// metadata (never hard-coded). `on_submit` fires on form submission; the parent reads the field
/// signals, builds the request, and runs it.
#[component]
pub fn TargetForm(
    fields: FormFields,
    substrates: Vec<String>,
    dye_programs: Vec<String>,
    on_submit: EventHandler<FormEvent>,
) -> Element {
    let mut substrate = fields.substrate;
    let mut dye_prog = fields.dye_prog;

    rsx! {
        form { class: "form", onsubmit: move |e| on_submit.call(e),

            section { class: "form__section",
                div { class: "form__legend",
                    span { "Target color" }
                    span { class: "unit", "CIELAB · D65" }
                }
                div { class: "lab-inputs",
                    Field { label: "L*", placeholder: "0–100", value: fields.target_l }
                    Field { label: "a*", placeholder: "−128…127", value: fields.target_a }
                    Field { label: "b*", placeholder: "−128…127", value: fields.target_b }
                }
            }

            section { class: "form__section",
                div { class: "form__legend", span { "Program" } }
                label { class: "field",
                    span { class: "field__label", "Substrate" }
                    select {
                        class: "select",
                        value: substrate,
                        onchange: move |e| substrate.set(e.value()),
                        option { value: "", "Select substrate" }
                        for s in substrates {
                            option { value: "{s}", "{s}" }
                        }
                    }
                }
                div { style: "height: 10px;" }
                label { class: "field",
                    span { class: "field__label", "Dye program" }
                    select {
                        class: "select",
                        value: dye_prog,
                        onchange: move |e| dye_prog.set(e.value()),
                        option { value: "", "Select program" }
                        for p in dye_programs {
                            option { value: "{p}", "{p}" }
                        }
                    }
                }
            }

            details { class: "disclosure",
                summary {
                    span { "Process variables" }
                    span { class: "field__label", "optional" }
                }
                div { class: "proc-inputs",
                    Field { label: "Yarn weight", placeholder: "kg", value: fields.yarn_weight }
                    Field { label: "Water volume", placeholder: "L", value: fields.water_volume }
                    Field { label: "Liquor ratio", placeholder: "1:x", value: fields.liquor_ratio }
                    Field { label: "Cycle time", placeholder: "min", value: fields.cycle_time }
                }
            }

            button { class: "btn", r#type: "submit", "Recommend recipe" }
        }
    }
}
