import { expect, test } from 'vitest';
import { DEFAULTS, settingsFrom } from './state';

test('settings saved by earlier versions become a piece with the band covering it', () => {
  const s = settingsFrom({ botD: 80, topD: 80, slant: 50, frame: 4, coverage: 0.25, res: 0.1 });
  expect(s.piece.profile).toEqual([{ z: 0, d: 80 }, { z: 50, d: 80 }]);
  expect([s.bandFrom, s.bandTo]).toEqual([0, 50]);
  expect([s.above, s.below, s.ends]).toEqual([4, 4, 4]);
  expect([s.coverage, s.res]).toEqual([0.25, 0.1]);
});

test('new settings keep their piece and fill in anything missing', () => {
  const piece = { name: 'Tall mug', profile: [{ z: 0, d: 70 }, { z: 120, d: 74 }] };
  const s = settingsFrom({ piece, bandFrom: 10, bandTo: 100 });
  expect(s.piece).toEqual(piece);
  expect(s.toBase).toBe(DEFAULTS.toBase);
});

test('nothing saved gives the defaults', () => {
  expect(settingsFrom(null)).toEqual(DEFAULTS);
});
