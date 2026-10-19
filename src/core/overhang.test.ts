import { describe, expect, test } from 'vitest';
import { addPosts, findSags, layerGrid } from './overhang';
import { geometry } from './geometry';
import { buildMask } from './mask';
import type { Mask } from './mask';

// A solid sheet 80 × 60 px at 0.1 mm per pixel (8 × 6 mm), printed upright: row 0 is the top,
// the last row sits on the bed. carve() opens paint holes where hole(x, y) is true.
function sheet(hole: (x: number, y: number) => boolean): Mask {
  const w = 80, h = 60, solid = new Uint8Array(w * h), inside = new Uint8Array(w * h).fill(1), frame = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) solid[y * w + x] = hole(x, y) ? 0 : 1;
  return { w, h, res: 0.1, solid, inside, frame };
}
// 0.2 mm layers, bridges up to 2 mm, at most 1 mm of plastic hanging off one side, and at most
// 0.3 mm of plastic that starts in mid-air.
const opts = { layer: 0.2, maxBridge: 2, maxReach: 1, maxFloat: 0.3 };
// A V-shaped paint line, like one zigzag of a chevron. The plastic above it dips to a point at
// x = 40, and that point's first layer has hole below it and on both sides.
const vee = () => sheet((x, y) => x >= 10 && x < 70 && y >= 25 - Math.abs(x - 40) / 2 && y < 45 - Math.abs(x - 40) / 2);

describe('findSags', () => {
  test('a flat-topped hole wider than the longest bridge sags', () => {
    const r = findSags(sheet((x, y) => x >= 20 && x < 50 && y >= 20 && y < 40), opts); // 3 mm wide
    expect(r.spans).toHaveLength(1);
    expect(r.spans[0].length).toBeCloseTo(3, 1);
    expect(r.mask[19 * 80 + 35]).toBe(1); // the hole's ceiling
  });

  test('a hole narrow enough to bridge is fine', () => {
    expect(findSags(sheet((x, y) => x >= 30 && x < 45 && y >= 20 && y < 40), opts).spans).toHaveLength(0); // 1.5 mm
  });

  test('a round hole closes in a little each layer and prints without help', () => {
    expect(findSags(sheet((x, y) => Math.hypot(x - 40, y - 30) < 20), opts).spans).toHaveLength(0); // 4 mm across
  });

  test('a shelf held on one side only sags once it reaches out further than maxReach', () => {
    // An L-shaped hole leaves a 2 mm shelf sticking out from the left wall with nothing below it.
    const r = findSags(sheet((x, y) => (x >= 20 && x < 60 && y >= 30 && y < 50) || (x >= 40 && x < 60 && y >= 10 && y < 30)), opts);
    expect(r.spans.some((s) => !s.anchored && s.length > 1)).toBe(true);
  });

  test('a point that starts in mid-air sags once it is wider than maxFloat, even inside maxReach', () => {
    const r = findSags(vee(), opts);
    expect(r.spans.some((s) => !s.anchored && s.a > 30 && s.b < 50)).toBe(true);
  });
});

describe('the bed', () => {
  test('the lowest plastic sits on the bed, even with empty rows under it', () => {
    const m = sheet((x, y) => y >= 55 || (x >= 30 && x < 45 && y >= 20 && y < 40)); // 5 empty rows at the bottom
    expect(findSags(m, opts).spans).toHaveLength(0);
  });

  test('on a flared pot, layers follow the arcs of the unrolled stencil, so a plain band never sags', () => {
    const g = geometry({ topD: 86, botD: 78, slant: 40, coverage: 0.5, frame: 4, res: 0.25 });
    const m = buildMask(g, []);
    const grid = layerGrid(m, g);
    expect(findSags(grid.mask, opts).spans).toHaveLength(0);
    // Every grid pixel inside the stencil maps back to a pixel of the flat raster.
    for (let k = 0; k < grid.flat.length; k++) if (grid.mask.inside[k]) expect(grid.flat[k]).toBeGreaterThanOrEqual(0);
  });
});

describe('addPosts', () => {
  test('posts split a long bridge into bridgeable lengths, and nothing sags afterwards', () => {
    const m = sheet((x, y) => x >= 10 && x < 70 && y >= 20 && y < 40); // 6 mm wide
    const added = addPosts(m, findSags(m, opts).spans, { postPx: 8, maxBridge: 2 });
    expect(added).toBe(2);
    expect(findSags(m, opts).spans).toHaveLength(0);
    // Posts run the full height of the hole, from its ceiling down to its floor.
    const postColumns = new Set<number>();
    for (let x = 10; x < 70; x++) if ([20, 30, 39].every((y) => m.solid[y * 80 + x])) postColumns.add(x);
    expect(postColumns.size).toBeGreaterThan(0);
  });

  test('a post props up the free end of a shelf', () => {
    const m = sheet((x, y) => (x >= 20 && x < 60 && y >= 30 && y < 50) || (x >= 40 && x < 60 && y >= 10 && y < 30));
    expect(addPosts(m, findSags(m, opts).spans, { postPx: 8, maxBridge: 2 })).toBeGreaterThan(0);
    expect(findSags(m, opts).spans).toHaveLength(0);
  });

  test('a post props a point that starts in mid-air from under its middle', () => {
    const m = vee();
    expect(addPosts(m, findSags(m, opts).spans, { postPx: 8, maxBridge: 2 })).toBe(1);
    expect(findSags(m, opts).spans).toHaveLength(0);
    expect(m.solid[35 * 80 + 40]).toBe(1); // inside the hole, straight under the point
  });
});
