import { expect, it } from 'vitest';
import { makeHandlers, type TabApi } from './tab';
import { DEFAULTS } from '../state';
import type { StencilResult } from '../pipeline';

// fakeApp() rebuilds the way the App does when a design layer is added: one build while the art loads,
// then a second build once it has loaded. Each build takes 100 ms.
function fakeApp() {
  let gen = 0, renderedGen = 0, loading = 0, pieces = 1;
  const result = () => ({ g: { widthMm: 120, heightMm: 60 }, rot: 0, pieces, checks: [], marks: 0, layerInfo: new Map() }) as unknown as StencilResult;
  const build = (g: number, next: number) => setTimeout(() => { renderedGen = g; pieces = next; }, 100);
  const api: TabApi = {
    get: () => ({ s: DEFAULTS, layers: [], result: result(), updating: renderedGen !== gen, error: '', loading, renderedGen }),
    gen: () => gen,
    commit: () => {
      const first = ++gen; loading = 1; build(first, 2);
      setTimeout(() => { const second = ++gen; loading = 0; build(second, 3); }, 150);
    },
    download: () => {},
    baseName: () => 'stencil',
  };
  return api;
}

it("waits for the build that includes the new design's art before it replies", async () => {
  const h = makeHandlers(fakeApp());
  const reply = (await h.apply({ ops: [{ op: 'settings', patch: { thick: 0.8 } }] } as never)) as { pieces: number };
  expect(reply.pieces).toBe(3);
});
