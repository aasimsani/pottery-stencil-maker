import { describe, expect, test } from 'vitest';
import { findFlaps, holdFlaps } from './flaps';
import type { Mask } from './mask';

// A 60 × 30 px stencil: a 3 px plastic frame round a paint hole, with a 16 × 10 px plastic plate
// in the hole joined to the frame on its left by a neck `neck` px tall.
function plateOnNeck(neck: number): Mask {
  const w = 60, h = 30, solid = new Uint8Array(w * h), inside = new Uint8Array(w * h).fill(1), frame = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const k = y * w + x, edge = x < 3 || y < 3 || x >= w - 3 || y >= h - 3;
    const plate = x >= 20 && x < 36 && y >= 10 && y < 20;
    const link = x >= 3 && x < 20 && y >= 15 - Math.floor(neck / 2) && y < 15 - Math.floor(neck / 2) + neck;
    if (edge) frame[k] = 1;
    if (edge || plate || link) solid[k] = 1;
  }
  return { w, h, res: 0.1, solid, inside, frame };
}

describe('findFlaps', () => {
  test('a wide plate hanging off a narrow link is a flap', () => {
    const f = findFlaps(plateOnNeck(2), 4, 6);
    expect(f.flaps).toHaveLength(1);
    expect(f.flaps[0].width).toBeGreaterThanOrEqual(15);
    expect(f.mask[15 * 60 + 28]).toBe(1);
  });

  test('a plate joined by a wide link bends with the sheet and is not a flap', () => {
    expect(findFlaps(plateOnNeck(10), 4, 6).flaps).toHaveLength(0);
  });

  test('a plate held by narrow links on both sides bends with the sheet and is not a flap', () => {
    const m = plateOnNeck(2);
    for (let x = 36; x < 57; x++) for (const y of [14, 15]) m.solid[y * 60 + x] = 1; // a second narrow link, on the right
    expect(findFlaps(m, 4, 6).flaps).toHaveLength(0);
  });

  test('a narrow plate is too small to lift noticeably', () => {
    expect(findFlaps(plateOnNeck(2), 4, 30).flaps).toHaveLength(0);
  });
});

describe('holdFlaps', () => {
  test('adds a bridge on the far side, so the plate is held at both ends', () => {
    const m = plateOnNeck(2), before = m.solid.slice();
    const added = holdFlaps(m, findFlaps(m, 4, 6).flaps, { bridgePx: 4, maxLenPx: 40 });
    expect(added).toBe(1);
    // The new plastic starts on the plate's far (right) side, away from its link on the left.
    let farSide = 0;
    for (let k = 0; k < m.solid.length; k++) if (m.solid[k] && !before[k] && k % 60 >= 34) farSide++;
    expect(farSide).toBeGreaterThan(0);
    expect(findFlaps(m, 4, 6).flaps).toHaveLength(0);
  });

  test('skips a flap whose nearest anchor is further than the longest allowed bridge', () => {
    const m = plateOnNeck(2);
    expect(holdFlaps(m, findFlaps(m, 4, 6).flaps, { bridgePx: 4, maxLenPx: 5 })).toBe(0);
  });
});
