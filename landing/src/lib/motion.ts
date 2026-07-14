/**
 * Page motion layer: GSAP/ScrollTrigger wiring, native anchor easing,
 * headline word reveal, and section scroll-reveals.
 *
 * With prefers-reduced-motion everything is shown immediately and native
 * scrolling is kept — no tweens, and the caller skips the brain.
 */

import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

/** Sticky nav height, compensated when scrolling to anchors. */
const NAV_HEIGHT = 64;

export function initMotion(): void {
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduced) {
    for (const el of document.querySelectorAll(".reveal")) {
      el.classList.add("is-visible");
    }
    return;
  }

  gsap.registerPlugin(ScrollTrigger);
  routeAnchors();
  revealOnScroll();
  revealHeadline();

  // The display fonts arrive asynchronously. Refresh once their final metrics
  // are known so scroll beats never inherit fallback-font geometry.
  document.fonts.ready.then(() => ScrollTrigger.refresh());
}

/** Use browser-native smooth scrolling so input and visuals stay locked. */
function routeAnchors(): void {
  for (const anchor of document.querySelectorAll<HTMLAnchorElement>(
    'a[href^="#"]',
  )) {
    anchor.addEventListener("click", (event) => {
      const selector = anchor.getAttribute("href")!;
      const target = document.querySelector<HTMLElement>(selector);
      if (!target) return;
      event.preventDefault();
      const top =
        target.getBoundingClientRect().top + window.scrollY - NAV_HEIGHT;
      window.scrollTo({ top, behavior: "smooth" });
      history.pushState(null, "", selector);
    });
  }
}

/** Fade-and-rise sections into view once, as they enter the viewport. */
function revealOnScroll(): void {
  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        }
      }
    },
    { threshold: 0.15 },
  );
  for (const el of document.querySelectorAll(".reveal")) {
    observer.observe(el);
  }
}

/** Word-by-word rise of the hero headline on load (hand-rolled split). */
function revealHeadline(): void {
  const lines = document.querySelectorAll<HTMLElement>("[data-split]");
  if (lines.length === 0) return;

  for (const line of lines) {
    if (!line.textContent) continue;
    const words = line.textContent.trim().split(/\s+/);
    line.textContent = "";
    for (const word of words) {
      const clip = document.createElement("span");
      clip.className = "split-word";
      const inner = document.createElement("span");
      inner.textContent = word;
      clip.appendChild(inner);
      line.append(clip, " ");
    }
  }

  gsap.fromTo(
    document.querySelectorAll(".hero__headline .split-word > span"),
    { yPercent: 115 },
    {
      yPercent: 0,
      duration: 0.86,
      ease: "power3.out",
      stagger: 0.065,
      delay: 0.08,
    },
  );
}
