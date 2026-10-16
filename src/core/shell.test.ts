import { expect, test } from 'vitest';
import { geometry } from './geometry';
import { meshSTL } from './mesh';
import { wrapSTL } from './shell';
import { checkStl } from '../test/stl';

// Half a mug, 80 mm across and 30 mm tall, with no border, rasterised at 0.25 mm.
const g = geometry({ topD: 80, botD: 80, slant: 30, coverage: 0.5, frame: 0, res: 0.25 });
const thick = 0.8, clearance = 0.2;
const shell = (keep: (i: number, j: number) => boolean) => {
  const solid = new Uint8Array(g.W * g.H);
  for (let j = 0; j < g.H; j++) for (let i = 0; i < g.W; i++) solid[j * g.W + i] = g.sample(i, j) && keep(i, j) ? 1 : 0;
  return wrapSTL(meshSTL(solid, g.W, g.H, g.res, thick, 8), g, clearance);
};

test('a wrapped half shell is closed, faces outward, and hugs the pot with the clearance', () => {
  const st = checkStl(shell(() => true));
  const rIn = 40 + clearance, rOut = rIn + thick;
  expect(Math.abs(st.volume / ((Math.PI / 2) * (rOut ** 2 - rIn ** 2) * 30) - 1)).toBeLessThan(0.015);
  // Half a turn from theta −90° to +90°: it reaches the outer radius at the front (+y) and at both sides (±x).
  expect(st.max[1]).toBeCloseTo(rOut, 1);
  expect(st.max[0]).toBeCloseTo(rOut, 1);
  expect(st.min[0]).toBeCloseTo(-rOut, 1);
  expect(Math.abs(st.min[1])).toBeLessThan(0.3);
  expect(st.min[2]).toBeCloseTo(0, 6); // standing on the bed
  expect(st.max[2]).toBeCloseTo(30, 0);
});

test('the shell is not mirrored: the left of the flat stencil sits on the left as you face it', () => {
  // Viewed from the front (+y) looking at the pot, your left is +x.
  const st = checkStl(shell((i) => i < g.W * 0.25));
  expect(st.centroid[0]).toBeGreaterThan(10);
});
