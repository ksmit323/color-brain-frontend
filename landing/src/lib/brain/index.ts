/**
 * Boot and choreography for the dye-history brain.
 *
 * Loaded lazily (dynamic import) only after the page-level gate has checked
 * reduced-motion and WebGL2 support, so no-motion visitors never pay for
 * three.js. "full" mode adds the scroll-scrubbed retrieval narrative;
 * "ambient" mode (mobile) renders a lighter, drifting constellation only.
 */

import gsap from "gsap";
import { generateBrainData } from "./data";
import { createScene, defaultParams, type BrainParams } from "./scene";

const NODES_PER_CLUSTER_FULL = 110;
const NODES_PER_CLUSTER_AMBIENT = 35;
const SHELL_NODES_FULL = 1100;
const SHELL_NODES_AMBIENT = 350;

export function initBrain(mode: "full" | "ambient"): void {
  const stage = document.querySelector<HTMLElement>("#stage");
  const layer = stage?.querySelector<HTMLElement>(".stage-layer");
  const canvas = document.querySelector<HTMLCanvasElement>("#brain-canvas");
  if (!stage || !layer || !canvas) return;

  const data = generateBrainData(
    mode === "full" ? NODES_PER_CLUSTER_FULL : NODES_PER_CLUSTER_AMBIENT,
    mode === "full" ? SHELL_NODES_FULL : SHELL_NODES_AMBIENT,
  );
  const params = defaultParams();
  const scene = createScene(canvas, data, params, () =>
    layer.classList.add("is-live"),
  );
  if (!scene) return; // WebGL context refused — the poster stays.

  // Render only while the stage is on screen and the tab is visible.
  let stageVisible = false;
  const syncRunning = () => {
    if (stageVisible && !document.hidden) scene.start();
    else scene.stop();
  };
  new IntersectionObserver((entries) => {
    stageVisible = entries[0]!.isIntersecting;
    syncRunning();
  }).observe(stage);
  document.addEventListener("visibilitychange", syncRunning);

  if (matchMedia("(pointer: fine)").matches) {
    // pointerX/Y feed the scene's proximity glow in canvas clip space (NDC),
    // so they're measured against the canvas rect, not the window.
    let idleTimer = 0;
    window.addEventListener(
      "pointermove",
      (e) => {
        params.parallaxX = (e.clientX / window.innerWidth - 0.5) * 2;
        params.parallaxY = (e.clientY / window.innerHeight - 0.5) * 2;
        const rect = canvas.getBoundingClientRect();
        params.pointerX = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        params.pointerY = -(((e.clientY - rect.top) / rect.height) * 2 - 1);
        params.pointerActive = 1;
        clearTimeout(idleTimer);
        idleTimer = window.setTimeout(() => (params.pointerActive = 0), 1500);
      },
      { passive: true },
    );
  }

  if (mode === "full") {
    let timeline = buildTimeline(stage, params);
    let resizeTimer = 0;
    window.addEventListener("resize", () => {
      clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(() => {
        timeline?.scrollTrigger?.kill();
        timeline?.kill();
        Object.assign(params, defaultParams());
        timeline = buildTimeline(stage, params);
      }, 300);
    });
  }
}

type ScenePhase = "index" | "search" | "match" | "adjust" | "learn";

interface PhaseThreshold {
  phase: ScenePhase;
  until: number;
}

interface BeatPositions {
  search: number;
  match: number;
  adjust: number;
  learn: number;
}

const PHASE_LEAD = 0.02;

function resolvePhase(
  progress: number,
  thresholds: readonly PhaseThreshold[],
): ScenePhase {
  for (const entry of thresholds) {
    if (progress < entry.until) return entry.phase;
  }
  return "learn";
}

function measureBeat(
  stage: HTMLElement,
  stageTop: number,
  scrollRange: number,
  name: string,
): number {
  const el = stage.querySelector<HTMLElement>(`[data-beat="${name}"]`);
  if (!el) return 0;
  // Progress when the beat element's center crosses the viewport center.
  // Rect difference, not offsetTop: the steps' offset parent is their
  // section, not the stage.
  const rect = el.getBoundingClientRect();
  const center = rect.top - stageTop + rect.height / 2 - window.innerHeight / 2;
  return Math.min(1, Math.max(0, center / scrollRange));
}

function readBeats(stage: HTMLElement): BeatPositions {
  const scrollRange = Math.max(1, stage.scrollHeight - window.innerHeight);
  const stageTop = stage.getBoundingClientRect().top;
  return {
    search: measureBeat(stage, stageTop, scrollRange, "search"),
    match: measureBeat(stage, stageTop, scrollRange, "match"),
    adjust: measureBeat(stage, stageTop, scrollRange, "adjust"),
    learn: measureBeat(stage, stageTop, scrollRange, "learn"),
  };
}

function buildThresholds(beats: BeatPositions): readonly PhaseThreshold[] {
  return [
    { phase: "index", until: beats.search - PHASE_LEAD },
    { phase: "search", until: beats.match - PHASE_LEAD },
    { phase: "match", until: beats.adjust - PHASE_LEAD },
    { phase: "adjust", until: beats.learn - PHASE_LEAD },
  ];
}

function scheduleTransitions(
  tl: gsap.core.Timeline,
  params: BrainParams,
  beats: BeatPositions,
): void {
  const adjustAt = Math.max(beats.match + 0.05, beats.adjust - 0.07);
  const learnAt = Math.max(beats.adjust + 0.05, beats.learn - 0.07);
  tl.to(params, { targetProgress: 1, duration: 0.08 }, Math.max(0, beats.search - 0.06));
  tl.to(params, { reveal: 1, duration: Math.max(0.1, beats.match - beats.search) }, beats.search);
  tl.to(params, { pulse: 1, duration: 0.05 }, beats.match);
  tl.to(params, { dim: 0.78, drift: 0.22, pulse: 0.28, loop: 0, duration: 0.09 }, adjustAt);
  tl.to(params, { dim: 0.18, drift: 0.72, pulse: 0.58, loop: 1, duration: 0.1 }, learnAt);
  tl.set({}, {}, 1); // pin timeline duration to 1 so beat positions map exactly
}

/**
 * One scrubbed timeline across the whole stage. Beat times come from the
 * [data-beat] elements' scroll offsets, so the choreography stays aligned
 * with the copy at any viewport size:
 *   search → the target color flies in, retrieval propagates outward
 *   match  → the retrieved recipe's node flares (recommend)
 *   adjust → the network cools to show a recalibration step
 *   learn  → inward feedback pulses propagate through the map (learning loop)
 */
function buildTimeline(
  stage: HTMLElement,
  params: BrainParams,
): gsap.core.Timeline {
  const beats = readBeats(stage);
  const thresholds = buildThresholds(beats);
  const syncPhase = (progress: number): void => {
    const phase = resolvePhase(progress, thresholds);
    if (stage.dataset.scenePhase !== phase) stage.dataset.scenePhase = phase;
  };
  const tl = gsap.timeline({
    defaults: { ease: "none" },
    scrollTrigger: {
      trigger: stage,
      start: "top top",
      end: "bottom bottom",
      scrub: 0.28,
      onUpdate: (self) => syncPhase(self.progress),
    },
  });
  scheduleTransitions(tl, params, beats);
  syncPhase(tl.scrollTrigger?.progress ?? 0);
  return tl;
}
