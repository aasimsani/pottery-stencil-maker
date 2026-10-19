import type { Geometry } from './geometry';
import type { Mask } from './mask';

/** The furthest a mark sits from the band's edge, in mm, so it stays close to the paint it lines up. */
const MAX_INSET = 3;

// addMarks() cuts repeat marks for a stencil that covers part of the way round. Each end of the band
// gets a round hole in the margin above it and another in the margin below it. You mark the pot
// through all four holes, paint, and then move the stencil along until its two marks at the start
// sit on the dots that the two marks at the end left. The second placement then continues the first
// exactly, and the two marks keep the stencil from tilting. A margin needs room for the hole plus
// 1 mm of plastic on each side, or it gets no marks. Returns how many marks it cut.
export function addMarks(m: Mask, g: Geometry, { radius, top, bottom }: { radius: number; top: number; bottom: number }): number {
  const { w, h, res, solid, inside } = m, rPx = radius / res;
  const rows: number[] = [];
  if (top >= 2 * radius + 2) rows.push(g.slant + Math.min(top / 2, MAX_INSET));
  if (bottom >= 2 * radius + 2) rows.push(-Math.min(bottom / 2, MAX_INSET));
  let cut = 0;
  for (const s of rows) for (const frac of [0, 1]) {
    const k = g.toPixel(s, frac);
    if (k < 0) continue;
    const ci = k % w, cj = Math.floor(k / w);
    for (let j = Math.max(0, Math.floor(cj - rPx)); j <= Math.min(h - 1, Math.ceil(cj + rPx)); j++)
      for (let i = Math.max(0, Math.floor(ci - rPx)); i <= Math.min(w - 1, Math.ceil(ci + rPx)); i++)
        if ((i - ci) ** 2 + (j - cj) ** 2 <= rPx * rPx && inside[j * w + i]) solid[j * w + i] = 0;
    cut++;
  }
  return cut;
}
