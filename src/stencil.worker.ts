import { finishStencil, type Prepared, type StencilResult } from './pipeline';
import type { Settings } from './state';

// The stencil worker runs finishStencil() off the page, so typing never waits on a rebuild.
// The geometry holds functions, which can't be posted back, so the page rebuilds it from result.gp.
export type WorkerResult = Omit<StencilResult, 'g'>;
export interface WorkerRequest { id: number; s: Settings; prepared: Prepared }
export type WorkerReply = { id: number; result: WorkerResult } | { id: number; error: string };

const ctx = self as unknown as { postMessage(m: WorkerReply, transfer?: Transferable[]): void; onmessage: ((e: MessageEvent<WorkerRequest>) => void) | null };

ctx.onmessage = ({ data: { id, s, prepared } }) => {
  try {
    const { g: _g, ...result } = finishStencil(s, prepared);
    // Hand the big arrays back without copying them.
    const arrays = [result.mask.solid, result.mask.inside, result.mask.frame, result.isl.islandMask, result.isl.bridgeMask,
      result.thinPlastic, result.thinHoles, result.flapMask, result.sagMask].filter((a): a is Uint8Array => !!a);
    ctx.postMessage({ id, result }, arrays.map((a) => a.buffer as ArrayBuffer));
  } catch (e) {
    ctx.postMessage({ id, error: e instanceof Error ? e.message : String(e) });
  }
};
