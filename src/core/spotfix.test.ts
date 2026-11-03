import { describe, expect, it } from 'vitest';
import { applySpotFixes, dropSpots, listSpots } from './spotfix';
import { thinFeatures } from './thin';
import type { Mask } from './mask';

// mask() draws a stencil from rows of '#' (plastic) and '.' (paint hole). Everything is inside, and nothing is frame.
const mask = (rows: string[]): Mask => {
  const w = rows[0].length, h = rows.length, solid = Uint8Array.from(rows.join('').split(''), (c) => (c === '#' ? 1 : 0));
  return { w, h, res: 0.1, solid, inside: new Uint8Array(w * h).fill(1), frame: new Uint8Array(w * h) };
};
const width = (m: Mask, y: number, x0: number, x1: number, v = 1) => m.solid.slice(y * m.w + x0, y * m.w + x1).reduce((a, s) => a + (s === v ? 1 : 0), 0);
// Two 1 px strips of plastic, at x = 5 and x = 15, standing in paint.
const twoBars = () => mask(Array.from({ length: 30 }, () => '.....#.........#..............'));
const o = { plasticPx: 3, holePx: 3 };

describe('spot fixes', () => {
  it('changes only the spot it names', () => {
    const m = twoBars();
    expect(applySpotFixes(m, [{ kind: 'plastic', x: 5, y: 15, action: 'thicken', byPx: 3 }], o)).toBe(1);
    expect(width(m, 15, 0, 10)).toBeGreaterThanOrEqual(3);
    expect(width(m, 15, 10, 20)).toBe(1);
  });
  it('finds a spot from a click a few pixels off it', () => {
    const m = twoBars();
    applySpotFixes(m, [{ kind: 'plastic', x: 8, y: 15, action: 'open', byPx: 0 }], o);
    expect(width(m, 15, 0, 10)).toBe(0);
    expect(width(m, 15, 10, 20)).toBe(1);
  });
  it('widens a thin paint line by the amount asked for', () => {
    const gap = (byPx: number) => {
      const m = mask(Array.from({ length: 30 }, () => `..${'#'.repeat(8)}.${'#'.repeat(8)}......`));
      applySpotFixes(m, [{ kind: 'hole', x: 10, y: 15, action: 'widen', byPx }], o);
      return width(m, 15, 2, 19, 0);
    };
    expect(gap(4)).toBeGreaterThan(gap(2));
    expect(gap(2)).toBeGreaterThanOrEqual(3);
  });
  it('lets a spot that was left alone drop out of the count', () => {
    const m = twoBars(), t = thinFeatures(m.solid, m.w, m.h, 3, 18);
    expect(t.spots).toBe(2);
    expect(dropSpots(t.mask, m.w, m.h, [{ x: 5, y: 15 }]).spots).toBe(1);
  });
});

describe('listSpots', () => {
  it('lists each spot with a point that lies on the spot, even for a curved one', () => {
    // A ring, whose centre is empty, and a straight line.
    const ring = Array.from({ length: 40 }, (_, y) => Array.from({ length: 60 }, (_, x) => {
      const r = Math.hypot(x - 15, y - 20);
      return (r > 9 && r < 10.6) || x === 45 ? '#' : '.';
    }).join(''));
    const m = mask(ring), t = thinFeatures(m.solid, m.w, m.h, 3, 18).mask, spots = listSpots(t, m.w, m.h);
    expect(spots).toHaveLength(2);
    for (const s of spots) expect(t[s.y * m.w + s.x]).toBe(1);
    expect(spots[0].area).toBeGreaterThanOrEqual(spots[1].area);
  });
});
