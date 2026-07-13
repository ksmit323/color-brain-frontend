/**
 * Case-study tab browser. All five panels are server-rendered; this toggles
 * which one is visible and plays the target-plate animation — rings draw
 * outward, the two attempt markers land, and the "N× closer" ratio counts up.
 * The DOM is the source of truth — no state beyond the selected index.
 */

import gsap from "gsap";

export function initCaseBrowser(): void {
  const root = document.querySelector<HTMLElement>("[data-case-browser]");
  if (!root) return;

  const tabs = [...root.querySelectorAll<HTMLButtonElement>('[role="tab"]')];
  const panels = [...root.querySelectorAll<HTMLElement>('[role="tabpanel"]')];
  const countLabel = root.querySelector<HTMLElement>("[data-case-count]");
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;

  let current = 0;

  function animatePlate(panel: HTMLElement): void {
    if (reduced) return;
    const rings = panel.querySelectorAll(".plate__ring");
    const markers = panel.querySelectorAll(".plate__marker");
    const crosshair = panel.querySelector(".plate__crosshair");
    const num = panel.querySelector<HTMLElement>("[data-ratio]");
    gsap.killTweensOf([rings, markers, crosshair]);
    gsap.from(rings, {
      attr: { r: 0 },
      opacity: 0,
      duration: 0.7,
      stagger: 0.06,
      ease: "power3.out",
    });
    if (crosshair) gsap.from(crosshair, { opacity: 0, duration: 0.5, delay: 0.25 });
    gsap.from(markers, {
      attr: { r: 0 },
      duration: 0.55,
      stagger: 0.22,
      delay: 0.4,
      ease: "back.out(2.5)",
    });
    if (num) {
      const target = parseFloat(num.dataset.ratio!);
      const state = { v: 0 };
      gsap.killTweensOf(state);
      gsap.to(state, {
        v: target,
        duration: 1.1,
        delay: 0.5,
        ease: "power2.out",
        onUpdate: () => {
          num.textContent = state.v.toFixed(1);
        },
      });
    }
  }

  function select(index: number, focusTab = false): void {
    current = (index + tabs.length) % tabs.length;
    tabs.forEach((tab, i) => {
      tab.setAttribute("aria-selected", i === current ? "true" : "false");
      tab.tabIndex = i === current ? 0 : -1;
    });
    panels.forEach((panel, i) => {
      panel.hidden = i !== current;
    });
    if (countLabel) countLabel.textContent = String(current + 1);
    if (focusTab) tabs[current]!.focus();
    animatePlate(panels[current]!);
  }

  tabs.forEach((tab, i) => tab.addEventListener("click", () => select(i)));

  tabs[0]!.parentElement!.addEventListener("keydown", (event) => {
    const key = (event as KeyboardEvent).key;
    if (key === "ArrowRight") select(current + 1, true);
    else if (key === "ArrowLeft") select(current - 1, true);
    else if (key === "Home") select(0, true);
    else if (key === "End") select(tabs.length - 1, true);
    else return;
    event.preventDefault();
  });

  root.querySelector("[data-case-prev]")?.addEventListener("click", () => select(current - 1));
  root.querySelector("[data-case-next]")?.addEventListener("click", () => select(current + 1));

  // Play the first plate once, when the section scrolls into view.
  const firstPlay = new IntersectionObserver(
    (entries) => {
      if (entries[0]!.isIntersecting) {
        animatePlate(panels[current]!);
        firstPlay.disconnect();
      }
    },
    { threshold: 0.35 },
  );
  firstPlay.observe(root);
}
