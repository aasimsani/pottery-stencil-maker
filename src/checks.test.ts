import { expect, test } from 'vitest';
import { printChecks, type CheckInput } from './checks';

const good: CheckInput = {
  pieces: 1, islandMode: 'bridge', thinPlasticSpots: 0, thinHoleSpots: 0, thinHoleShare: 0,
  thick: 0.8, nozzle: 0.4, minPlastic: 0.8, minHole: 0.8, bridge: 1.6,
  thinPlasticLeft: 0,
  above: 5, below: 5, ends: 5, toBase: false, fits: true, curve: 0, strip: false, edgeGap: 0, flaps: 0, maxLift: 0, shell: false, overhang: 0, sags: 0, worstSag: 0,
  tpu: false, potD: 80,
};
const ids = (i: Partial<CheckInput>) => printChecks({ ...good, ...i }).map((c) => `${c.level}:${c.id}`);

test('a sound stencil passes every check', () => {
  expect(printChecks(good)).toEqual([]);
});

test('plastic that falls apart, is too thin, or does not fit the bed is an error', () => {
  expect(ids({ pieces: 3 })).toContain('error:pieces');
  expect(ids({ thinPlasticSpots: 2 })).toContain('error:thin-plastic');
  expect(ids({ fits: false })).toContain('error:bed');
  expect(ids({ thick: 0.2 })).toContain('error:thickness');
});

test('loose pieces you chose to keep are a warning, not an error', () => {
  expect(ids({ pieces: 3, islandMode: 'keep' })).toEqual(['warn:pieces']);
});

test('things that print but work badly are warnings', () => {
  expect(ids({ thinHoleSpots: 4, thinHoleShare: 0.02 })).toEqual(['warn:thin-holes']);
  expect(ids({ bridge: 0.6 })).toEqual(['warn:bridge']);
  expect(ids({ above: 0, below: 0, ends: 0 })).toEqual(['warn:margins']);
  expect(ids({ thick: 1.6 })).toEqual(['warn:stiff']);
  expect(ids({ curve: 3 })).toEqual(['warn:curve']);
  expect(ids({ strip: true, edgeGap: 12 })).toEqual(['warn:strip']);
});

test('paint lines too thin across a large share of the design are an error, since the design will not paint', () => {
  expect(ids({ thinHoleSpots: 17, thinHoleShare: 0.31 })).toEqual(['error:thin-holes']);
  expect(ids({ thinHoleSpots: 17, thinHoleShare: 0.09 })).toEqual(['warn:thin-holes']);
});

test('pieces that lift when wrapped are a warning that says how far', () => {
  const [c] = printChecks({ ...good, flaps: 3, maxLift: 4.6 });
  expect(`${c.level}:${c.id}`).toBe('warn:flaps');
  expect(c.message).toMatch(/3 wide pieces/);
  expect(c.message).toMatch(/4\.6 mm/);
});

test('a curved shell needs walls steep enough to print upright without supports', () => {
  expect(ids({ shell: true, overhang: 30 })).toEqual([]);
  expect(ids({ shell: true, overhang: 60 })).toEqual(['error:shell-overhang']);
  expect(ids({ shell: false, overhang: 60 })).toEqual([]);
});

test('a shell with spans that would print in mid-air is an error', () => {
  const [c] = printChecks({ ...good, shell: true, sags: 3, worstSag: 12.5 });
  expect(`${c.level}:${c.id}`).toBe('error:sag');
  expect(c.message).toMatch(/12\.5 mm/);
});

test('reaching the base counts as a bottom margin', () => {
  expect(ids({ above: 0, below: 0, ends: 0, toBase: true })).toEqual([]);
});

test('errors come before warnings', () => {
  expect(ids({ thinHoleSpots: 1, thinHoleShare: 0.01, pieces: 2 })).toEqual(['error:pieces', 'warn:thin-holes']);
});

test('plastic the user left thin is a warning, because they chose it', () => {
  expect(ids({ thinPlasticLeft: 2 })).toEqual(['warn:thin-plastic-left']);
});

const message = (i: Partial<CheckInput>, id: string) => printChecks({ ...good, ...i }).find((c) => c.id === id)?.message ?? '';

test('a thick TPU stencil still bends, so it skips the stiffness warning', () => {
  expect(ids({ thick: 1.6 })).toEqual(['warn:stiff']);
  expect(ids({ thick: 1.6, tpu: true })).toEqual([]);
});
test('TPU stretches to follow a curved wall, by about 5% of the pot\'s radius', () => {
  // A rigid sheet lifts past 1.5 mm. On a Ø100 pot, TPU follows 2.5 mm.
  expect(ids({ curve: 2.4, potD: 100 })).toEqual(['warn:curve']);
  expect(ids({ curve: 2.4, potD: 100, tpu: true })).toEqual([]);
  expect(ids({ curve: 3, potD: 100, tpu: true })).toEqual(['warn:curve']);
  expect(message({ curve: 3, potD: 100, tpu: true }, 'curve')).toContain('2.5 mm');
});
test('on a small pot, TPU follows no less than a rigid sheet does', () => {
  expect(ids({ curve: 1.4, potD: 40, tpu: true })).toEqual([]);
  expect(ids({ curve: 1.6, potD: 40, tpu: true })).toEqual(['warn:curve']);
});
test('TPU warns against a curved shell and against a nozzle under 0.4 mm', () => {
  expect(ids({ tpu: true, shell: true })).toEqual(['warn:tpu-shell']);
  expect(ids({ tpu: true, nozzle: 0.2, minPlastic: 0.4, minHole: 0.4, bridge: 1.6 })).toEqual(['warn:tpu-nozzle']);
  expect(ids({ shell: true, nozzle: 0.2 })).toEqual([]);
});
test('TPU doesn\'t snap, so its thin-plastic and bridge messages don\'t say it does', () => {
  expect(message({ thinPlasticSpots: 1 }, 'thin-plastic')).toContain('snap');
  expect(message({ thinPlasticSpots: 1, tpu: true }, 'thin-plastic')).not.toContain('snap');
  expect(message({ thinPlasticLeft: 1, tpu: true }, 'thin-plastic-left')).not.toContain('snap');
  expect(message({ bridge: 0.6, tpu: true }, 'bridge')).not.toContain('snap');
});
