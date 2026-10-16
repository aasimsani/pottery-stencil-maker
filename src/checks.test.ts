import { expect, test } from 'vitest';
import { printChecks, type CheckInput } from './checks';

const good: CheckInput = {
  pieces: 1, islandMode: 'bridge', thinPlasticSpots: 0, thinHoleSpots: 0, thinHoleShare: 0,
  thick: 0.8, nozzle: 0.4, minPlastic: 0.8, minHole: 0.8, bridge: 1.6,
  above: 5, below: 5, ends: 5, toBase: false, fits: true, curve: 0, strip: false, edgeGap: 0, flaps: 0, maxLift: 0, shell: false, overhang: 0, sags: 0, worstSag: 0,
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
