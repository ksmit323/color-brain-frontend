/**
 * Three.js scene for the dye-history brain: one Points draw call (nodes),
 * one LineSegments draw call (retrieval edges), an animated query marker
 * with a fading trail, and a faint neutral L* axis.
 *
 * The camera flies a keyframed path through the CIELAB space — wide hero
 * shot, approach, dive into the query's cluster, close-up on the retrieved
 * recipe, high pull-back for the abstention. GSAP never touches three
 * directly — it mutates the shared `params` object and the render loop
 * copies those values into shader uniforms and camera curves each frame.
 */

import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  CatmullRomCurve3,
  DynamicDrawUsage,
  Line,
  LineBasicMaterial,
  LineSegments,
  NormalBlending,
  PerspectiveCamera,
  Points,
  Scene,
  ShaderMaterial,
  Vector3,
  WebGLRenderer,
} from "three";
import type { BrainData } from "./data";

/** Animation state written by GSAP (or left at defaults in ambient mode). */
export interface BrainParams {
  /** ambient wander amplitude, 1 = full, ~0 = still */
  drift: number;
  /** retrieval propagation front, 0 → 1 */
  reveal: number;
  /** match-node flare, 0 → 1 */
  pulse: number;
  /** abstention darkening, 0 → 1 */
  dim: number;
  /** query color flight, 0 (offscreen) → 1 (landed at its Lab point) */
  targetProgress: number;
  /** camera position along the flight path, 0 (hero wide) → 1 (pull-back) */
  camProgress: number;
  /** substrate constraint, 0 → 1: incompatible history fades to gray */
  constrain: number;
  /** selection, 0 → 1: the retrieved recipe owns the scene */
  select: number;
  /** composition shift, 0 (centered) → 1 (subject right of the text column) */
  composition: number;
  parallaxX: number;
  parallaxY: number;
}

export const defaultParams = (): BrainParams => ({
  drift: 1,
  reveal: 0,
  pulse: 0,
  dim: 0,
  targetProgress: 0,
  camProgress: 0,
  constrain: 0,
  select: 0,
  composition: 0,
  parallaxX: 0,
  parallaxY: 0,
});

export interface SceneHandle {
  start(): void;
  stop(): void;
  dispose(): void;
  /** Per-frame camera position reported back in pseudo-Lab units for the
      HUD telemetry readout. */
  setOnCamera(cb: ((l: number, a: number, b: number) => void) | null): void;
}

/** Shared ambient wander so edges follow their nodes exactly. */
const DRIFT_GLSL = `
  vec3 drifted(vec3 p, float t, float amp) {
    return p + amp * 1.7 * vec3(
      sin(t * 1.1 + p.y * 0.11),
      cos(t * 0.8 + p.x * 0.09),
      sin(t * 1.4 + p.z * 0.13)
    );
  }
`;

/* Nodes closer than ~12 world units fade out so the camera passes through
   the constellation like mist instead of filling the screen with blobs. */
const NODE_VERT = `
  attribute vec3 aColor;
  attribute float aPhase;
  attribute float aDepth;
  attribute float aCompat;
  uniform float uTime, uDrift, uPointScale, uConstrain;
  varying vec3 vColor;
  varying float vDepth;
  varying float vFog;
  varying float vCompat;
  ${DRIFT_GLSL}
  void main() {
    vec3 p = drifted(position, uTime * 0.4, uDrift);
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    float breathe = 0.96 + 0.04 * sin(uTime * 0.8 + aPhase);
    float size = (1.1 + 0.9 * smoothstep(0.25, 0.0, aDepth)) * breathe;
    size *= 1.0 - (1.0 - aCompat) * uConstrain * 0.4;
    gl_PointSize = min(uPointScale * size / -mv.z, uPointScale * 0.022);
    vColor = aColor;
    vDepth = aDepth;
    vCompat = aCompat;
    vFog = (1.0 - smoothstep(165.0, 285.0, -mv.z)) * smoothstep(3.0, 14.0, -mv.z);
  }
`;

const NODE_FRAG = `
  precision highp float;
  uniform float uDim, uPulse, uConstrain, uSelect;
  varying vec3 vColor;
  varying float vDepth;
  varying float vFog;
  varying float vCompat;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    float alpha = smoothstep(0.5, 0.1, d);
    float flare = uPulse * smoothstep(0.09, 0.0, vDepth);
    // Incompatible history goes dark but keeps its hue — the map stays
    // chromatic, only the brightness leaves.
    float incomp = (1.0 - vCompat) * uConstrain;
    vec3 base = mix(vColor, vColor * 0.22 + vec3(0.008), incomp);
    vec3 rgb = base * (0.95 + 2.2 * flare) + vec3(0.045)
      + vec3(0.55) * flare * smoothstep(0.12, 0.0, d);
    // Selection: once the recipe is found, everything away from its evidence
    // neighborhood recedes so the found color owns the scene.
    float away = uSelect * smoothstep(0.04, 0.22, vDepth);
    rgb *= 1.0 - away * 0.62;
    alpha *= 1.0 - away * 0.45;
    gl_FragColor = vec4(
      rgb * (0.5 + 0.5 * vFog) * (1.0 - uDim * 0.85),
      alpha * (0.48 + 0.52 * vFog) * (0.8 + 0.2 * flare) * (1.0 - incomp * 0.45)
    );
  }
`;

const EDGE_VERT = `
  attribute vec3 aColor;
  attribute float aOrder;
  attribute float aCompat;
  uniform float uTime, uDrift;
  varying vec3 vColor;
  varying float vOrder;
  varying float vFog;
  varying float vCompat;
  ${DRIFT_GLSL}
  void main() {
    vec3 p = drifted(position, uTime * 0.4, uDrift);
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    vColor = aColor;
    vOrder = aOrder;
    vCompat = aCompat;
    vFog = 1.0 - smoothstep(165.0, 285.0, -mv.z);
  }
`;

const EDGE_FRAG = `
  precision highp float;
  uniform float uReveal, uDim, uConstrain, uSelect;
  varying vec3 vColor;
  varying float vOrder;
  varying float vFog;
  varying float vCompat;
  void main() {
    float dt = uReveal - vOrder;
    float lit = step(0.0, dt);
    float front = lit * exp(-dt * 7.0);
    float intensity = 0.055 + lit * (0.12 + 0.6 * front);
    intensity *= 1.0 - (1.0 - vCompat) * uConstrain * 0.7;
    // The wave recedes once the recipe is found — the found node takes over.
    intensity *= 1.0 - uSelect * 0.55;
    gl_FragColor = vec4(
      (vColor + vec3(0.12)) * intensity * (0.35 + 0.65 * vFog) * (1.0 - uDim * 0.9),
      1.0
    );
  }
`;

const TARGET_VERT = `
  uniform vec3 uStart, uEnd;
  uniform float uProgress, uPointScale, uSelect;
  void main() {
    float eased = 1.0 - pow(1.0 - uProgress, 3.0);
    vec3 p = mix(uStart, uEnd, eased);
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    // Once the recipe is found, the query yields the spotlight to it.
    gl_PointSize = min(uPointScale * 4.6 * (1.0 - 0.4 * uSelect) / -mv.z, uPointScale * 0.075);
  }
`;

const TARGET_FRAG = `
  precision highp float;
  uniform vec3 uColor;
  uniform float uProgress, uDim;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    float halo = smoothstep(0.5, 0.05, d);
    float core = smoothstep(0.18, 0.02, d);
    float visible = smoothstep(0.0, 0.08, uProgress);
    vec3 rgb = (uColor * 1.8 * halo + vec3(1.0) * core * 1.2) * visible;
    gl_FragColor = vec4(rgb * (1.0 - uDim * 0.7), halo * visible);
  }
`;

/* The retrieved recipe revealed as what it actually is: a color. A solid
   disc of the recipe's true Lab→sRGB color ignites at the match node when
   the selection lands. */
const ORB_VERT = `
  uniform float uSelect, uTime, uPointScale;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mv;
    float s = smoothstep(0.0, 1.0, uSelect);
    float pulse = 1.0 + 0.05 * sin(uTime * 2.6) * s;
    gl_PointSize = min(uPointScale * 13.0 * s * pulse / -mv.z, uPointScale * 0.07);
  }
`;

const ORB_FRAG = `
  precision highp float;
  uniform vec3 uColor;
  uniform float uSelect;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    float disc = smoothstep(0.5, 0.44, d);
    float vis = smoothstep(0.03, 0.3, uSelect);
    // Nearly opaque: the disc shows the recipe's true color, not a glow.
    vec3 rgb = uColor * (0.95 + 0.22 * smoothstep(0.5, 0.1, d)) + vec3(0.02);
    gl_FragColor = vec4(rgb, disc * vis * 0.96);
  }
`;

/* Expanding sonar rings. Used twice: white rings pulse outward from the
   query while retrieval runs; win-green rings lock onto the retrieved
   recipe once it is found. */
const RING_VERT = `
  uniform float uSize, uPointScale;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = min(uPointScale * uSize / -mv.z, uPointScale * 0.18);
  }
`;

const RING_FRAG = `
  precision highp float;
  uniform float uOn, uTime;
  uniform vec3 uColor;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    float t1 = fract(uTime * 0.5);
    float t2 = fract(uTime * 0.5 + 0.5);
    float ring =
      smoothstep(0.03, 0.0, abs(d - t1 * 0.48)) * (1.0 - t1) +
      smoothstep(0.03, 0.0, abs(d - t2 * 0.48)) * (1.0 - t2);
    gl_FragColor = vec4(uColor * ring * uOn, ring * uOn);
  }
`;

/** Points in the query marker's trail. */
const TRAIL_LENGTH = 24;

export function createScene(
  canvas: HTMLCanvasElement,
  data: BrainData,
  params: BrainParams,
  onFirstFrame: () => void,
): SceneHandle | null {
  let renderer: WebGLRenderer;
  try {
    renderer = new WebGLRenderer({
      canvas,
      antialias: false,
      alpha: true,
      powerPreference: "high-performance",
    });
  } catch {
    return null;
  }
  renderer.setClearColor(0x07080c, 0);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));

  const scene = new Scene();
  const camera = new PerspectiveCamera(40, 1, 1, 1000);

  // --- Flight path: hero wide → approach → dive to the query → close-up on
  //     the retrieved recipe → high pull-back. Sampled by params.camProgress;
  //     tween segment eases give each leg its cinematic acceleration. ---
  const queryPos = new Vector3(...data.target.end);
  const matchPos = new Vector3(...data.match.pos);
  const positionCurve = new CatmullRomCurve3(
    [
      new Vector3(105, 48, 175),
      new Vector3(queryPos.x - 55, queryPos.y + 42, queryPos.z + 92),
      new Vector3(queryPos.x + 15, queryPos.y + 9, queryPos.z + 23),
      new Vector3(matchPos.x + 8, matchPos.y + 5, matchPos.z + 12),
      new Vector3(26, 72, 128),
    ],
    false,
    "centripetal",
  );
  const lookCurve = new CatmullRomCurve3(
    [
      new Vector3(8, 0, 6),
      queryPos.clone().add(new Vector3(-14, 10, 6)),
      queryPos.clone(),
      matchPos.clone(),
      new Vector3(4, 0, 2),
    ],
    false,
    "centripetal",
  );
  const camPos = new Vector3(105, 48, 175);
  const lookPos = new Vector3(8, 0, 6);

  const sharedUniforms = {
    uTime: { value: 0 },
    uDrift: { value: params.drift },
    uDim: { value: params.dim },
    uConstrain: { value: params.constrain },
    uSelect: { value: params.select },
    uPointScale: { value: 1 },
  };

  const nodeGeometry = new BufferGeometry();
  nodeGeometry.setAttribute("position", new BufferAttribute(data.positions, 3));
  nodeGeometry.setAttribute("aColor", new BufferAttribute(data.colors, 3));
  nodeGeometry.setAttribute("aPhase", new BufferAttribute(data.phases, 1));
  nodeGeometry.setAttribute("aDepth", new BufferAttribute(data.depths, 1));
  nodeGeometry.setAttribute("aCompat", new BufferAttribute(data.compat, 1));
  const nodeMaterial = new ShaderMaterial({
    vertexShader: NODE_VERT,
    fragmentShader: NODE_FRAG,
    uniforms: {
      uTime: sharedUniforms.uTime,
      uDrift: sharedUniforms.uDrift,
      uDim: sharedUniforms.uDim,
      uConstrain: sharedUniforms.uConstrain,
      uSelect: sharedUniforms.uSelect,
      uPointScale: sharedUniforms.uPointScale,
      uPulse: { value: 0 },
    },
    transparent: true,
    depthTest: false,
    depthWrite: false,
    blending: AdditiveBlending,
  });
  const points = new Points(nodeGeometry, nodeMaterial);
  points.frustumCulled = false;
  scene.add(points);

  const edgeGeometry = new BufferGeometry();
  edgeGeometry.setAttribute("position", new BufferAttribute(data.edgePositions, 3));
  edgeGeometry.setAttribute("aColor", new BufferAttribute(data.edgeColors, 3));
  edgeGeometry.setAttribute("aOrder", new BufferAttribute(data.edgeOrders, 1));
  edgeGeometry.setAttribute("aCompat", new BufferAttribute(data.edgeCompat, 1));
  const edgeMaterial = new ShaderMaterial({
    vertexShader: EDGE_VERT,
    fragmentShader: EDGE_FRAG,
    uniforms: {
      uTime: sharedUniforms.uTime,
      uDrift: sharedUniforms.uDrift,
      uDim: sharedUniforms.uDim,
      uConstrain: sharedUniforms.uConstrain,
      uSelect: sharedUniforms.uSelect,
      uReveal: { value: 0 },
    },
    transparent: true,
    depthTest: false,
    depthWrite: false,
    blending: AdditiveBlending,
  });
  const edges = new LineSegments(edgeGeometry, edgeMaterial);
  edges.frustumCulled = false;
  scene.add(edges);

  const targetGeometry = new BufferGeometry();
  targetGeometry.setAttribute("position", new BufferAttribute(new Float32Array(3), 3));
  const targetMaterial = new ShaderMaterial({
    vertexShader: TARGET_VERT,
    fragmentShader: TARGET_FRAG,
    uniforms: {
      uStart: { value: new Vector3(...data.target.start) },
      uEnd: { value: queryPos },
      uColor: { value: new Vector3(...data.target.color) },
      uProgress: { value: 0 },
      uSelect: sharedUniforms.uSelect,
      uDim: sharedUniforms.uDim,
      uPointScale: sharedUniforms.uPointScale,
    },
    transparent: true,
    depthTest: false,
    depthWrite: false,
    blending: AdditiveBlending,
  });
  const targetMarker = new Points(targetGeometry, targetMaterial);
  targetMarker.frustumCulled = false;
  scene.add(targetMarker);

  // --- Query trail: a short line of recent query positions, fading to black
  //     (invisible under additive blending) along its length. ---
  const trailPositions = new Float32Array(TRAIL_LENGTH * 3);
  const trailColors = new Float32Array(TRAIL_LENGTH * 3);
  trailPositions.set(data.target.start);
  for (let i = 1; i < TRAIL_LENGTH; i++) trailPositions.set(data.target.start, i * 3);
  const trailGeometry = new BufferGeometry();
  const trailPositionAttr = new BufferAttribute(trailPositions, 3);
  const trailColorAttr = new BufferAttribute(trailColors, 3);
  trailPositionAttr.setUsage(DynamicDrawUsage);
  trailColorAttr.setUsage(DynamicDrawUsage);
  trailGeometry.setAttribute("position", trailPositionAttr);
  trailGeometry.setAttribute("color", trailColorAttr);
  const trailMaterial = new LineBasicMaterial({
    vertexColors: true,
    transparent: true,
    depthTest: false,
    depthWrite: false,
    blending: AdditiveBlending,
  });
  const trail = new Line(trailGeometry, trailMaterial);
  trail.frustumCulled = false;
  scene.add(trail);
  const queryStart = data.target.start;
  const queryColor = data.target.color;

  // --- The "found it" trio: a solid disc of the retrieved recipe's true
  //     color at the match node, win-green lock rings on it, and white sonar
  //     rings pulsing from the query while retrieval runs. ---
  const singlePoint = (pos: Vector3): BufferGeometry => {
    const g = new BufferGeometry();
    g.setAttribute("position", new BufferAttribute(new Float32Array([pos.x, pos.y, pos.z]), 3));
    return g;
  };

  const orbGeometry = singlePoint(matchPos);
  const orbMaterial = new ShaderMaterial({
    vertexShader: ORB_VERT,
    fragmentShader: ORB_FRAG,
    uniforms: {
      uColor: { value: new Vector3(...data.match.color) },
      uSelect: sharedUniforms.uSelect,
      uTime: sharedUniforms.uTime,
      uPointScale: sharedUniforms.uPointScale,
    },
    transparent: true,
    depthTest: false,
    depthWrite: false,
    blending: NormalBlending,
  });
  const orb = new Points(orbGeometry, orbMaterial);
  orb.frustumCulled = false;
  // Drawn after the additive sprites so the true color occludes the flare.
  orb.renderOrder = 10;
  scene.add(orb);

  const queryRingGeometry = singlePoint(queryPos);
  const queryRingMaterial = new ShaderMaterial({
    vertexShader: RING_VERT,
    fragmentShader: RING_FRAG,
    uniforms: {
      uSize: { value: 22 },
      uColor: { value: new Vector3(0.85, 0.87, 0.92) },
      uOn: { value: 0 },
      uTime: sharedUniforms.uTime,
      uPointScale: sharedUniforms.uPointScale,
    },
    transparent: true,
    depthTest: false,
    depthWrite: false,
    blending: AdditiveBlending,
  });
  const queryRings = new Points(queryRingGeometry, queryRingMaterial);
  queryRings.frustumCulled = false;
  queryRings.renderOrder = 11;
  scene.add(queryRings);

  const matchRingGeometry = singlePoint(matchPos);
  const matchRingMaterial = new ShaderMaterial({
    vertexShader: RING_VERT,
    fragmentShader: RING_FRAG,
    uniforms: {
      uSize: { value: 15 },
      // --win (#46c79a): the lock-on signal.
      uColor: { value: new Vector3(0.275, 0.78, 0.604) },
      uOn: { value: 0 },
      uTime: sharedUniforms.uTime,
      uPointScale: sharedUniforms.uPointScale,
    },
    transparent: true,
    depthTest: false,
    depthWrite: false,
    blending: AdditiveBlending,
  });
  const matchRings = new Points(matchRingGeometry, matchRingMaterial);
  matchRings.frustumCulled = false;
  matchRings.renderOrder = 12;
  scene.add(matchRings);

  // Neutral axis: the a*=b*=0 line of CIELAB — gray from black to white.
  const axisGeometry = new BufferGeometry();
  axisGeometry.setAttribute(
    "position",
    new BufferAttribute(new Float32Array([0, -58, 0, 0, 58, 0]), 3),
  );
  const axis = new Line(
    axisGeometry,
    new LineBasicMaterial({ color: 0x9aa3b2, transparent: true, opacity: 0.16 }),
  );
  scene.add(axis);

  // --- sizing ---
  let viewW = 1;
  let viewH = 1;
  let viewOffsetApplied = false;
  function resize(): void {
    const parent = canvas.parentElement!;
    const w = parent.clientWidth;
    const h = parent.clientHeight;
    viewW = Math.max(1, w);
    viewH = Math.max(1, h);
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    // Perspective-correct point sizing: world units → device pixels at
    // distance 1 (gl_PointSize is specified in device pixels).
    const fovScale = h / (2 * Math.tan((camera.fov * Math.PI) / 360));
    sharedUniforms.uPointScale.value = fovScale * renderer.getPixelRatio();
  }
  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(canvas.parentElement!);
  resize();

  // --- render loop with adaptive degrade ---
  let raf = 0;
  let running = false;
  let firstFrame = true;
  let frameCount = 0;
  let frameAccum = 0;
  let lastTime = 0;
  let degradeStep = 0;
  let parallaxX = 0;
  let parallaxY = 0;
  let onCamera: ((l: number, a: number, b: number) => void) | null = null;

  function degrade(): void {
    degradeStep += 1;
    if (degradeStep === 1) {
      renderer.setPixelRatio(1);
      resize();
    } else if (degradeStep === 2) {
      nodeGeometry.setDrawRange(0, Math.floor(data.nodeCount / 2));
      edgeGeometry.setDrawRange(0, 2 * Math.floor(data.edgeVertexCount / 4));
    }
  }

  function frame(now: number): void {
    if (!running) return;
    raf = requestAnimationFrame(frame);

    if (lastTime > 0 && degradeStep < 2) {
      frameAccum += now - lastTime;
      frameCount += 1;
      if (frameCount >= 90) {
        if (frameAccum / frameCount > 22) degrade();
        frameCount = 0;
        frameAccum = 0;
      }
    }
    const dt = lastTime > 0 ? Math.min(0.1, (now - lastTime) / 1000) : 0.016;
    lastTime = now;

    sharedUniforms.uTime.value = now / 1000;
    sharedUniforms.uDrift.value = params.drift;
    sharedUniforms.uDim.value = params.dim;
    sharedUniforms.uConstrain.value = params.constrain;
    sharedUniforms.uSelect.value = params.select;
    nodeMaterial.uniforms.uPulse!.value = params.pulse;
    edgeMaterial.uniforms.uReveal!.value = params.reveal;
    targetMaterial.uniforms.uProgress!.value = params.targetProgress;

    // Sonar from the query while retrieval runs; lock rings once found.
    // Both go quiet as the abstention dims the scene.
    const quiet = 1 - params.dim * 0.85;
    queryRingMaterial.uniforms.uOn!.value =
      params.reveal * (1 - params.select) * Math.min(1, params.targetProgress * 6) * quiet;
    matchRingMaterial.uniforms.uOn!.value = params.select * quiet;

    // Camera along the flight path; pointer parallax fades as we go deeper.
    positionCurve.getPoint(params.camProgress, camPos);
    lookCurve.getPoint(params.camProgress, lookPos);
    const k = 1 - Math.exp(-dt * 4);
    parallaxX += (params.parallaxX - parallaxX) * k;
    parallaxY += (params.parallaxY - parallaxY) * k;
    const parallaxScale = 1 - 0.7 * params.camProgress;
    camera.position.set(
      camPos.x + parallaxX * 9 * parallaxScale,
      camPos.y + parallaxY * 6 * parallaxScale,
      camPos.z,
    );
    camera.lookAt(lookPos);
    scene.rotation.y = Math.sin(now / 14000) * 0.028 * (1 - params.camProgress);

    // Composition shift: at full-bleed the subject moves right of the text
    // column by rendering a view shifted off-center.
    if (params.composition > 0.001) {
      camera.setViewOffset(
        viewW,
        viewH,
        -viewW * 0.13 * params.composition,
        0,
        viewW,
        viewH,
      );
      viewOffsetApplied = true;
    } else if (viewOffsetApplied) {
      camera.clearViewOffset();
      viewOffsetApplied = false;
    }

    // Query trail follows the same eased flight as the target marker.
    const p = params.targetProgress;
    const eased = 1 - Math.pow(1 - p, 3);
    trailPositions.copyWithin(3, 0, (TRAIL_LENGTH - 1) * 3);
    trailPositions[0] = queryStart[0] + (queryPos.x - queryStart[0]) * eased;
    trailPositions[1] = queryStart[1] + (queryPos.y - queryStart[1]) * eased;
    trailPositions[2] = queryStart[2] + (queryPos.z - queryStart[2]) * eased;
    const visible = Math.min(1, p * 12) * (1 - Math.max(0, (p - 0.92) / 0.08) * 0.85);
    for (let i = 0; i < TRAIL_LENGTH; i++) {
      const fade = Math.pow(1 - i / TRAIL_LENGTH, 1.6) * visible;
      trailColors[i * 3] = queryColor[0] * fade;
      trailColors[i * 3 + 1] = queryColor[1] * fade;
      trailColors[i * 3 + 2] = queryColor[2] * fade;
    }
    trailPositionAttr.needsUpdate = true;
    trailColorAttr.needsUpdate = true;

    renderer.render(scene, camera);

    if (onCamera) {
      // Pseudo-Lab readout: the inverse of the scene's Lab → xyz mapping.
      onCamera(camera.position.y / 1.1 + 50, camera.position.x, camera.position.z);
    }

    if (firstFrame) {
      firstFrame = false;
      onFirstFrame();
    }
  }

  return {
    start() {
      if (running) return;
      running = true;
      lastTime = 0;
      raf = requestAnimationFrame(frame);
    },
    stop() {
      running = false;
      cancelAnimationFrame(raf);
    },
    setOnCamera(cb) {
      onCamera = cb;
    },
    dispose() {
      this.stop();
      resizeObserver.disconnect();
      nodeGeometry.dispose();
      edgeGeometry.dispose();
      targetGeometry.dispose();
      trailGeometry.dispose();
      orbGeometry.dispose();
      queryRingGeometry.dispose();
      matchRingGeometry.dispose();
      axisGeometry.dispose();
      nodeMaterial.dispose();
      edgeMaterial.dispose();
      targetMaterial.dispose();
      trailMaterial.dispose();
      orbMaterial.dispose();
      queryRingMaterial.dispose();
      matchRingMaterial.dispose();
      axis.material.dispose();
      renderer.dispose();
    },
  };
}
