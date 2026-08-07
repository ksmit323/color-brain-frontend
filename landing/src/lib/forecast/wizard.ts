/**
 * Forecast Outlook wizard — client-side step machine, calc binding, analytics.
 * Progressive: preset → tune → reveal. No network calls.
 */

import {
  type CategoryBreakdown,
  type ForecastInputs,
  type PresetId,
  calculateForecast,
  DEFAULT_PRESET_ID,
  formatUsd,
  getPreset,
} from "./model";

type Step = 1 | 2 | 3;

const INPUT_IDS = [
  "batchesPerMonth",
  "reworkPct",
  "costPerRework",
  "dyePerRework",
  "waterPerRework",
  "energyPerRework",
  "cycleMinutes",
] as const satisfies readonly (keyof ForecastInputs)[];

/** Breakdown keys that have matching `[data-out-cat]` nodes (excludes total). */
const BREAKDOWN_CATS = [
  "rework",
  "dye",
  "water",
  "energy",
  "time",
] as const satisfies readonly (keyof CategoryBreakdown)[];

/** Fire analytics to dataLayer when present. */
function track(event: string, props: Record<string, unknown> = {}): void {
  const payload = { event, ...props };
  const w = window as Window & { dataLayer?: Record<string, unknown>[] };
  w.dataLayer = w.dataLayer ?? [];
  w.dataLayer.push(payload);
  window.dispatchEvent(new CustomEvent("forecast:analytics", { detail: payload }));
}

function $(sel: string, root: ParentNode = document): HTMLElement | null {
  return root.querySelector(sel);
}

function $all(sel: string, root: ParentNode = document): HTMLElement[] {
  return Array.from(root.querySelectorAll(sel));
}

function readInputs(root: HTMLElement): ForecastInputs {
  const out = {} as ForecastInputs;
  for (const id of INPUT_IDS) {
    const el = root.querySelector<HTMLInputElement>(`#${id}`);
    out[id] = el ? parseFloat(el.value) || 0 : 0;
  }
  return out;
}

function writeInputs(root: HTMLElement, inputs: ForecastInputs): void {
  for (const id of INPUT_IDS) {
    const el = root.querySelector<HTMLInputElement>(`#${id}`);
    if (el) el.value = String(inputs[id]);
  }
}

function setText(el: HTMLElement | null, value: string): void {
  if (el && el.textContent !== value) el.textContent = value;
}

function markPresetSelected(root: HTMLElement, id: PresetId): void {
  for (const b of $all("[data-preset]", root)) {
    const on = b.getAttribute("data-preset") === id;
    b.classList.toggle("is-selected", on);
    b.setAttribute("aria-pressed", on ? "true" : "false");
  }
}

function setStep(
  root: HTMLElement,
  step: Step,
  opts: { focus?: boolean } = {},
): void {
  root.dataset.step = String(step);
  for (const panel of $all("[data-step-panel]", root)) {
    const n = Number(panel.getAttribute("data-step-panel"));
    const active = n === step;
    panel.hidden = !active;
    panel.setAttribute("aria-hidden", active ? "false" : "true");
  }
  for (const pill of $all("[data-step-indicator]", root)) {
    const n = Number(pill.getAttribute("data-step-indicator"));
    pill.classList.toggle("is-active", n === step);
    pill.classList.toggle("is-done", n < step);
    pill.setAttribute("aria-current", n === step ? "step" : "false");
  }
  // Focus first focusable when the user moves steps (keyboard flow). Skip on
  // initial load so the default preset is not outlined until they interact.
  if (opts.focus === false) return;
  const panel = root.querySelector<HTMLElement>(
    `[data-step-panel="${step}"]:not([hidden])`,
  );
  const focusable = panel?.querySelector<HTMLElement>(
    'button:not([disabled]), input:not([disabled]), [href], summary, [tabindex]:not([tabindex="-1"])',
  );
  focusable?.focus({ preventScroll: true });
}

const animFrames = new WeakMap<HTMLElement, number>();

function animateValue(
  el: HTMLElement,
  target: number,
  reduced: boolean,
): void {
  const prev = animFrames.get(el);
  if (prev != null) cancelAnimationFrame(prev);

  if (reduced) {
    setText(el, formatUsd(target));
    animFrames.delete(el);
    return;
  }

  const duration = 900;
  const start = performance.now();
  const tick = (now: number) => {
    const t = Math.min(1, (now - start) / duration);
    const eased = 1 - Math.pow(1 - t, 3);
    el.textContent = formatUsd(target * eased);
    if (t < 1) {
      animFrames.set(el, requestAnimationFrame(tick));
    } else {
      animFrames.delete(el);
      // Snap to final formatted value (avoids float-easing drift at t=1).
      el.textContent = formatUsd(target);
    }
  };
  animFrames.set(el, requestAnimationFrame(tick));
}

function updatePreview(root: HTMLElement, inputs: ForecastInputs): void {
  const result = calculateForecast(inputs);
  setText($("[data-preview-value]", root), formatUsd(result.annual.expected));
}

function renderResult(
  root: HTMLElement,
  inputs: ForecastInputs,
  opts: { animate: boolean; reduced: boolean },
): void {
  const result = calculateForecast(inputs);

  const cons = $("[data-out-conservative]", root);
  const exp = $("[data-out-expected]", root);
  const opt = $("[data-out-optimistic]", root);
  if (opts.animate) {
    if (cons) animateValue(cons, result.annual.conservative, opts.reduced);
    if (exp) animateValue(exp, result.annual.expected, opts.reduced);
    if (opt) animateValue(opt, result.annual.optimistic, opts.reduced);
  } else {
    setText(cons, formatUsd(result.annual.conservative));
    setText(exp, formatUsd(result.annual.expected));
    setText(opt, formatUsd(result.annual.optimistic));
  }

  for (const key of BREAKDOWN_CATS) {
    setText($(`[data-out-cat="${key}"]`, root), formatUsd(result.breakdown[key]));
  }

  setText(
    $("[data-out-meta]", root),
    `${Math.round(result.annualBatches).toLocaleString("en-US")} batches/yr · ~${Math.round(result.currentReworkBatches).toLocaleString("en-US")} reworks today · ~${Math.round(result.avoidedReworkExpected).toLocaleString("en-US")} avoided (expected)`,
  );

  setText($("[data-preview-value]", root), formatUsd(result.annual.expected));
}

export function initForecastWizard(root: HTMLElement): void {
  let selectedPreset: PresetId = DEFAULT_PRESET_ID;
  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
  let prefersReduced = reducedMotion.matches;
  reducedMotion.addEventListener("change", () => {
    prefersReduced = reducedMotion.matches;
  });

  const defaultInputs = getPreset(DEFAULT_PRESET_ID).inputs;
  writeInputs(root, defaultInputs);
  renderResult(root, defaultInputs, { animate: false, reduced: prefersReduced });
  setStep(root, 1, { focus: false });


  track("forecast_view", { path: "/forecast" });

  for (const btn of $all("[data-preset]", root)) {
    const id = btn.getAttribute("data-preset") as PresetId;
    const on = id === DEFAULT_PRESET_ID;
    btn.classList.toggle("is-selected", on);
    btn.setAttribute("aria-pressed", on ? "true" : "false");

    btn.addEventListener("click", () => {
      selectedPreset = id;
      const preset = getPreset(id);
      writeInputs(root, preset.inputs);
      renderResult(root, preset.inputs, {
        animate: false,
        reduced: prefersReduced,
      });
      markPresetSelected(root, id);
      track("forecast_preset_select", { preset: id });
    });
  }

  let previewRaf: number | null = null;
  for (const id of INPUT_IDS) {
    const el = root.querySelector<HTMLInputElement>(`#${id}`);
    el?.addEventListener("input", () => {
      if (previewRaf != null) return;
      previewRaf = requestAnimationFrame(() => {
        previewRaf = null;
        updatePreview(root, readInputs(root));
      });
    });
  }

  root.querySelector("[data-goto-2]")?.addEventListener("click", () => {
    setStep(root, 2);
  });
  root.querySelector("[data-goto-3]")?.addEventListener("click", () => {
    const inputs = readInputs(root);
    renderResult(root, inputs, { animate: true, reduced: prefersReduced });
    setStep(root, 3);
    track("forecast_reveal", {
      preset: selectedPreset,
      ...inputs,
    });
    const panel = root.querySelector("[data-step-panel='3']");
    panel?.classList.remove("is-revealed");
    // force reflow so re-adding is-revealed restarts CSS entrance
    void (panel as HTMLElement | null)?.offsetWidth;
    panel?.classList.add("is-revealed");
  });
  root.querySelector("[data-back-1]")?.addEventListener("click", () => {
    setStep(root, 1);
  });
  root.querySelector("[data-back-2]")?.addEventListener("click", () => {
    setStep(root, 2);
  });

  root.querySelector("[data-cta-pilot]")?.addEventListener("click", () => {
    track("forecast_cta_click", { cta: "book_pilot" });
  });

  root.querySelector("[data-cta-copy]")?.addEventListener("click", async (e) => {
    e.preventDefault();
    track("forecast_cta_click", { cta: "copy_link" });
    const btn = e.currentTarget as HTMLButtonElement;
    const url = window.location.href;
    try {
      await navigator.clipboard.writeText(url);
      const prev = btn.textContent;
      btn.textContent = "Link copied";
      btn.setAttribute("aria-live", "polite");
      setTimeout(() => {
        btn.textContent = prev;
      }, 1800);
    } catch {
      window.prompt("Copy this link:", url);
    }
  });
}
