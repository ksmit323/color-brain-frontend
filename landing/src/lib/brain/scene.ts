/**
 * Three.js scene for the dye-history brain: one Points draw call (nodes),
 * one LineSegments draw call (retrieval edges), a single animated target
 * marker, and a faint neutral L* axis.
 *
 * GSAP never touches three directly — it mutates the shared `params` object
 * and the render loop copies those values into shader uniforms each frame.
 */

import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Line,
  LineBasicMaterial,
  LineSegments,
  PerspectiveCamera,
  Points,
  Scene,
  ShaderMaterial,
  Vector2,
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
  /** target color flight, 0 (offscreen) → 1 (landed on match) */
  targetProgress: number;
  parallaxX: number;
  parallaxY: number;
  /** pointer position in canvas clip space, feeding the proximity glow */
  pointerX: number;
  pointerY: number;
  /** 1 while the pointer is moving; set back to 0 after ~1.5s idle */
  pointerActive: number;
}

export const defaultParams = (): BrainParams => ({
  drift: 1,
  reveal: 0,
  pulse: 0,
  dim: 0,
  targetProgress: 0,
  parallaxX: 0,
  parallaxY: 0,
  pointerX: 0,
  pointerY: 0,
  pointerActive: 0,
});

export interface SceneHandle {
  start(): void;
  stop(): void;
  dispose(): void;
}

/** Shared ambient wander so edges follow their nodes exactly. The sine term
    keeps the slow drift; the value-noise term makes it read organic. */
const DRIFT_GLSL = `
  float cbHash(vec3 p) {
    p = fract(p * 0.1031);
    p += dot(p, p.zyx + 31.32);
    return fract((p.x + p.y) * p.z);
  }
  float cbNoise(vec3 p) {
    vec3 i = floor(p);
    vec3 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(mix(cbHash(i), cbHash(i + vec3(1, 0, 0)), f.x),
          mix(cbHash(i + vec3(0, 1, 0)), cbHash(i + vec3(1, 1, 0)), f.x), f.y),
      mix(mix(cbHash(i + vec3(0, 0, 1)), cbHash(i + vec3(1, 0, 1)), f.x),
          mix(cbHash(i + vec3(0, 1, 1)), cbHash(i + vec3(1, 1, 1)), f.x), f.y),
      f.z);
  }
  vec3 drifted(vec3 p, float t, float amp) {
    vec3 sine = amp * 1.7 * vec3(
      sin(t * 1.1 + p.y * 0.11),
      cos(t * 0.8 + p.x * 0.09),
      sin(t * 1.4 + p.z * 0.13)
    );
    vec3 organic = amp * 1.15 * (vec3(
      cbNoise(p * 0.045 + vec3(t * 0.22, 0.0, t * 0.13)),
      cbNoise(p * 0.045 + vec3(7.7, t * 0.18, 3.1)),
      cbNoise(p * 0.045 + vec3(t * 0.15, 9.2, t * 0.20))
    ) - 0.5);
    return p + sine + organic;
  }
`;

const NODE_VERT = `
  attribute vec3 aColor;
  attribute float aPhase;
  attribute float aDepth;
  uniform float uTime, uDrift, uPointScale;
  varying vec3 vColor;
  varying float vDepth;
  varying float vFog;
  varying vec2 vNdc;
  ${DRIFT_GLSL}
  void main() {
    vec3 p = drifted(position, uTime * 0.4, uDrift);
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    float breathe = 0.96 + 0.04 * sin(uTime * 0.8 + aPhase);
    float size = (1.1 + 0.9 * smoothstep(0.25, 0.0, aDepth)) * breathe;
    gl_PointSize = uPointScale * size / -mv.z;
    vColor = aColor;
    vDepth = aDepth;
    vFog = 1.0 - smoothstep(165.0, 285.0, -mv.z);
    vNdc = gl_Position.xy / gl_Position.w;
  }
`;

const NODE_FRAG = `
  precision highp float;
  uniform float uDim, uPulse, uTime, uAspect, uPointerStrength;
  uniform vec2 uPointer;
  varying vec3 vColor;
  varying float vDepth;
  varying float vFog;
  varying vec2 vNdc;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    float alpha = smoothstep(0.5, 0.1, d);
    float flare = uPulse * smoothstep(0.09, 0.0, vDepth);
    vec3 rgb = vColor * (0.95 + 2.6 * flare) + vec3(0.045) + vec3(1.3) * flare * smoothstep(0.3, 0.0, d);
    // Faint holographic scanline sweep.
    rgb *= 0.94 + 0.06 * sin(gl_FragCoord.y * 0.9 + uTime * 2.2);
    // Pointer proximity: nodes near the cursor take a --holo glow (#7fd8e8).
    vec2 pd = (vNdc - uPointer) * vec2(uAspect, 1.0);
    float prox = exp(-dot(pd, pd) * 34.0) * uPointerStrength;
    rgb += vec3(0.50, 0.85, 0.91) * prox * (0.35 + 0.65 * smoothstep(0.4, 0.0, d));
    gl_FragColor = vec4(
      rgb * (0.5 + 0.5 * vFog) * (1.0 - uDim * 0.85),
      alpha * (0.48 + 0.52 * vFog) * (0.8 + 0.2 * flare) + prox * 0.3 * alpha
    );
  }
`;

const EDGE_VERT = `
  attribute vec3 aColor;
  attribute float aOrder;
  uniform float uTime, uDrift;
  varying vec3 vColor;
  varying float vOrder;
  varying float vFog;
  ${DRIFT_GLSL}
  void main() {
    vec3 p = drifted(position, uTime * 0.4, uDrift);
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    vColor = aColor;
    vOrder = aOrder;
    vFog = 1.0 - smoothstep(165.0, 285.0, -mv.z);
  }
`;

const EDGE_FRAG = `
  precision highp float;
  uniform float uReveal, uDim;
  varying vec3 vColor;
  varying float vOrder;
  varying float vFog;
  void main() {
    float dt = uReveal - vOrder;
    float lit = step(0.0, dt);
    float front = lit * exp(-dt * 7.0);
    float intensity = 0.055 + lit * (0.12 + 0.6 * front);
    gl_FragColor = vec4(
      (vColor + vec3(0.12)) * intensity * (0.35 + 0.65 * vFog) * (1.0 - uDim * 0.9),
      1.0
    );
  }
`;

const TARGET_VERT = `
  uniform vec3 uStart, uEnd;
  uniform float uProgress, uPointScale;
  void main() {
    float eased = 1.0 - pow(1.0 - uProgress, 3.0);
    vec3 p = mix(uStart, uEnd, eased);
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = uPointScale * 4.6 / -mv.z;
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
  const cameraBase = new Vector3(105, 48, 175);
  const lookAt = new Vector3(8, 0, 6);

  const sharedUniforms = {
    uTime: { value: 0 },
    uDrift: { value: params.drift },
    uDim: { value: params.dim },
    uPointScale: { value: 1 },
    uAspect: { value: 1 },
  };

  const nodeGeometry = new BufferGeometry();
  nodeGeometry.setAttribute("position", new BufferAttribute(data.positions, 3));
  nodeGeometry.setAttribute("aColor", new BufferAttribute(data.colors, 3));
  nodeGeometry.setAttribute("aPhase", new BufferAttribute(data.phases, 1));
  nodeGeometry.setAttribute("aDepth", new BufferAttribute(data.depths, 1));
  const nodeMaterial = new ShaderMaterial({
    vertexShader: NODE_VERT,
    fragmentShader: NODE_FRAG,
    uniforms: {
      uTime: sharedUniforms.uTime,
      uDrift: sharedUniforms.uDrift,
      uDim: sharedUniforms.uDim,
      uPointScale: sharedUniforms.uPointScale,
      uAspect: sharedUniforms.uAspect,
      uPulse: { value: 0 },
      uPointer: { value: new Vector2(0, 0) },
      uPointerStrength: { value: 0 },
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
  const edgeMaterial = new ShaderMaterial({
    vertexShader: EDGE_VERT,
    fragmentShader: EDGE_FRAG,
    uniforms: {
      uTime: sharedUniforms.uTime,
      uDrift: sharedUniforms.uDrift,
      uDim: sharedUniforms.uDim,
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
      uEnd: { value: new Vector3(...data.target.end) },
      uColor: { value: new Vector3(...data.target.color) },
      uProgress: { value: 0 },
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
  function resize(): void {
    const parent = canvas.parentElement!;
    const w = parent.clientWidth;
    const h = parent.clientHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    sharedUniforms.uAspect.value = w / h;
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
  let pointerX = 0;
  let pointerY = 0;
  let pointerStrength = 0;

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
    lastTime = now;

    sharedUniforms.uTime.value = now / 1000;
    sharedUniforms.uDrift.value = params.drift;
    sharedUniforms.uDim.value = params.dim;
    nodeMaterial.uniforms.uPulse!.value = params.pulse;
    edgeMaterial.uniforms.uReveal!.value = params.reveal;
    targetMaterial.uniforms.uProgress!.value = params.targetProgress;

    // Proximity glow follows the pointer with a light trail; the strength
    // eases in on movement and back out after ~1.5s idle.
    pointerX += (params.pointerX - pointerX) * 0.14;
    pointerY += (params.pointerY - pointerY) * 0.14;
    pointerStrength += (params.pointerActive - pointerStrength) * 0.06;
    (nodeMaterial.uniforms.uPointer!.value as Vector2).set(pointerX, pointerY);
    nodeMaterial.uniforms.uPointerStrength!.value = pointerStrength;

    parallaxX += (params.parallaxX - parallaxX) * 0.055;
    parallaxY += (params.parallaxY - parallaxY) * 0.055;
    camera.position.set(cameraBase.x + parallaxX * 9, cameraBase.y + parallaxY * 6, cameraBase.z);
    camera.lookAt(lookAt);
    scene.rotation.y = Math.sin(now / 14000) * 0.028;

    renderer.render(scene, camera);
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
    dispose() {
      this.stop();
      resizeObserver.disconnect();
      nodeGeometry.dispose();
      edgeGeometry.dispose();
      targetGeometry.dispose();
      axisGeometry.dispose();
      nodeMaterial.dispose();
      edgeMaterial.dispose();
      targetMaterial.dispose();
      axis.material.dispose();
      renderer.dispose();
    },
  };
}
