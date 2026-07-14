//! The job-ticket form: target Lab color, substrate/program, and optional process variables.

use dioxus::prelude::*;

use crate::components::lab_to_rgb;

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

/// A labelled numeric input with explicit units and browser-level range validation.
#[component]
fn Field(
    id: String,
    label: String,
    unit: String,
    placeholder: String,
    min: Option<String>,
    max: Option<String>,
    required: bool,
    mut value: Signal<String>,
) -> Element {
    rsx! {
        label { class: "field", r#for: "{id}",
            span { class: "field__label",
                span { "{label}" }
                span { class: "field__unit", "{unit}" }
            }
            input {
                id,
                class: "field__input",
                r#type: "number",
                inputmode: "decimal",
                step: "any",
                min,
                max,
                required,
                aria_required: required,
                autocomplete: "off",
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
    submitting: bool,
    backend_online: Option<bool>,
    validation_error: Option<String>,
    on_submit: EventHandler<FormEvent>,
) -> Element {
    let mut substrate = fields.substrate;
    let mut dye_prog = fields.dye_prog;
    let preview = (
        (fields.target_l)().trim().parse::<f64>(),
        (fields.target_a)().trim().parse::<f64>(),
        (fields.target_b)().trim().parse::<f64>(),
    );
    let preview = match preview {
        (Ok(l), Ok(a), Ok(b))
            if (0.0..=100.0).contains(&l)
                && (-128.0..=127.0).contains(&a)
                && (-128.0..=127.0).contains(&b) =>
        {
            Some(lab_to_rgb(l, a, b))
        }
        _ => None,
    };
    let preview_color = preview
        .map(|(r, g, b)| format!("rgb({r},{g},{b})"))
        .unwrap_or_else(|| "transparent".to_string());
    let preview_class = if preview.is_some() {
        "target-preview__sample"
    } else {
        "target-preview__sample target-preview__sample--empty"
    };
    let submit_disabled = submitting || backend_online == Some(false);
    let submit_label = if submitting {
        "Finding the best historical match…"
    } else if backend_online == Some(false) {
        "Color Brain is offline"
    } else {
        "Find a proven recipe"
    };

    rsx! {
        form { class: "form", onsubmit: move |e| on_submit.call(e),

            section { class: "form__section",
                div { class: "form__legend",
                    span { "Target color" }
                    span { class: "unit", "Required · CIELAB D65" }
                }
                div { class: "target-preview",
                    div {
                        class: "{preview_class}",
                        background_color: "{preview_color}",
                        aria_hidden: "true",
                    }
                    div {
                        span { class: "target-preview__label", "Target preview" }
                        if preview.is_some() {
                            span { class: "target-preview__status", "Valid Lab coordinates" }
                        } else {
                            span { class: "target-preview__status", "Enter all three coordinates" }
                        }
                    }
                }
                div { class: "lab-inputs",
                    Field {
                        id: "target-l",
                        label: "L*",
                        unit: "0–100",
                        placeholder: "50.0",
                        min: Some("0".to_string()),
                        max: Some("100".to_string()),
                        required: true,
                        value: fields.target_l,
                    }
                    Field {
                        id: "target-a",
                        label: "a*",
                        unit: "−128…127",
                        placeholder: "0.0",
                        min: Some("-128".to_string()),
                        max: Some("127".to_string()),
                        required: true,
                        value: fields.target_a,
                    }
                    Field {
                        id: "target-b",
                        label: "b*",
                        unit: "−128…127",
                        placeholder: "0.0",
                        min: Some("-128".to_string()),
                        max: Some("127".to_string()),
                        required: true,
                        value: fields.target_b,
                    }
                }
                p { class: "form__help", "Use the D65 Lab values from the target measurement." }
            }

            section { class: "form__section",
                div { class: "form__legend",
                    span { "Production context" }
                    span { class: "unit", "Required" }
                }
                div { class: "form__stack",
                    label { class: "field",
                        span { class: "field__label", "Substrate" }
                        select {
                            class: "select",
                            value: substrate,
                            required: true,
                            onchange: move |e| substrate.set(e.value()),
                            option { value: "", "Select substrate" }
                            for s in substrates {
                                option { key: "{s}", value: "{s}", "{s}" }
                            }
                        }
                    }
                    label { class: "field",
                        span { class: "field__label", "Dye program" }
                        select {
                            class: "select",
                            value: dye_prog,
                            required: true,
                            onchange: move |e| dye_prog.set(e.value()),
                            option { value: "", "Select program" }
                            for p in dye_programs {
                                option { key: "{p}", value: "{p}", "{p}" }
                            }
                        }
                    }
                }
            }

            details { class: "disclosure",
                summary {
                    span { "Process variables" }
                    span { class: "field__label", "Optional · add when available" }
                }
                p { class: "form__help", "These values can improve comparison with historical jobs." }
                div { class: "proc-inputs",
                    Field {
                        id: "yarn-weight",
                        label: "Yarn weight",
                        unit: "kg",
                        placeholder: "250",
                        min: Some("0".to_string()),
                        max: None,
                        required: false,
                        value: fields.yarn_weight,
                    }
                    Field {
                        id: "water-volume",
                        label: "Water volume",
                        unit: "L",
                        placeholder: "2500",
                        min: Some("0".to_string()),
                        max: None,
                        required: false,
                        value: fields.water_volume,
                    }
                    Field {
                        id: "liquor-ratio",
                        label: "Liquor ratio",
                        unit: "1:x",
                        placeholder: "10",
                        min: Some("0".to_string()),
                        max: None,
                        required: false,
                        value: fields.liquor_ratio,
                    }
                    Field {
                        id: "cycle-time",
                        label: "Cycle time",
                        unit: "min",
                        placeholder: "60",
                        min: Some("0".to_string()),
                        max: None,
                        required: false,
                        value: fields.cycle_time,
                    }
                }
            }

            if let Some(error) = validation_error {
                p { class: "form__error", role: "alert", "{error}" }
            }
            button {
                class: "btn",
                r#type: "submit",
                disabled: submit_disabled,
                aria_busy: submitting,
                "{submit_label}"
            }
        }
    }
}
