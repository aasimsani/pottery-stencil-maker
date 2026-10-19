import { describe, expect, test } from 'vitest';
import { addMarks } from './marks';
import { geometry } from './geometry';
import { buildMask, countPieces } from './mask';
import { computeStencil } from '../pipeline';
import { DEFAULTS } from '../state';

// Half of an 80 mm mug, with a 45 mm band and 5 mm margins. With no layers, the stencil is all plastic.
const g = geometry({ topD: 80, botD: 80, slant: 45, coverage: 0.5, frame: 5, res: 0.15 });
const hole = (m: ReturnType<typeof buildMask>, s: number, frac: number) => m.solid[g.toPixel(s, frac)] === 0;

describe('addMarks', () => {
  test('cuts a mark above and below each end of the band, in the margins', () => {
    const m = buildMask(g, []);
    expect(addMarks(m, g, { radius: 1, top: 5, bottom: 5 })).toBe(4);
    for (const frac of [0, 1]) {
      expect(hole(m, 47.5, frac)).toBe(true); // halfway into the top margin
      expect(hole(m, -2.5, frac)).toBe(true); // halfway into the bottom margin
    }
    expect(hole(m, 47.5, 0.5)).toBe(false);
    expect(hole(m, 22.5, 0)).toBe(false); // the band itself is left alone
    expect(countPieces(m.solid, m.w, m.h)).toBe(1);
  });

  test('a mark sits at most 3 mm from the band, so a deep margin keeps it near the paint', () => {
    const deep = geometry({ topD: 80, botD: 80, slant: 45, coverage: 0.5, frame: 5, frameBottom: 20, res: 0.15 });
    const m = buildMask(deep, []);
    addMarks(m, deep, { radius: 1, top: 5, bottom: 20 });
    expect(m.solid[deep.toPixel(-3, 0)]).toBe(0);
  });

  test('a margin too narrow to hold a mark with plastic round it gets none', () => {
    const m = buildMask(g, []);
    expect(addMarks(m, g, { radius: 1, top: 3, bottom: 5 })).toBe(2);
  });
});

describe('repeat marks in the pipeline', () => {
  const mug = { name: 'Mug', profile: [{ z: 0, d: 80 }, { z: 95, d: 80 }] };
  const s = { ...DEFAULTS, piece: mug, bandFrom: 25, bandTo: 70, res: 0.25 };

  test('a partial wrap gets marks and still passes the print check', () => {
    const r = computeStencil({ ...s, coverage: 0.5, marks: true }, [], new Map());
    expect(r.marks).toBe(4);
    expect(r.checks).toEqual([]);
  });

  test('a full wrap, or marks turned off, gets none', () => {
    expect(computeStencil({ ...s, coverage: 1, marks: true }, [], new Map()).marks).toBe(0);
    expect(computeStencil({ ...s, coverage: 0.5, marks: false }, [], new Map()).marks).toBe(0);
  });
});
