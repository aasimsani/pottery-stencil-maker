import type { Geometry } from './geometry';
import type { Mask } from './mask';

// Overhangs of a curved shell printed upright. The flat raster's rows run from the shell's top
// (row 0) down to the edge that stands on the bed (the last row).

export interface Span {
  /** The raster row of the overhang, and its unsupported run of columns [a, b). */
  row: number; a: number; b: number;
  /** The distance it has to span in mid-air, in mm. */
  length: number;
  /** True when plastic holds it at both ends (a bridge), false when only one end is held (a shelf). */
  anchored: boolean;
}

export interface SagOptions {
  /** Print layer height, the longest bridge the printer spans cleanly, and the furthest a shelf may reach, in mm. */
  layer: number; maxBridge: number; maxReach: number;
  /** The widest plastic that may start in mid-air, held at neither end, in mm. A slicer flags any such spot as a floating region. */
  maxFloat: number;
}

export interface SagResult { spans: Span[]; mask: Uint8Array }

// findSags() slices the shell into layers the way the slicer does, from the bed up. Plastic in a layer
// is supported when the layer below has plastic within one safe overhang step, about 55° from
// upright (1.4 × the layer height). Unsupported runs are either bridges, held at both ends, or
// shelves, held at one end. A bridge sags past maxBridge, and a shelf droops past maxReach. Plastic
// held at neither end, such as the tip of a point that hangs down into a hole, starts in mid-air,
// so it may span only maxFloat.
export function findSags(m: Mask, { layer, maxBridge, maxReach, maxFloat }: SagOptions): SagResult {
  const { w, h, solid, res } = m;
  const layerPx = Math.max(1, Math.round(layer / res)), stepPx = Math.max(1, Math.round((1.4 * layer) / res));
  const spans: Span[] = [], mask = new Uint8Array(w * h), below = new Int32Array(w + 1);
  // The lowest row with any plastic stands on the bed. Rows of padding under it don't count.
  let bed = h - 1;
  while (bed > 0 && !solid.subarray(bed * w, bed * w + w).some((v) => v)) bed--;
  // Each layer is represented by its lowest raster row, counting up from the row on the bed.
  for (let j = bed - layerPx; j >= 0; j -= layerPx) {
    const s = j + layerPx;
    for (let x = 0; x < w; x++) below[x + 1] = below[x] + solid[s * w + x]; // prefix sums of the layer below
    const supported = (x: number) => below[Math.min(w, x + stepPx + 1)] - below[Math.max(0, x - stepPx)] > 0;
    for (let x = 0; x < w;) {
      if (!solid[j * w + x] || supported(x)) { x++; continue; }
      const a = x;
      while (x < w && solid[j * w + x] && !supported(x)) x++;
      const left = a > 0 && solid[j * w + a - 1] === 1, right = x < w && solid[j * w + x] === 1;
      const anchored = left && right;
      // The span runs between the supports in the layer below, which reach stepPx in from each held end.
      const length = (x - a + (left ? stepPx : 0) + (right ? stepPx : 0)) * res;
      if (length > (anchored ? maxBridge : left || right ? maxReach : maxFloat)) {
        spans.push({ row: j, a, b: x, length, anchored });
        for (let r = Math.max(0, j - layerPx + 1); r <= j; r++) for (let k = a; k < x; k++) mask[r * w + k] = 1;
      }
    }
  }
  return { spans, mask };
}

// addPosts() props sagging spans with thin vertical posts, from the span down through the hole to
// the plastic beneath. A bridge gets enough evenly spaced posts to cut it into lengths of at most
// maxBridge. A shelf gets a post at its free end, plus more along it if it is longer than that.
// The posts stay in the stencil, so nothing has to be snapped off. Returns how many it added.
export function addPosts(m: Mask, spans: Span[], { postPx, maxBridge }: { postPx: number; maxBridge: number }): number {
  const { w, h, solid, inside, res } = m;
  const half = Math.max(1, Math.round(postPx / 2));
  let added = 0;
  const post = (xc: number, row: number) => {
    const x0 = Math.max(0, Math.round(xc) - half), x1 = Math.min(w, Math.round(xc) + half);
    let filled = false;
    const col = Math.min(w - 1, Math.max(0, Math.round(xc)));
    // A point that hangs down can reach a row or two below the row that represents its layer, so the post starts under it.
    let y0 = row + 1;
    while (y0 < h && solid[y0 * w + col]) y0++;
    for (let y = y0; y < h; y++) {
      const c = y * w + col;
      if (solid[c]) break; // reached the floor of the hole
      for (let x = x0; x < x1; x++) if (inside[y * w + x] && !solid[y * w + x]) { solid[y * w + x] = 1; filled = true; }
    }
    if (filled) added++;
  };
  for (const s of spans) {
    const lengthPx = s.length / res;
    if (s.anchored) {
      // Spread the posts across the gap between the supports either side.
      const start = s.a - (s.length / res - (s.b - s.a)) / 2, k = Math.ceil(s.length / maxBridge) - 1;
      for (let i = 1; i <= k; i++) post(start + (lengthPx * i) / (k + 1), s.row);
    } else if (!(s.a > 0 && solid[s.row * w + s.a - 1]) && !(s.b < w && solid[s.row * w + s.b])) {
      // Plastic held at neither end gets posts spread evenly under it, starting with one under its middle.
      const k = Math.ceil(s.length / maxBridge);
      for (let i = 0; i < k; i++) post(s.a + ((s.b - s.a) * (2 * i + 1)) / (2 * k), s.row);
    } else {
      // A shelf hangs from whichever end is held. Prop its free end, then split what's left.
      const heldLeft = s.a > 0 && solid[s.row * w + s.a - 1] === 1;
      const tip = heldLeft ? s.b - 1 - half : s.a + half, k = Math.ceil(s.length / maxBridge) - 1;
      post(tip, s.row);
      for (let i = 1; i <= k; i++) post(heldLeft ? s.a + ((tip - s.a) * i) / (k + 1) : tip + ((s.b - tip) * i) / (k + 1), s.row);
    }
  }
  return added;
}

export interface LayerGrid {
  /** The stencil resampled so each row is one height on the upright shell, top row first. */
  mask: Mask;
  /** For each grid pixel, its pixel index in the flat raster, or -1 outside it. */
  flat: Int32Array;
}

// layerGrid() resamples the flat stencil so its rows are printed layers. On a tapered pot an
// upright shell's layers are circles, which unroll to arcs round the cone's apex, not raster
// rows. Each grid row is one distance up the surface, and each column one position across,
// spaced res apart along the widest arc.
export function layerGrid(m: Mask, g: Geometry): LayerGrid {
  const [s0, s1] = g.sRange, [f0, f1] = g.fracRange, res = m.res;
  // Arc length is distance from the apex × angle, and arcLength(0) ÷ ell(0) is the paint area's angle.
  const widest = Math.max(g.ell(s0), g.ell(s1)) * (g.arcLength(0) / g.ell(0)) * (f1 - f0);
  const W = Math.max(1, Math.ceil(widest / res)), H = Math.max(1, Math.ceil((s1 - s0) / res));
  const flat = new Int32Array(W * H), solid = new Uint8Array(W * H), inside = new Uint8Array(W * H);
  for (let r = 0; r < H; r++) {
    const s = s1 - (r + 0.5) * res;
    for (let c = 0; c < W; c++) {
      const k = g.toPixel(s, f0 + ((c + 0.5) / W) * (f1 - f0));
      flat[r * W + c] = k >= 0 && m.inside[k] ? k : -1;
      if (flat[r * W + c] >= 0) { inside[r * W + c] = 1; solid[r * W + c] = m.solid[k]; }
    }
  }
  return { mask: { w: W, h: H, res, solid, inside, frame: new Uint8Array(W * H) }, flat };
}
