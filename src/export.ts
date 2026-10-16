import { meshSTL, rotateSTL } from './core/mesh';
import { wrapSTL } from './core/shell';
import type { StencilResult } from './pipeline';
import type { Settings } from './state';

/** The file name for this piece's exports, without an extension. */
export const exportName = (s: Settings) =>
  `stencil_${s.piece.name.replace(/\W+/g, '-').toLowerCase()}_${Math.round(s.bandFrom)}-${Math.round(s.bandTo)}mm`;

// exportSTL() builds the exact file Download STL saves, which is also what the Print file view
// shows. A flat sheet comes rotated to fit the bed. A curved shell comes wrapped, standing upright.
export function exportSTL(s: Settings, r: StencilResult): { stl: ArrayBuffer; name: string } {
  const { mask } = r;
  if (s.printAs === 'shell') {
    // Faces at most 1.5 mm wide keep the curve smooth: a chord that long strays under 0.01 mm on a mug.
    const flat = meshSTL(mask.solid, mask.w, mask.h, mask.res, s.thick, Math.max(1, Math.round(1.5 / mask.res)));
    return { stl: wrapSTL(flat, r.g, s.clearance), name: `${exportName(s)}_shell.stl` };
  }
  const stl = meshSTL(mask.solid, mask.w, mask.h, mask.res, s.thick);
  return { stl: r.rot ? rotateSTL(stl, r.rot) : stl, name: `${exportName(s)}.stl` };
}
