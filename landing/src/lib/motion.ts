/**
 * Page motion layer: Lenis smooth scrolling, GSAP/ScrollTrigger wiring,
 * headline word reveal, and section scroll-reveals.
 *
 * With prefers-reduced-motion everything is shown immediately and native
 * scrolling is kept — no Lenis, no tweens, and the caller skips the brain.
 */

import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Lenis from "lenis";

/** Sticky nav height, compensated when scrolling to anchors. */
const NAV_OFFSET = -64;

export function initMotion(): void {
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduced) {
    for (const el of document.querySelectorAll(".reveal")) {
      el.classList.add("is-visible");
    }
    return;
  }

  gsap.registerPlugin(ScrollTrigger);

  // Known-good Lenis + ScrollTrigger wiring: one ticker drives both, and
  // ScrollTrigger recalculates on every smoothed scroll frame.
  const lenis = new Lenis();
  lenis.on("scroll", ScrollTrigger.update);
  gsap.ticker.add((time) => lenis.raf(time * 1000));
  gsap.ticker.lagSmoothing(0);

  routeAnchorsThroughLenis(lenis);
  revealOnScroll();
  revealHeadline();
}

/** Smooth-scroll same-page anchor links instead of jumping. */
function routeAnchorsThroughLenis(lenis: Lenis): void {
  for (const anchor of document.querySelectorAll<HTMLAnchorElement>('a[href^="#"]')) {
    anchor.addEventListener("click", (event) => {
      const target = anchor.getAttribute("href")!;
      if (!document.querySelector(target)) return;
      event.preventDefault();
      lenis.scrollTo(target, { offset: NAV_OFFSET });
      history.pushState(null, "", target);
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
  const headline = document.querySelector<HTMLElement>("[data-split]");
  if (!headline?.textContent) return;

  const words = headline.textContent.trim().split(/\s+/);
  headline.textContent = "";
  for (const word of words) {
    const clip = document.createElement("span");
    clip.className = "split-word";
    const inner = document.createElement("span");
    inner.textContent = word;
    clip.appendChild(inner);
    headline.append(clip, " ");
  }

  gsap.fromTo(
    headline.querySelectorAll(".split-word > span"),
    { yPercent: 115 },
    { yPercent: 0, duration: 0.9, ease: "power3.out", stagger: 0.09, delay: 0.1 },
  );
}
