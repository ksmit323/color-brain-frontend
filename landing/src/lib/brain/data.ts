/**
 * Deterministic generation of the dye-history brain constellation.
 *
 * Nodes are pseudo dye jobs plotted at CIELAB coordinates (x = a*, y = scaled
 * L*, z = b*), clustered around the 23 real anchor colors we have (18 palette
 * colors + 5 case-study targets), plus a gamut-fill "tissue" shell sampled
 * across the sRGB cube. All positions are then warped into a brain silhouette
 * (see warpToBrain); colors keep the true Lab → sRGB of the unwarped
 * coordinate, so the brain literally maps the color spectrum. Edges are
 * nearest-neighbor links between the dye-job clusters — the same retrieval
 * structure the product uses. Pure math, no three.js imports.
 */

import { labToRgb, rgbToLab, type Lab } from "../lab";
import { PALETTE } from "../../data/palette";
import { CASE_STUDIES } from "../../data/caseStudies";

/** Vertical exaggeration of L* so the lightness axis reads clearly. */
const L_SCALE = 1.1;

/** Index (among the anchors) of the narrative's match: the AN case study,
    Color Brain's biggest holdout win (ΔE 6.706 → 0.856). */
const MATCH_ANCHOR = PALETTE.length + 1;

export interface BrainData {
  /** xyz per node */
  positions: Float32Array;
  /** rgb (0–1) per node */
  colors: Float32Array;
  /** random breathing phase per node */
  phases: Float32Array;
  /** normalized BFS hop distance from the match node, per node */
  depths: Float32Array;
  nodeCount: number;
  /** xyz per edge vertex (2 vertices per segment) */
  edgePositions: Float32Array;
  /** rgb per edge vertex, copied from its node */
  edgeColors: Float32Array;
  /** normalized propagation order per edge vertex */
  edgeOrders: Float32Array;
  edgeVertexCount: number;
  /** where the animated target color enters and lands */
  target: {
    start: [number, number, number];
    end: [number, number, number];
    color: [number, number, number];
  };
}

/** Deterministic 32-bit PRNG (mulberry32) so the constellation is identical
    on every visit. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function labToPosition(lab: Lab): [number, number, number] {
  return [lab.a, (lab.l - 50) * L_SCALE, lab.b];
}

function labToUnitRgb(lab: Lab): [number, number, number] {
  const [r, g, b] = labToRgb(lab.l, lab.a, lab.b);
  return [r / 255, g / 255, b / 255];
}

/**
 * Stylized warp from CIELAB space into a brain silhouette: an ellipsoid
 * squash (hemispheres split along the a* axis, elongated along b*), a
 * longitudinal fissure down the x = 0 midline, and low-frequency "cortical
 * fold" ripples along the radial direction. Positions only — node colors
 * always keep the true Lab → sRGB of the unwarped coordinate.
 */
function warpToBrain(p: [number, number, number]): [number, number, number] {
  let [x, y, z] = [p[0] / 110, p[1] / 60, p[2] / 110];
  // Ellipsoid: shorter in L*, longer front-to-back.
  y *= 0.82;
  z *= 1.18;
  // Longitudinal fissure: repel nodes from the midline, strongest up top.
  const fissure =
    0.1 * Math.exp(-((x / 0.16) ** 2)) * Math.min(1, Math.max(0, y + 0.55));
  x += (x >= 0 ? 1 : -1) * fissure;
  // Cortical folds: gentle radial ripple.
  const r = Math.hypot(x, y, z);
  if (r > 1e-4) {
    const fold =
      0.05 * Math.sin(5.5 * y + 1.7) * Math.sin(4.5 * z - 0.6) * Math.sin(5.0 * x + 2.3);
    const s = (r + fold) / r;
    x *= s;
    y *= s;
    z *= s;
  }
  return [x * 110, y * 60, z * 110];
}

export function generateBrainData(
  nodesPerCluster: number,
  shellNodes: number,
): BrainData {
  const rand = mulberry32(0xc0105);
  const gaussian = () => {
    // Box-Muller; rand() is never exactly 0.
    const u = 1 - rand();
    const v = rand();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  };

  const anchors: Lab[] = [
    ...PALETTE.map((p) => p.lab),
    ...CASE_STUDIES.map((cs) => cs.target),
  ];

  // --- Nodes: node 0 of each cluster is the anchor itself. ---
  interface Node {
    pos: [number, number, number];
    rgb: [number, number, number];
    phase: number;
    cluster: number;
  }
  const nodes: Node[] = [];
  for (let c = 0; c < anchors.length; c++) {
    const anchor = anchors[c]!;
    for (let i = 0; i < nodesPerCluster; i++) {
      const lab: Lab =
        i === 0
          ? anchor
          : {
              l: Math.min(98, Math.max(2, anchor.l + gaussian() * 5)),
              a: anchor.a + gaussian() * 7,
              b: anchor.b + gaussian() * 7,
            };
      nodes.push({
        pos: warpToBrain(labToPosition(lab)),
        rgb: labToUnitRgb(lab),
        phase: rand() * Math.PI * 2,
        cluster: c,
      });
    }
  }
  const matchNode = MATCH_ANCHOR * nodesPerCluster;

  // --- Shell: nodes sampled uniformly across the sRGB gamut, placed at their
  //     Lab coordinates and warped like everything else. They carry no edges
  //     (depth stays -1 → normalized 1), so the retrieval narrative never
  //     lights them — they only give the brain silhouette its density. ---
  for (let i = 0; i < shellNodes; i++) {
    const r = Math.round(rand() * 255);
    const g = Math.round(rand() * 255);
    const b = Math.round(rand() * 255);
    nodes.push({
      pos: warpToBrain(labToPosition(rgbToLab(r, g, b))),
      rgb: [r / 255, g / 255, b / 255],
      phase: rand() * Math.PI * 2,
      cluster: -1,
    });
  }

  // --- Edges: 2-nearest-neighbor within each cluster + one link between
  //     each cluster anchor and its nearest neighboring anchor. ---
  const dist2 = (a: Node, b: Node) =>
    (a.pos[0] - b.pos[0]) ** 2 +
    (a.pos[1] - b.pos[1]) ** 2 +
    (a.pos[2] - b.pos[2]) ** 2;

  const edgeSet = new Set<string>();
  const edges: [number, number][] = [];
  const addEdge = (i: number, j: number) => {
    const key = i < j ? `${i}-${j}` : `${j}-${i}`;
    if (edgeSet.has(key)) return;
    edgeSet.add(key);
    edges.push([i, j]);
  };

  for (let c = 0; c < anchors.length; c++) {
    const start = c * nodesPerCluster;
    for (let i = start; i < start + nodesPerCluster; i++) {
      const byDist = [];
      for (let j = start; j < start + nodesPerCluster; j++) {
        if (j !== i) byDist.push([dist2(nodes[i]!, nodes[j]!), j] as const);
      }
      byDist.sort((a, b) => a[0] - b[0]);
      for (const [, j] of byDist.slice(0, 2)) addEdge(i, j);
    }
  }
  for (let c = 0; c < anchors.length; c++) {
    const self = c * nodesPerCluster;
    let best = -1;
    let bestD = Infinity;
    for (let o = 0; o < anchors.length; o++) {
      if (o === c) continue;
      const d = dist2(nodes[self]!, nodes[o * nodesPerCluster]!);
      if (d < bestD) {
        bestD = d;
        best = o * nodesPerCluster;
      }
    }
    if (best >= 0) addEdge(self, best);
  }

  // --- BFS from the match node → propagation depth for the retrieval wave. ---
  const adjacency: number[][] = nodes.map(() => []);
  for (const [i, j] of edges) {
    adjacency[i]!.push(j);
    adjacency[j]!.push(i);
  }
  const depth = new Array<number>(nodes.length).fill(-1);
  depth[matchNode] = 0;
  const queue = [matchNode];
  let maxDepth = 0;
  while (queue.length > 0) {
    const n = queue.shift()!;
    for (const m of adjacency[n]!) {
      if (depth[m] === -1) {
        depth[m] = depth[n]! + 1;
        maxDepth = Math.max(maxDepth, depth[m]!);
        queue.push(m);
      }
    }
  }
  const normDepth = (i: number) =>
    depth[i]! < 0 ? 1 : depth[i]! / Math.max(1, maxDepth);

  // --- Flatten. Node order is shuffled so halving the draw range (perf
  //     degrade) thins the whole constellation instead of dropping clusters;
  //     edges reference copied positions, so node order is free. ---
  const nodeOrder = nodes.map((_, i) => i);
  for (let i = nodeOrder.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [nodeOrder[i], nodeOrder[j]] = [nodeOrder[j]!, nodeOrder[i]!];
  }
  // Keep the match node first so it always survives draw-range degrades.
  const matchAt = nodeOrder.indexOf(matchNode);
  [nodeOrder[0], nodeOrder[matchAt]] = [nodeOrder[matchAt]!, nodeOrder[0]!];

  const positions = new Float32Array(nodes.length * 3);
  const colors = new Float32Array(nodes.length * 3);
  const phases = new Float32Array(nodes.length);
  const depths = new Float32Array(nodes.length);
  nodeOrder.forEach((src, dst) => {
    const n = nodes[src]!;
    positions.set(n.pos, dst * 3);
    colors.set(n.rgb, dst * 3);
    phases[dst] = n.phase;
    depths[dst] = normDepth(src);
  });

  const edgeOrder = edges.map((_, i) => i);
  for (let i = edgeOrder.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [edgeOrder[i], edgeOrder[j]] = [edgeOrder[j]!, edgeOrder[i]!];
  }
  const edgePositions = new Float32Array(edges.length * 6);
  const edgeColors = new Float32Array(edges.length * 6);
  const edgeOrders = new Float32Array(edges.length * 2);
  edgeOrder.forEach((src, dst) => {
    const [i, j] = edges[src]!;
    const order = Math.max(normDepth(i), normDepth(j));
    edgePositions.set(nodes[i]!.pos, dst * 6);
    edgePositions.set(nodes[j]!.pos, dst * 6 + 3);
    edgeColors.set(nodes[i]!.rgb, dst * 6);
    edgeColors.set(nodes[j]!.rgb, dst * 6 + 3);
    edgeOrders[dst * 2] = order;
    edgeOrders[dst * 2 + 1] = order;
  });

  // --- The animated target: the AN case study's real target color, entering
  //     from outside the gamut solid and landing on the match node. ---
  const matchPos = nodes[matchNode]!.pos;
  const targetLab = CASE_STUDIES[1]!.target;
  return {
    positions,
    colors,
    phases,
    depths,
    nodeCount: nodes.length,
    edgePositions,
    edgeColors,
    edgeOrders,
    edgeVertexCount: edges.length * 2,
    target: {
      start: [matchPos[0] - 130, matchPos[1] + 95, matchPos[2] + 60],
      end: [...matchPos],
      color: labToUnitRgb(targetLab),
    },
  };
}
