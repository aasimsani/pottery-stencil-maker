import { countPieces, dilate, type Mask } from './mask';
import { thinFeatures } from './thin';

export type SpotAction = 'thicken' | 'open' | 'widen' | 'close' | 'leave';
/** One spot the user fixed by hand, at pixel (x, y) of the flat stencil. byPx is how much to thicken or widen it. */
export interface SpotFixPx { kind: 'plastic' | 'hole'; x: number; y: number; action: SpotAction; byPx: number }

/** How far from a click, in pixels, the nearest thin spot still counts as the one clicked. */
export const SPOT_REACH = 6;

// spotAt() finds the thin spot nearest (x, y) within SPOT_REACH, and returns its pixels. A spot is one connected
// piece of the thin mask, the same pieces the print check counts. It returns null when no spot is near.
export function spotAt(mask: Uint8Array, w: number, h: number, x: number, y: number): number[] | null {
  let best = -1, bestD = Infinity;
  for (let dy = -SPOT_REACH; dy <= SPOT_REACH; dy++) for (let dx = -SPOT_REACH; dx <= SPOT_REACH; dx++) {
    const yy = Math.round(y) + dy, xx = Math.round(x) + dx, d = dx * dx + dy * dy;
    if (xx >= 0 && xx < w && yy >= 0 && yy < h && mask[yy * w + xx] && d < bestD) { bestD = d; best = yy * w + xx; }
  }
  if (best < 0) return null;
  const seen = new Uint8Array(w * h), out: number[] = [], stack = [best];
  seen[best] = 1;
  while (stack.length) {
    const p = stack.pop()!, px = p % w;
    out.push(p);
    for (const q of [px > 0 ? p - 1 : -1, px < w - 1 ? p + 1 : -1, p - w, p + w])
      if (q >= 0 && q < w * h && mask[q] && !seen[q]) { seen[q] = 1; stack.push(q); }
  }
  return out;
}

export interface SpotInfo { x: number; y: number; area: number; minX: number; maxX: number; minY: number; maxY: number }

// listSpots() lists every spot in a thin mask, largest first. Each one's (x, y) is the spot's pixel nearest its centre,
// so the point always lies on the spot. A centre alone can fall off a curved line, such as the middle of a ring.
export function listSpots(mask: Uint8Array, w: number, h: number): SpotInfo[] {
  const seen = new Uint8Array(w * h), out: SpotInfo[] = [];
  for (let k0 = 0; k0 < w * h; k0++) {
    if (!mask[k0] || seen[k0]) continue;
    const px = spotAt(mask, w, h, k0 % w, Math.floor(k0 / w))!;
    let sx = 0, sy = 0, minX = w, maxX = 0, minY = h, maxY = 0;
    for (const p of px) {
      const x = p % w, y = Math.floor(p / w);
      seen[p] = 1; sx += x; sy += y;
      minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y);
    }
    const cx = sx / px.length, cy = sy / px.length;
    let best = px[0], bestD = Infinity;
    for (const p of px) { const d = (p % w - cx) ** 2 + (Math.floor(p / w) - cy) ** 2; if (d < bestD) { bestD = d; best = p; } }
    out.push({ x: best % w, y: Math.floor(best / w), area: px.length, minX, maxX, minY, maxY });
  }
  return out.sort((a, b) => b.area - a.area);
}

// dropSpots() takes the spots the user chose to leave out of a thin mask, so the print check counts them apart.
export function dropSpots(mask: Uint8Array, w: number, h: number, points: { x: number; y: number }[]): { mask: Uint8Array; spots: number } {
  const out = mask.slice();
  for (const { x, y } of points) for (const k of spotAt(out, w, h, x, y) ?? []) out[k] = 0;
  return { mask: out, spots: countPieces(out, w, h) };
}

// applySpotFixes() edits the stencil's plastic for each spot fix, and returns how many found their spot.
// Plastic spots get thickened by byPx, or opened up into paint. Paint-line spots get widened by byPx, or closed
// with plastic. The frame stays plastic, so a fix never cuts into the stencil's margins.
// It runs on the raw mask, before bridges, flaps and posts, so those steps see the fixed stencil.
export function applySpotFixes(mask: Mask, fixes: SpotFixPx[], o: { plasticPx: number; holePx: number }): number {
  if (!fixes.length) return 0;
  const { w, h, solid, inside, frame } = mask, n = w * h;
  const holes = new Uint8Array(n);
  for (let k = 0; k < n; k++) holes[k] = inside[k] && !solid[k] ? 1 : 0;
  const thin = {
    plastic: thinFeatures(solid, w, h, o.plasticPx, 2 * o.plasticPx * o.plasticPx).mask,
    hole: thinFeatures(holes, w, h, o.holePx, 2 * o.holePx * o.holePx).mask,
  };
  let applied = 0;
  for (const f of fixes) {
    const px = spotAt(thin[f.kind], w, h, f.x, f.y);
    if (!px) continue;
    applied++;
    if (f.action === 'leave') continue;
    const spot = new Uint8Array(n);
    for (const k of px) spot[k] = 1;
    const area = f.action === 'thicken' || f.action === 'widen' ? dilate(spot, w, h, f.byPx / 2) : spot;
    const plastic = f.action === 'thicken' || f.action === 'close';
    for (let k = 0; k < n; k++) if (area[k] && inside[k] && !frame[k]) solid[k] = plastic ? 1 : 0;
  }
  return applied;
}
