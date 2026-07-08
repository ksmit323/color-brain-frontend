use dioxus::prelude::*;

use components::{
    CaseStudiesSection, ContactForm, Footer, Hero, HowItWorks, Nav, Problem, Proof, WhoItsFor,
};

/// The five holdout case-study rows and their card component.
mod case_studies;
/// Shared UI components: nav, footer, and the section components added in L3+.
mod components;
/// Lab → sRGB math for swatch chips (duplicated from the app crate on purpose).
mod lab_color;

const FAVICON: Asset = asset!("/assets/favicon.ico");
const LANDING_CSS: Asset = asset!("/assets/styling/landing.css");
const REVEAL_JS: Asset = asset!("/assets/script/reveal.js");

const SITE_TITLE: &str = "Color Brain — Dye Recipe Intelligence";
const SITE_DESCRIPTION: &str = "Color Brain helps dye houses improve first-attempt color accuracy using historical production data — no new hardware, no new process. 86.7% win rate on validated holdout records.";
const SITE_URL: &str = "https://colorbrain.co";

fn main() {
    dioxus::launch(App);
}

#[component]
fn App() -> Element {
    rsx! {
        document::Title { "{SITE_TITLE}" }
        document::Meta { name: "description", content: SITE_DESCRIPTION }
        document::Meta { property: "og:title", content: SITE_TITLE }
        document::Meta { property: "og:description", content: SITE_DESCRIPTION }
        document::Meta { property: "og:url", content: SITE_URL }
        document::Meta { property: "og:type", content: "website" }
        document::Meta { property: "og:site_name", content: "Color Brain" }
        document::Meta { name: "twitter:card", content: "summary" }
        document::Meta { name: "twitter:title", content: SITE_TITLE }
        document::Meta { name: "twitter:description", content: SITE_DESCRIPTION }

        document::Link { rel: "icon", href: FAVICON }
        document::Link { rel: "canonical", href: SITE_URL }
        document::Link { rel: "preconnect", href: "https://fonts.googleapis.com" }
        document::Link { rel: "preconnect", href: "https://fonts.gstatic.com" }
        document::Link {
            rel: "stylesheet",
            href: "https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&family=IBM+Plex+Sans:wght@400;500;600&family=Space+Grotesk:wght@500;600;700&display=swap",
        }
        document::Link { rel: "stylesheet", href: LANDING_CSS }
        document::Script { src: REVEAL_JS, defer: true }

        div { id: "top",
            Nav {}
            main {
                Hero {}
                Problem {}
                HowItWorks {}
                Proof {}
                CaseStudiesSection {}
                WhoItsFor {}
                ContactForm {}
            }
            Footer {}
        }
    }
}
