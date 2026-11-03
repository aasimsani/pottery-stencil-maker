import { describe, expect, it } from 'vitest';
import { coverageGrid, gridTicks, printsMask } from './sight';

describe('printsMask', () => {
  it('drops thin plastic, closes thin paint lines, and keeps everything else as drawn', () => {
    const relief = Uint8Array.from([1, 1, 0, 1, 0, 0]);
    const thinLines = Uint8Array.from([0, 1, 0, 0, 0, 0]);
    const thinGaps = Uint8Array.from([0, 0, 1, 0, 0, 0]);
    expect([...printsMask(relief, thinLines, thinGaps)]).toEqual([1, 0, 1, 1, 0, 0]);
  });
});

describe('coverageGrid', () => {
  it('gives each cell its share painted, counting only pixels inside the outline', () => {
    // A 4 × 2 stencil, painted on its left half, with one pixel of that half outside the outline.
    const paint = Uint8Array.from([1, 1, 0, 0, 1, 0, 0, 0]), inside = Uint8Array.from([1, 1, 1, 1, 1, 0, 1, 1]);
    const g = coverageGrid(paint, inside, 4, 2, 2, 1, []);
    expect(g.cells).toEqual([[100, 0]]);
    expect(g.painted).toBe(43);
  });
  it('counts the flagged spots in each cell', () => {
    const g = coverageGrid(new Uint8Array(8), new Uint8Array(8).fill(1), 4, 2, 2, 1, [{ u: 0.2, v: 0.5 }, { u: 0.9, v: 0.5 }, { u: 0.8, v: 0.1 }]);
    expect(g.spots).toEqual([[1, 2]]);
  });
});

describe('gridTicks', () => {
  it('picks round steps that give a readable number of lines at any zoom', () => {
    for (const [a, b] of [[0, 1], [0.3, 0.42], [0.5, 0.505]] as const) {
      const t = gridTicks(a, b);
      expect(t.length).toBeGreaterThanOrEqual(4);
      expect(t.length).toBeLessThanOrEqual(12);
      for (const v of t) expect(v).toBeGreaterThanOrEqual(a - 1e-9);
    }
    expect(gridTicks(0, 1)).toEqual([0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1]);
  });
});
