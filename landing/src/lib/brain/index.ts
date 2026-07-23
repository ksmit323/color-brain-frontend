/**
 * Boot and choreography for the dye-history brain.
 *
 * Loaded lazily (dynamic import) only after the page-level gate has checked
 * reduced-motion and WebGL2 support, so no-motion visitors never pay for
 * three.js. "full" mode adds the scroll-scrubbed retrieval narrative;
 * "ambient" mode (mobile) renders a lighter, drifting constellation only.
 *
 * The narrative: the query color traverses the map during the hero exit and
 * lands at its Lab point as the Search step arrives; the stage frame
 * dissolves to full-bleed while the camera dives into the cloud; the
 * retrieval wave spreads outward from the query through compatible history;
 * the retrieved recipe flares as confidence clears the gate; finally the
 * camera pulls back and the network stills — calibrated silence.
 */

import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { generateBrainData } from "./data";
import { createScene, defaultParams, type BrainParams } from "./scene";

gsap.registerPlugin(ScrollTrigger);

const NODES_PER_CLUSTER_FULL = 110;
const NODES_PER_CLUSTER_AMBIENT = 35;

/** Real product numbers shown in the HUD (see Proof section / backend). */
const TOTAL_RECORDS = 12398;
const GATE_TAU = 0.82;
const CONFIDENCE_IDLE = 0.12;
const CONFIDENCE_SEARCH = 0.58;
const CONFIDENCE_MATCH = 0.867;
const CONFIDENCE_ABSTAIN = 0.34;

export function initBrain(mode: "full" | "ambient"): void {
  const stage = document.querySelector<HTMLElement>("#stage");
  const layer = stage?.querySelector<HTMLElement>(".stage-layer");
  const canvas = document.querySelector<HTMLCanvasElement>("#brain-canvas");
  if (!stage || !layer || !canvas) return;

  const data = generateBrainData(
    mode === "full" ? NODES_PER_CLUSTER_FULL : NODES_PER_CLUSTER_AMBIENT,
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
    window.addEventListener(
      "pointermove",
      (e) => {
        params.parallaxX = (e.clientX / window.innerWidth - 0.5) * 2;
        params.parallaxY = (e.clientY / window.innerHeight - 0.5) * 2;
      },
      { passive: true },
    );
  }

  if (mode === "full") initChoreography(stage, layer, params, scene);
}

/** Live HUD readouts driven by the scrubbed timeline. */
interface Hud {
  confidence: number;
  searched: number;
}

function initChoreography(
  stage: HTMLElement,
  layer: HTMLElement,
  params: BrainParams,
  scene: { setOnCamera(cb: ((l: number, a: number, b: number) => void) | null): void },
): void {
  const frameEl = layer.querySelector<HTMLElement>(".stage-layer__frame");
  const scrimEl = layer.querySelector<HTMLElement>(".stage-layer__scrim");
  const reticleEl = layer.querySelector<HTMLElement>(".stage-layer__reticle");
  const statusEl = layer.querySelector<HTMLElement>(".scene-status");
  const corners = layer.querySelectorAll<HTMLElement>(".stage-layer__corner");
  const confBar = layer.querySelector<HTMLElement>(".stage-layer__confidence i b");
  const confText = layer.querySelector<HTMLElement>("[data-confidence]");
  const searchedEl = layer.querySelector<HTMLElement>("[data-searched]");
  const camEl = layer.querySelector<HTMLElement>("[data-cam]");

  const hud: Hud = { confidence: CONFIDENCE_IDLE, searched: 0 };
  const applyHud = () => {
    if (confBar) {
      const won = hud.confidence >= GATE_TAU;
      confBar.style.width = `${(hud.confidence * 100).toFixed(1)}%`;
      confBar.style.backgroundColor = won ? "var(--win)" : "var(--abstain)";
      confBar.style.boxShadow = won
        ? "0 0 10px rgba(70, 199, 154, 0.45)"
        : "0 0 10px rgba(139, 148, 161, 0.35)";
    }
    if (confText) confText.textContent = hud.confidence.toFixed(3);
    if (searchedEl) {
      searchedEl.textContent = Math.round(hud.searched).toLocaleString("en-US");
    }
  };
  applyHud();

  if (camEl) {
    let tick = 0;
    scene.setOnCamera((l, a, b) => {
      if (tick++ % 4 !== 0) return;
      camEl.textContent = `${l.toFixed(0)} · ${a.toFixed(0)} · ${b.toFixed(0)}`;
    });
  }

  const scrollRange = () => Math.max(1, stage.scrollHeight - window.innerHeight);
  // Progress when the beat element's center crosses the viewport center.
  // Rect differences are scroll-position independent, so beats can be
  // (re)measured at any time — in particular on every ScrollTrigger refresh.
  const beatAt = (name: string): number => {
    const el = stage.querySelector<HTMLElement>(`[data-beat="${name}"]`);
    if (!el) return 0;
    const stageRect = stage.getBoundingClientRect();
    const rect = el.getBoundingClientRect();
    const center =
      rect.top - stageRect.top + rect.height / 2 - window.innerHeight / 2;
    return Math.min(1, Math.max(0, center / scrollRange()));
  };

  let beats = { connect: 0.3, search: 0.5, match: 0.7, abstain: 0.9 };
  const syncPhase = (progress: number) => {
    const phase =
      progress < beats.search - 0.02
        ? "index"
        : progress < beats.match - 0.02
          ? "search"
          : progress < beats.abstain - 0.02
            ? "match"
            : "abstain";
    if (stage.dataset.scenePhase !== phase) stage.dataset.scenePhase = phase;
  };

  // One scrubbed timeline across the whole stage. Phase and HUD updates read
  // the timeline's own (smoothed) progress, so captions stay in sync with
  // the 3D beats instead of the raw scroll position.
  const tl = gsap.timeline({
    defaults: { ease: "none" },
    scrollTrigger: {
      trigger: stage,
      start: "top top",
      end: "bottom bottom",
      scrub: 1,
    },
  });
  tl.eventCallback("onUpdate", () => {
    syncPhase(tl.progress());
    applyHud();
  });

  /**
   * (Re)position every tween from freshly measured beat offsets. Runs on
   * ScrollTrigger "refresh" (resize, late font swaps, explicit refreshes),
   * so the choreography never desyncs from the copy — and it preserves the
   * current playhead and params instead of snapping back to defaults.
   */
  const layout = () => {
    const p = tl.progress();
    tl.clear();
    beats = {
      connect: beatAt("connect"),
      search: beatAt("search"),
      match: beatAt("match"),
      abstain: beatAt("abstain"),
    };
    const { connect, search, match, abstain } = beats;
    const span = (from: number, to: number, min = 0.04) =>
      Math.max(min, to - from);

    // The query traverses the map during the hero exit and lands as the
    // Search step arrives.
    tl.to(
      params,
      { targetProgress: 1, duration: span(0.03, search), ease: "power1.inOut" },
      0.03,
    );
    // Camera leg 1: hero wide → approach (through the Index step).
    tl.to(
      params,
      { camProgress: 0.25, duration: span(0.02, connect), ease: "power1.inOut" },
      0.02,
    );
    // Camera leg 2: the dive. The frame dissolves to full-bleed, the
    // composition shifts the subject right of the text column, and
    // incompatible history goes dark.
    tl.to(
      params,
      {
        camProgress: 0.6,
        composition: 1,
        constrain: 1,
        drift: 0.7,
        duration: span(connect, search),
        ease: "power2.inOut",
      },
      connect,
    );
    if (frameEl) {
      tl.to(
        frameEl,
        {
          top: 0,
          right: 0,
          bottom: 0,
          width: "100%",
          borderRadius: 0,
          borderColor: "rgba(154, 163, 178, 0)",
          duration: span(connect, search),
          ease: "power1.inOut",
        },
        connect,
      );
    }
    if (corners.length) {
      tl.to(
        corners,
        { opacity: 0, duration: span(connect, search, 0.03), ease: "power1.in" },
        connect,
      );
    }
    if (scrimEl) {
      tl.to(
        scrimEl,
        { opacity: 1, duration: span(connect, search), ease: "power1.inOut" },
        connect,
      );
    }
    // The camera's composition shift moves the subject right of the text
    // column; the reticle tracks it. The status readout slides to bottom
    // center so the scrolling step text no longer covers it.
    if (reticleEl) {
      tl.to(
        reticleEl,
        { left: "63%", duration: span(connect, search), ease: "power1.inOut" },
        connect,
      );
    }
    if (statusEl) {
      tl.to(
        statusEl,
        { left: "50%", xPercent: -50, duration: span(connect, search), ease: "power1.inOut" },
        connect,
      );
    }
    // Search → Recommend: the retrieval wave spreads outward from the query
    // while the camera closes in; the index scan counter runs to the real
    // record count.
    tl.to(
      params,
      { reveal: 1, camProgress: 0.82, duration: span(search, match) },
      search,
    );
    tl.to(
      hud,
      { confidence: CONFIDENCE_SEARCH, searched: TOTAL_RECORDS, duration: span(search, match) },
      search,
    );
    // The retrieved recipe is found: it ignites in its true color, lock
    // rings converge, and everything outside its evidence neighborhood
    // recedes. Confidence clears the gate.
    tl.to(params, { pulse: 1, duration: 0.04, ease: "power1.out" }, match);
    tl.to(params, { select: 1, duration: 0.05, ease: "power1.out" }, match);
    tl.to(hud, { confidence: CONFIDENCE_MATCH, duration: 0.04, ease: "power1.out" }, match);
    // Abstain: the camera pulls back and the network stills. Starts as the
    // Abstain step scrolls in, with room to breathe before the stage ends.
    const abstainAt = Math.min(0.94, Math.max(match + 0.04, abstain - 0.08));
    tl.to(
      params,
      {
        camProgress: 1,
        dim: 1,
        drift: 0.15,
        pulse: 0.25,
        duration: 1 - abstainAt,
        ease: "power1.inOut",
      },
      abstainAt,
    );
    tl.to(
      hud,
      { confidence: CONFIDENCE_ABSTAIN, duration: Math.min(0.06, 1 - abstainAt) },
      abstainAt,
    );
    tl.set({}, {}, 1); // pin timeline duration to 1 so beat positions map exactly
    tl.progress(p);
    syncPhase(tl.progress());
    applyHud();
  };

  ScrollTrigger.addEventListener("refresh", layout);
  layout();
}
