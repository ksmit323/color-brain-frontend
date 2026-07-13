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
}

export const defaultParams = (): BrainParams => ({
  drift: 1,
  reveal: 0,
  pulse: 0,
  dim: 0,
  targetProgress: 0,
  parallaxX: 0,
  parallaxY: 0,
});

export interface SceneHandle {
  start(): void;
  stop(): void;
  dispose(): void;
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

const NODE_VERT = `
  attribute vec3 aColor;
  attribute float aPhase;
  attribute float aDepth;
  uniform float uTime, uDrift, uPointScale;
  varying vec3 vColor;
  varying float vDepth;
  ${DRIFT_GLSL}
  void main() {
    vec3 p = drifted(position, uTime * 0.4 + aPhase, uDrift);
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    float size = 1.1 + 0.9 * smoothstep(0.25, 0.0, aDepth);
    gl_PointSize = uPointScale * size / -mv.z;
    vColor = aColor;
    vDepth = aDepth;
  }
`;

const NODE_FRAG = `
  precision highp float;
  uniform float uDim, uPulse;
  varying vec3 vColor;
  varying float vDepth;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    float alpha = smoothstep(0.5, 0.1, d);
    float flare = uPulse * smoothstep(0.09, 0.0, vDepth);
    vec3 rgb = vColor * (0.95 + 2.6 * flare) + vec3(0.045) + vec3(1.3) * flare * smoothstep(0.3, 0.0, d);
    gl_FragColor = vec4(rgb * (1.0 - uDim * 0.85), alpha * (0.8 + 0.2 * flare));
  }
`;

const EDGE_VERT = `
  attribute vec3 aColor;
  attribute float aOrder;
  uniform float uTime, uDrift;
  varying vec3 vColor;
  varying float vOrder;
  ${DRIFT_GLSL}
  void main() {
    vec3 p = drifted(position, uTime * 0.4, uDrift);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
    vColor = aColor;
    vOrder = aOrder;
  }
`;

const EDGE_FRAG = `
  precision highp float;
  uniform float uReveal, uDim;
  varying vec3 vColor;
  varying float vOrder;
  void main() {
    float dt = uReveal - vOrder;
    float lit = step(0.0, dt);
    float front = lit * exp(-dt * 7.0);
    float intensity = 0.055 + lit * (0.12 + 0.6 * front);
    gl_FragColor = vec4((vColor + vec3(0.12)) * intensity * (1.0 - uDim * 0.9), 1.0);
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
  renderer.setClearColor(0x0a0b10, 0);
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

    camera.position.set(
      cameraBase.x + params.parallaxX * 9,
      cameraBase.y + params.parallaxY * 6,
      cameraBase.z,
    );
    camera.lookAt(lookAt);

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
