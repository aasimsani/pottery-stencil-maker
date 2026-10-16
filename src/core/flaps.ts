import { distanceTo, type Mask } from './mask';

export interface Flap {
  /** The flap's plastic pixels. */
  pixels: number[];
  /** Its extent across the band (the bending direction), in pixels. */
  minX: number; maxX: number; width: number;
  /** Its centre row. */
  cy: number;
}

export interface FlapResult { flaps: Flap[]; mask: Uint8Array }

const neighbours = (p: number, w: number, n: number) => {
  const x = p % w;
  return [x > 0 ? p - 1 : -1, x < w - 1 ? p + 1 : -1, p - w < 0 ? -1 : p - w, p + w >= n ? -1 : p + w];
};

// contactXs() lists the columns where a piece touches plastic outside it, which are the links it hangs from.
function contactXs(pixels: number[], mine: (p: number) => boolean, solid: Uint8Array, w: number): number[] {
  const n = solid.length, xs: number[] = [];
  for (const p of pixels) {
    if (neighbours(p, w, n).some((q) => q >= 0 && solid[q] && !mine(q))) xs.push(p % w);
  }
  return xs;
}

/** A piece linked near both of its ends bends with the sheet, however narrow the links are. */
const heldBothSides = (xs: number[], minX: number, maxX: number) => {
  const reach = (maxX - minX + 1) * 0.3;
  return xs.some((x) => x <= minX + reach) && xs.some((x) => x >= maxX - reach);
};

// findFlaps() finds plastic that hangs off the rest through links narrower than neckPx on one
// side only. When the stencil wraps round a pot, the bend gathers in the weak link and the piece
// stays flat, so its free side lifts away from the pot. Shrinking the plastic by half the neck
// width cuts those links. Every part that then comes loose from the main body, is at least
// minWidthPx across the band, and isn't linked near both ends is a flap.
export function findFlaps(m: Mask, neckPx: number, minWidthPx: number): FlapResult {
  const { w, h, solid, frame } = m, n = w * h, r = neckPx / 2;
  const outside = new Uint8Array(n);
  for (let k = 0; k < n; k++) outside[k] = solid[k] ? 0 : 1;
  const d = distanceTo(outside, w, h), core = new Uint8Array(n);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const k = y * w + x;
    core[k] = solid[k] && Math.min(d[k], x + 1, y + 1, w - x, h - y) >= r ? 1 : 0;
  }

  // Label the shrunken parts. The main body is whatever holds the frame, or the largest part without one.
  const label = new Int32Array(n), sizes: number[] = [0], touchesFrame: boolean[] = [false];
  for (let k = 0; k < n; k++) {
    if (!core[k] || label[k]) continue;
    const id = sizes.length, stack = [k];
    let size = 0, framed = false;
    label[k] = id;
    while (stack.length) {
      const p = stack.pop()!;
      size++; framed ||= frame[p] === 1;
      for (const q of neighbours(p, w, n)) if (q >= 0 && core[q] && !label[q]) { label[q] = id; stack.push(q); }
    }
    sizes.push(size); touchesFrame.push(framed);
  }
  const main = new Set<number>();
  touchesFrame.forEach((t, id) => { if (t) main.add(id); });
  if (!main.size && sizes.length > 1) main.add(sizes.indexOf(Math.max(...sizes.slice(1))));

  // Grow every loose part back to the plastic it stands for, all at once: a breadth-first search
  // r steps out through plastic, from every loose core pixel, keeping the nearest part's label.
  const own = new Int32Array(n), step = new Uint16Array(n), queue: number[] = [];
  for (let k = 0; k < n; k++) if (label[k] && !main.has(label[k])) { own[k] = label[k]; queue.push(k); }
  for (let hd = 0; hd < queue.length; hd++) {
    const p = queue[hd];
    if (step[p] >= Math.ceil(r)) continue;
    for (const q of neighbours(p, w, n)) {
      if (q < 0 || !solid[q] || own[q] || (label[q] && main.has(label[q]))) continue;
      own[q] = own[p]; step[q] = step[p] + 1; queue.push(q);
    }
  }
  const parts = new Map<number, number[]>();
  for (let k = 0; k < n; k++) if (own[k]) { const px = parts.get(own[k]); if (px) px.push(k); else parts.set(own[k], [k]); }

  const mask = new Uint8Array(n), flaps: Flap[] = [];
  for (const [id, pixels] of parts) {
    let minX = w, maxX = -1, sy = 0;
    for (const k of pixels) { const x = k % w; minX = Math.min(minX, x); maxX = Math.max(maxX, x); sy += (k / w) | 0; }
    const width = maxX - minX + 1;
    if (width < minWidthPx) continue;
    if (heldBothSides(contactXs(pixels, (q) => own[q] === id, solid, w), minX, maxX)) continue;
    for (const p of pixels) mask[p] = 1;
    flaps.push({ pixels, minX, maxX, width, cy: sy / pixels.length });
  }
  return { flaps, mask };
}

// holdFlaps() bridges each flap on the side its existing link doesn't reach, so it is held at
// both ends and bends with the sheet. A flap linked near its middle gets a bridge on each side.
// Each bridge starts from the flap's outermost point on that side and runs through paint to the
// nearest other plastic, up to maxLenPx long. Returns how many bridges it added.
export function holdFlaps(m: Mask, flaps: Flap[], { bridgePx, maxLenPx }: { bridgePx: number; maxLenPx: number }): number {
  const { w, h, solid, inside } = m, n = w * h;
  // One search buffer serves every bridge. A stamp marks which search last wrote each pixel.
  const parent = new Int32Array(n), dist = new Int32Array(n), stamp = new Int32Array(n);
  let search = 0, added = 0;
  for (const f of flaps) {
    const mine = new Set(f.pixels);
    const xs = contactXs(f.pixels, (q) => mine.has(q), solid, w);
    const centre = (f.minX + f.maxX) / 2, attach = xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : centre;
    const sides: (1 | -1)[] = Math.abs(attach - centre) < f.width * 0.25 ? [-1, 1] : [attach < centre ? 1 : -1];

    for (const side of sides) {
      // Start from the flap's outermost pixel on this side, nearest its centre row.
      const edgeX = side > 0 ? f.maxX : f.minX;
      let start = -1, best = Infinity;
      for (const p of f.pixels) {
        if (p % w !== edgeX) continue;
        const dy = Math.abs(((p / w) | 0) - f.cy);
        if (dy < best) { best = dy; start = p; }
      }
      if (start < 0) continue;

      search++;
      stamp[start] = search; parent[start] = -1; dist[start] = 0;
      const queue = [start];
      let hit = -1;
      for (let hd = 0; hd < queue.length && hit < 0; hd++) {
        const p = queue[hd];
        if (dist[p] >= maxLenPx) continue;
        for (const q of neighbours(p, w, n)) {
          if (q < 0 || stamp[q] === search || !inside[q]) continue;
          if (solid[q] && !mine.has(q)) { hit = p; break; }
          if (solid[q]) continue; // the bridge runs through paint, not back through the flap
          stamp[q] = search; parent[q] = p; dist[q] = dist[p] + 1; queue.push(q);
        }
      }
      if (hit < 0) continue;

      const rad = Math.max(0.5, bridgePx / 2), ri = Math.ceil(rad);
      for (let c = hit; c >= 0 && c !== start; c = parent[c]) {
        const x0 = c % w, y0 = (c / w) | 0;
        for (let dy = -ri; dy <= ri; dy++) for (let dx = -ri; dx <= ri; dx++) {
          const x = x0 + dx, y = y0 + dy, q = y * w + x;
          if (x >= 0 && y >= 0 && x < w && y < h && dx * dx + dy * dy <= rad * rad && inside[q]) solid[q] = 1;
        }
      }
      added++;
    }
  }
  return added;
}
