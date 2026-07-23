/**
 * Deterministic generation of the dye-history constellation.
 *
 * Nodes are pseudo dye jobs plotted at literal CIELAB coordinates
 * (x = a*, y = scaled L*, z = b*), clustered around the 23 real anchor colors
 * we have (18 palette colors + 5 case-study targets) and colored by their true
 * Lab → sRGB conversion. Edges are nearest-neighbor links — the same retrieval
 * structure the product uses. Pure math, no three.js imports.
 *
 * The scroll narrative plays out a real inference:
 *  - the query is the AN case study's true target color, landing at its own
 *    Lab coordinates;
 *  - only a deterministic subset of clusters counts as substrate-compatible —
 *    the retrieval wave spreads through those edges alone;
 *  - the match node sits at Color Brain's actual recommended Lab, so the gap
 *    between query and match on screen is the real ΔE 0.856.
 */

import { labToRgb, type Lab } from "../lab";
import { PALETTE } from "../../data/palette";
import { CASE_STUDIES } from "../../data/caseStudies";

/** Vertical exaggeration of L* so the lightness axis reads clearly. */
const L_SCALE = 1.1;

/** Index (among the anchors) of the narrative's cluster: the AN case study,
    Color Brain's biggest holdout win (ΔE 6.706 → 0.856). */
const MATCH_ANCHOR = PALETTE.length + 1;

/** How many clusters count as substrate-compatible with the query: the AN
    cluster plus its nearest anchor neighbors. The rest of the map goes dark
    when the search begins. */
const COMPATIBLE_CLUSTERS = 7;

/** Propagation order for nodes the compatible wave can never reach. Kept
    above 1 so they stay dark even when the reveal front completes (uReveal
    tops out at 1). */
const UNREACHED_ORDER = 2;

export interface BrainData {
  /** xyz per node */
  positions: Float32Array;
  /** rgb (0–1) per node */
  colors: Float32Array;
  /** random breathing phase per node */
  phases: Float32Array;
  /** normalized BFS hop distance from the match node, per node (flare halo) */
  depths: Float32Array;
  /** 1 = substrate-compatible with the query, 0 = goes dark during search */
  compat: Float32Array;
  nodeCount: number;
  /** xyz per edge vertex (2 vertices per segment) */
  edgePositions: Float32Array;
  /** rgb per edge vertex, copied from its node */
  edgeColors: Float32Array;
  /** normalized propagation order from the query node, per edge vertex */
  edgeOrders: Float32Array;
  /** per edge vertex: 1 if both endpoints are substrate-compatible */
  edgeCompat: Float32Array;
  edgeVertexCount: number;
  /** where the animated query color enters and lands (its own Lab point) */
  target: {
    start: [number, number, number];
    end: [number, number, number];
    color: [number, number, number];
  };
  /** the retrieved recipe: Color Brain's real recommended Lab for the AN job */
  match: { pos: [number, number, number]; color: [number, number, number] };
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

export function generateBrainData(nodesPerCluster: number): BrainData {
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
        pos: labToPosition(lab),
        rgb: labToUnitRgb(lab),
        phase: rand() * Math.PI * 2,
        cluster: c,
      });
    }
  }

  // --- Substrate compatibility: the query's cluster plus its nearest anchor
  //     neighbors. Deterministic — derived from anchor geometry, no rand. ---
  const anchorPos = anchors.map(labToPosition);
  const queryAnchorPos = anchorPos[MATCH_ANCHOR]!;
  const byDistance = anchors
    .map((_, c) => c)
    .filter((c) => c !== MATCH_ANCHOR)
    .sort((a, b) => {
      const da =
        (anchorPos[a]![0] - queryAnchorPos[0]) ** 2 +
        (anchorPos[a]![1] - queryAnchorPos[1]) ** 2 +
        (anchorPos[a]![2] - queryAnchorPos[2]) ** 2;
      const db =
        (anchorPos[b]![0] - queryAnchorPos[0]) ** 2 +
        (anchorPos[b]![1] - queryAnchorPos[1]) ** 2 +
        (anchorPos[b]![2] - queryAnchorPos[2]) ** 2;
      return da - db;
    });
  const compatibleCluster = new Array<boolean>(anchors.length).fill(false);
  compatibleCluster[MATCH_ANCHOR] = true;
  for (const c of byDistance.slice(0, COMPATIBLE_CLUSTERS - 1)) {
    compatibleCluster[c] = true;
  }

  // --- The match node: the recipe Color Brain actually recommended for the
  //     AN job, ΔE 0.856 from the query. Appended as a member of the AN
  //     cluster so the flare halo lights its evidence neighborhood. ---
  const matchLab = CASE_STUDIES[1]!.colorBrain;
  const matchNode = nodes.length;
  nodes.push({
    pos: labToPosition(matchLab),
    rgb: labToUnitRgb(matchLab),
    phase: rand() * Math.PI * 2,
    cluster: MATCH_ANCHOR,
  });

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
  // The match node links into its own cluster like any other job.
  {
    const start = MATCH_ANCHOR * nodesPerCluster;
    const byDist = [];
    for (let j = start; j < start + nodesPerCluster; j++) {
      byDist.push([dist2(nodes[matchNode]!, nodes[j]!), j] as const);
    }
    byDist.sort((a, b) => a[0] - b[0]);
    for (const [, j] of byDist.slice(0, 2)) addEdge(matchNode, j);
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
  // Compatible clusters also link to their nearest compatible anchor, so the
  // retrieval wave can reach every compatible cluster from the query.
  {
    const compatAnchors = anchors
      .map((_, c) => c)
      .filter((c) => compatibleCluster[c]);
    for (const c of compatAnchors) {
      const self = c * nodesPerCluster;
      let best = -1;
      let bestD = Infinity;
      for (const o of compatAnchors) {
        if (o === c) continue;
        const d = dist2(nodes[self]!, nodes[o * nodesPerCluster]!);
        if (d < bestD) {
          bestD = d;
          best = o * nodesPerCluster;
        }
      }
      if (best >= 0) addEdge(self, best);
    }
  }

  const edgeCompatible = edges.map(
    ([i, j]) =>
      compatibleCluster[nodes[i]!.cluster]! &&
      compatibleCluster[nodes[j]!.cluster]!,
  );

  // --- BFS #1: from the match node over all edges → the flare halo lights
  //     the evidence neighborhood around the retrieved recipe. ---
  const adjacency: number[][] = nodes.map(() => []);
  for (const [i, j] of edges) {
    adjacency[i]!.push(j);
    adjacency[j]!.push(i);
  }
  const bfs = (start: number, compatibleOnly: boolean): number[] => {
    const depth = new Array<number>(nodes.length).fill(-1);
    depth[start] = 0;
    const queue = [start];
    let maxDepth = 0;
    while (queue.length > 0) {
      const n = queue.shift()!;
      for (const m of adjacency[n]!) {
        if (depth[m] !== -1) continue;
        if (compatibleOnly && !compatibleCluster[nodes[m]!.cluster]!) continue;
        depth[m] = depth[n]! + 1;
        maxDepth = Math.max(maxDepth, depth[m]!);
        queue.push(m);
      }
    }
    const norm = Math.max(1, maxDepth);
    return depth.map((d) => (d < 0 ? UNREACHED_ORDER : d / norm));
  };
  const depths = bfs(matchNode, false);

  // --- BFS #2: from the query node over compatible history only → the
  //     retrieval wave spreads outward from the query, exactly like the
  //     product's search. The query lands on the AN anchor node. ---
  const queryNode = MATCH_ANCHOR * nodesPerCluster;
  const orders = bfs(queryNode, true);

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
  const depthsFlat = new Float32Array(nodes.length);
  const compat = new Float32Array(nodes.length);
  nodeOrder.forEach((src, dst) => {
    const n = nodes[src]!;
    positions.set(n.pos, dst * 3);
    colors.set(n.rgb, dst * 3);
    phases[dst] = n.phase;
    depthsFlat[dst] = depths[src]!;
    compat[dst] = compatibleCluster[n.cluster]! ? 1 : 0;
  });

  const edgeOrder = edges.map((_, i) => i);
  for (let i = edgeOrder.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [edgeOrder[i], edgeOrder[j]] = [edgeOrder[j]!, edgeOrder[i]!];
  }
  const edgePositions = new Float32Array(edges.length * 6);
  const edgeColors = new Float32Array(edges.length * 6);
  const edgeOrders = new Float32Array(edges.length * 2);
  const edgeCompat = new Float32Array(edges.length * 2);
  edgeOrder.forEach((src, dst) => {
    const [i, j] = edges[src]!;
    const order = Math.max(orders[i]!, orders[j]!);
    const compatFlag = edgeCompatible[src]! ? 1 : 0;
    edgePositions.set(nodes[i]!.pos, dst * 6);
    edgePositions.set(nodes[j]!.pos, dst * 6 + 3);
    edgeColors.set(nodes[i]!.rgb, dst * 6);
    edgeColors.set(nodes[j]!.rgb, dst * 6 + 3);
    edgeOrders[dst * 2] = order;
    edgeOrders[dst * 2 + 1] = order;
    edgeCompat[dst * 2] = compatFlag;
    edgeCompat[dst * 2 + 1] = compatFlag;
  });

  // --- The animated query: the AN case study's real target color, entering
  //     from outside the gamut solid and landing at its own Lab point. ---
  const targetLab = CASE_STUDIES[1]!.target;
  const queryPos = nodes[queryNode]!.pos;
  return {
    positions,
    colors,
    phases,
    depths: depthsFlat,
    compat,
    nodeCount: nodes.length,
    edgePositions,
    edgeColors,
    edgeOrders,
    edgeCompat,
    edgeVertexCount: edges.length * 2,
    target: {
      start: [queryPos[0] - 130, queryPos[1] + 95, queryPos[2] + 60],
      end: [...queryPos],
      color: labToUnitRgb(targetLab),
    },
    match: {
      pos: [...nodes[matchNode]!.pos],
      color: labToUnitRgb(matchLab),
    },
  };
}
