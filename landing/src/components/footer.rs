//! Site footer: brand recap, section links, founders, and a copyright line.

use dioxus::prelude::*;

#[component]
pub fn Footer() -> Element {
    rsx! {
        footer { class: "footer",
            div { class: "container",
                div { class: "footer__grid",
                    div {
                        div { class: "footer__brand", "Color Brain" }
                        p { class: "footer__tagline",
                            "Decision support for textile coloration — recommend proven history, abstain when the evidence isn't there."
                        }
                    }
                    div {
                        div { class: "footer__heading", "Site" }
                        ul { class: "footer__list",
                            li { a { href: "#how-it-works", "How It Works" } }
                            li { a { href: "#proof", "Proof" } }
                            li { a { href: "#case-studies", "Case Studies" } }
                            li { a { href: "#who-its-for", "Who It's For" } }
                            li { a { href: "https://app.colorbrain.co", "Open the App" } }
                        }
                    }
                    div {
                        div { class: "footer__heading", "Founders" }
                        ul { class: "footer__list",
                            li {
                                span { "Luis Aloma" }
                                span { class: "footer__founder-role", "CEO & Cofounder" }
                            }
                            li {
                                span { "Will Sandman" }
                                span { class: "footer__founder-role", "Chief Commercial & Founder" }
                            }
                            li {
                                span { "Ken Smith" }
                                span { class: "footer__founder-role", "Cofounder & Chief Technical" }
                            }
                        }
                    }
                }
                div { class: "footer__bottom",
                    span { "© 2026 Color Brain" }
                    a { href: "https://app.colorbrain.co", "Open the App" }
                }
            }
        }
    }
}
