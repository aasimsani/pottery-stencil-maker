import { expect, test } from 'vitest';
import { scaleDesign, widestD } from './scale';
import { DEFAULTS } from './state';
import { newLinesLayer } from './layers';
import { computeStencil } from './pipeline';

const mug = { name: 'Mug', profile: [{ z: 0, d: 80 }, { z: 95, d: 80 }] };

test('scaling grows the piece, the band, and every size set in mm, and keeps the print settings', () => {
  const s = { ...DEFAULTS, piece: mug, bandFrom: 20, bandTo: 70 };
  const lines = { ...newLinesLayer(), patternSize: 10, halo: 1, grow: 0.2 };
  lines.lines = { ...lines.lines, thickness: 2, length: 20, gap: 4, amplitude: 3 };
  const [t, [l]] = scaleDesign(s, [lines], 1.5);
  expect(t.piece.profile).toEqual([{ z: 0, d: 120 }, { z: 142.5, d: 120 }]);
  expect([t.bandFrom, t.bandTo]).toEqual([30, 105]);
  expect([l.patternSize, l.halo, l.grow]).toEqual([15, 1.5, 0.3]);
  expect(l.lines).toMatchObject({ thickness: 3, length: 30, gap: 6, amplitude: 4.5, positions: lines.lines.positions });
  // Margins, thickness, and the printer limits are about printing and handling, so they stay put.
  expect([t.above, t.below, t.ends, t.thick, t.bridge, t.minHole]).toEqual([s.above, s.below, s.ends, s.thick, s.bridge, s.minHole]);
  expect(t.piece.name).toBe('Mug ×1.5');
});

test('a scaled design keeps its number of repeats round the band', () => {
  const s = { ...DEFAULTS, piece: mug, bandFrom: 20, bandTo: 70, coverage: 0.5 };
  const layers = [{ ...newLinesLayer(), lines: { ...newLinesLayer().lines, style: 'wavy' as const, length: 21, amplitude: 3 } }];
  const before = computeStencil(s, layers, new Map()), after = computeStencil(...scaleDesign(s, layers, 1.25), new Map());
  expect(after.layerInfo.get(layers[0].id)!.repeats).toBe(before.layerInfo.get(layers[0].id)!.repeats);
});

test('widestD finds the widest point of the piece', () => {
  expect(widestD({ name: 'Vase', profile: [{ z: 0, d: 60 }, { z: 40, d: 110 }, { z: 90, d: 70 }] })).toBe(110);
});
