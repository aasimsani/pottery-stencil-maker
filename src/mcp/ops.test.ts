import { describe, expect, it } from 'vitest';
import { applyOps, type DesignState } from './ops';
import { DEFAULTS } from '../state';
import { newLinesLayer } from '../layers';

const start = (): DesignState => ({ settings: { ...DEFAULTS }, layers: [{ ...newLinesLayer(), id: 'L1' }] });

describe('applyOps', () => {
  it('rejects an unknown setting and names the closest one', () => {
    expect(() => applyOps(start(), [{ op: 'settings', patch: { thik: 0.8 } }])).toThrow(/thik.*thick/);
  });
  it('rejects a setting of the wrong type', () => {
    expect(() => applyOps(start(), [{ op: 'settings', patch: { thick: '0.8' } }])).toThrow(/thick/);
  });
  it('only accepts the coverage shares the stencil offers', () => {
    expect(() => applyOps(start(), [{ op: 'settings', patch: { coverage: 0.4 } }])).toThrow(/coverage/);
    // A rounded third snaps to the exact share, so the Covers select still shows it.
    expect(applyOps(start(), [{ op: 'settings', patch: { coverage: 0.3333 } }]).settings.coverage).toBe(1 / 3);
  });
  it('rejects a string outside its choices', () => {
    expect(() => applyOps(start(), [{ op: 'settings', patch: { printAs: 'curved' } }])).toThrow(/printAs/);
  });
  it('keeps the piece fields a nested patch does not name', () => {
    const s = applyOps(start(), [{ op: 'settings', patch: { piece: { name: 'Tall mug' } } }]).settings;
    expect(s.piece).toEqual({ ...DEFAULTS.piece, name: 'Tall mug' });
  });
  it('applies a whole batch, or leaves the design as it was when one change is bad', () => {
    const before = start();
    expect(() => applyOps(before, [{ op: 'settings', patch: { thick: 0.8 } }, { op: 'updateLayer', id: 'nope', patch: {} }])).toThrow(/nope/);
    expect(before.settings.thick).toBe(DEFAULTS.thick);
    const after = applyOps(before, [{ op: 'settings', patch: { thick: 0.8 } }, { op: 'updateLayer', id: 'L1', patch: { grow: 0.3 } }]);
    expect([after.settings.thick, after.layers[0].grow]).toEqual([0.8, 0.3]);
  });
  it('checks layer fields too, including the nested lines', () => {
    expect(() => applyOps(start(), [{ op: 'updateLayer', id: 'L1', patch: { size: 'big' } }])).toThrow(/size/);
    const l = applyOps(start(), [{ op: 'updateLayer', id: 'L1', patch: { lines: { thickness: 3 } } }]).layers[0];
    expect(l.lines).toEqual({ ...newLinesLayer().lines, thickness: 3 });
  });
  it('adds, moves and removes layers', () => {
    let s = applyOps(start(), [{ op: 'addLayer', kind: 'lines' }]);
    expect(s.layers).toHaveLength(2);
    s = applyOps(s, [{ op: 'moveLayer', id: 'L1', to: 1 }]);
    expect(s.layers[1].id).toBe('L1');
    expect(applyOps(s, [{ op: 'removeLayer', id: 'L1' }]).layers.map((l) => l.id)).not.toContain('L1');
  });
});

describe('spot fixes through the MCP', () => {
  it('adds a checked spot fix, and refuses a bad action or a point off the stencil', () => {
    const fix = { kind: 'hole', u: 0.4, v: 0.5, action: 'widen', by: 0.6 };
    expect(applyOps(start(), [{ op: 'spotFix', fix }]).settings.spotFixes).toEqual([fix]);
    expect(() => applyOps(start(), [{ op: 'spotFix', fix: { ...fix, action: 'thicken' } }])).toThrow(/action/);
    expect(() => applyOps(start(), [{ op: 'spotFix', fix: { ...fix, v: -0.1 } }])).toThrow(/v/);
  });
});

describe('undoing one spot fix through the MCP', () => {
  it('removes the fix at an index, and refuses an index that has no fix', () => {
    const two = applyOps(start(), [{ op: 'spotFix', fix: { kind: 'plastic', u: 0.1, v: 0.1, action: 'leave', by: 0 } }, { op: 'spotFix', fix: { kind: 'hole', u: 0.2, v: 0.2, action: 'close', by: 0 } }]);
    expect(applyOps(two, [{ op: 'removeSpotFix', index: 0 }]).settings.spotFixes.map((f) => f.kind)).toEqual(['hole']);
    expect(() => applyOps(two, [{ op: 'removeSpotFix', index: 5 }])).toThrow(/index/);
  });
});
