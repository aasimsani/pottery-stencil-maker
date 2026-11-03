import { expect, test } from 'vitest';
import { computeStencil } from './pipeline';
import { settingsFrom } from './state';
import { newLinesLayer } from './layers';

const cylinder = { name: 'Mug', profile: [{ z: 0, d: 80 }, { z: 60, d: 80 }] };

test('the flat stencil is widened for its thickness, so its pot-side face wraps exactly once round', () => {
  // The stencil bends about its middle, which squeezes the face against the pot by half the thickness.
  const r = computeStencil(settingsFrom({ piece: cylinder, bandFrom: 0, bandTo: 60, coverage: 1, thick: 0.8, res: 0.5 }), [], new Map());
  expect(r.g.arcLength(0)).toBeCloseTo(Math.PI * 80.8, 1);
});

// thinAt() finds the middle of the thin spots in a mask, as shares across and down, so a test can click there.
function thinAt(m: Uint8Array, w: number, h: number) {
  let x = 0, y = 0, n = 0;
  for (let k = 0; k < m.length; k++) if (m[k]) { x += k % w; y += Math.floor(k / w); n++; }
  return { u: x / n / w, v: y / n / h };
}

test('a thin paint line widened by hand gets fixed, and the fix lands on it again at another detail', () => {
  const thin = { ...newLinesLayer(), lines: { ...newLinesLayer().lines, positions: [50], thickness: 0.5 } };
  const base = settingsFrom({ piece: cylinder, bandFrom: 0, bandTo: 40, coverage: 0.25, res: 0.25 });
  const before = computeStencil(base, [thin], new Map());
  expect(before.checks.map((c) => c.id)).toContain('thin-holes');
  const at = thinAt(before.thinHoles, before.mask.w, before.mask.h);
  for (const res of [0.25, 0.2]) {
    const r = computeStencil({ ...base, res, spotFixes: [{ kind: 'hole', ...at, action: 'widen', by: 1 }] }, [thin], new Map());
    expect(r.checks.map((c) => c.id)).not.toContain('thin-holes');
    expect(r.spotsApplied).toBe(1);
  }
});

test('a thin strip of plastic left as drawn warns instead of blocking the download', () => {
  // Two paint lines 0.6 mm apart leave a strip of plastic between them that is too thin.
  const two = { ...newLinesLayer(), lines: { ...newLinesLayer().lines, positions: [45, 54], thickness: 3 } };
  const base = settingsFrom({ piece: cylinder, bandFrom: 0, bandTo: 40, coverage: 0.25, res: 0.25 });
  const before = computeStencil(base, [two], new Map());
  expect(before.checks.filter((c) => c.level === 'error').map((c) => c.id)).toContain('thin-plastic');
  const at = thinAt(before.thinPlastic, before.mask.w, before.mask.h);
  const r = computeStencil({ ...base, spotFixes: [{ kind: 'plastic', ...at, action: 'leave', by: 0 }] }, [two], new Map());
  expect(r.checks.map((c) => `${c.level}:${c.id}`)).toContain('warn:thin-plastic-left');
  expect(r.checks.map((c) => c.id)).not.toContain('thin-plastic');
});
