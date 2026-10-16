import { expect, test } from 'vitest';
import { computeStencil } from './pipeline';
import { settingsFrom } from './state';

const cylinder = { name: 'Mug', profile: [{ z: 0, d: 80 }, { z: 60, d: 80 }] };

test('the flat stencil is widened for its thickness, so its pot-side face wraps exactly once round', () => {
  // The stencil bends about its middle, which squeezes the face against the pot by half the thickness.
  const r = computeStencil(settingsFrom({ piece: cylinder, bandFrom: 0, bandTo: 60, coverage: 1, thick: 0.8, res: 0.5 }), [], new Map());
  expect(r.g.arcLength(0)).toBeCloseTo(Math.PI * 80.8, 1);
});
