//! Sticky top navigation: brand mark, in-page section links, and the two CTAs.

use dioxus::prelude::*;

#[component]
pub fn Nav() -> Element {
    rsx! {
        nav { class: "nav",
            div { class: "nav__row",
                a { class: "nav__brand", href: "#top", "Color Brain" }
                ul { class: "nav__links",
                    li { a { href: "#how-it-works", "How It Works" } }
                    li { a { href: "#proof", "Proof" } }
                    li { a { href: "#case-studies", "Case Studies" } }
                    li { a { href: "#who-its-for", "Who It's For" } }
                }
                div { class: "nav__actions",
                    a { class: "btn btn--ghost", href: "https://app.colorbrain.co", "Open the App" }
                    a { class: "btn btn--primary", href: "#contact", "Request a Pilot" }
                }
            }
        }
    }
}
