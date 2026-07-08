use dioxus::prelude::*;

use components::{Footer, Hero, Nav};

/// Shared UI components: nav, footer, and the section components added in L3+.
mod components;

const FAVICON: Asset = asset!("/assets/favicon.ico");
const LANDING_CSS: Asset = asset!("/assets/styling/landing.css");

fn main() {
    dioxus::launch(App);
}

#[component]
fn App() -> Element {
    rsx! {
        document::Link { rel: "icon", href: FAVICON }
        document::Link { rel: "preconnect", href: "https://fonts.googleapis.com" }
        document::Link { rel: "preconnect", href: "https://fonts.gstatic.com" }
        document::Link {
            rel: "stylesheet",
            href: "https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&family=IBM+Plex+Sans:wght@400;500;600&family=Space+Grotesk:wght@500;600;700&display=swap",
        }
        document::Link { rel: "stylesheet", href: LANDING_CSS }

        div { id: "top",
            Nav {}
            main {
                Hero {}
                // Problem, proof, case studies, who-it's-for, and contact sections land in L4-L6.
                div { class: "shell-placeholder container", "More sections coming in L4+." }
            }
            Footer {}
        }
    }
}
