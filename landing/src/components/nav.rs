//! Sticky top navigation: brand mark, in-page section links, and the two CTAs.

use dioxus::prelude::*;

const LOGO: Asset = asset!("/assets/cb_logo.svg");

#[component]
pub fn Nav() -> Element {
    rsx! {
        nav { class: "nav",
            div { class: "container nav__inner",
                a { class: "nav__brand", href: "#top",
                    img {
                        class: "nav__logo",
                        src: LOGO,
                        alt: "",
                    }
                    span { class: "nav__wordmark", "Color Brain" }
                }
                ul { class: "nav__links",
                    li { a { class: "nav__link", href: "#how-it-works", "How It Works" } }
                    li { a { class: "nav__link", href: "#proof", "Proof" } }
                    li { a { class: "nav__link", href: "#case-studies", "Case Studies" } }
                    li { a { class: "nav__link", href: "#who-its-for", "Who It's For" } }
                }
                div { class: "nav__actions",
                    a { class: "btn btn--primary btn--sm", href: "#contact", "Request a Pilot" }
                    a { class: "btn btn--ghost btn--sm", href: "https://app.colorbrain.co", "Open the App" }
                }
            }
        }
    }
}