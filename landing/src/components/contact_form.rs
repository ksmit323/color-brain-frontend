//! Request a Pilot contact form and closing CTA.
//!
//! Submissions POST to a hosted form backend (Formspree by default). Swap `FORM_ACTION` once the
//! endpoint is provisioned — see `LANDING_PAGE_PLAN.md` § Contact form.

use dioxus::prelude::*;

/// Formspree (or equivalent) endpoint — forwards to the @colorbrain.co inbox. Replace before launch.
const FORM_ACTION: &str = "https://formspree.io/f/mwvdjnde";

/// One labeled input in the pilot-request form.
#[component]
fn FormField(label: String, name: String, children: Element) -> Element {
    rsx! {
        div { class: "form-field",
            label { r#for: "{name}", "{label}" }
            {children}
        }
    }
}

/// The closing CTA and on-page pilot request form (`#contact`).
#[component]
pub fn ContactForm() -> Element {
    rsx! {
        section { class: "section section--contact reveal", id: "contact",
            div { class: "container",
                div { class: "contact__intro",
                    span { class: "eyebrow", "Request a pilot" }
                    h2 { class: "contact__title",
                        "Your factory's history already contains the answer."
                    }
                    p { class: "contact__lede",
                        "Color Brain finds it for you. Tell us about your operation and we'll follow up to scope a pilot."
                    }
                }

                form {
                    class: "contact-form",
                    action: "{FORM_ACTION}",
                    method: "post",

                    input {
                        r#type: "hidden",
                        name: "_subject",
                        value: "Pilot request — colorbrain.co",
                    }

                    div { class: "contact-form__row",
                        FormField {
                            label: "Name".to_string(),
                            name: "name".to_string(),
                            input {
                                r#type: "text",
                                name: "name",
                                id: "name",
                                required: true,
                                autocomplete: "name",
                            }
                        }
                        FormField {
                            label: "Company".to_string(),
                            name: "company".to_string(),
                            input {
                                r#type: "text",
                                name: "company",
                                id: "company",
                                autocomplete: "organization",
                            }
                        }
                    }

                    FormField {
                        label: "Email".to_string(),
                        name: "email".to_string(),
                        input {
                            r#type: "email",
                            name: "email",
                            id: "email",
                            required: true,
                            autocomplete: "email",
                        }
                    }

                    FormField {
                        label: "Message".to_string(),
                        name: "message".to_string(),
                        textarea {
                            name: "message",
                            id: "message",
                            required: true,
                            rows: "5",
                            placeholder: "Substrates you dye, approximate job volume, what a successful pilot would look like…",
                        }
                    }

                    button { class: "btn btn--primary contact-form__submit", r#type: "submit",
                        "Request a Pilot"
                    }
                }
            }
        }
    }
}
