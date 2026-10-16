import type { IslandResult, Mask } from '../core/mask';

type RGB = [number, number, number];

/** Resolves a CSS colour (including var() tokens) to RGB by painting one canvas pixel. */
export function cssRgb(value: string): RGB {
  const c = document.createElement('canvas').getContext('2d', { willReadFrequently: true })!;
  c.fillStyle = value.startsWith('--') ? getComputedStyle(document.documentElement).getPropertyValue(value).trim() : value;
  c.fillRect(0, 0, 1, 1);
  const [r, g, b] = c.getImageData(0, 0, 1, 1).data;
  return [r, g, b];
}

// drawFlat() shows the stencil as printed: plastic, bridges, loose islands, and holes.
export function drawFlat(cv: HTMLCanvasElement, mask: Mask, isl: IslandResult, showIslands: boolean, problems?: { plastic: Uint8Array; holes: Uint8Array; flaps: Uint8Array; sags?: Uint8Array }): void {
  cv.width = mask.w; cv.height = mask.h;
  const ctx = cv.getContext('2d')!, img = ctx.createImageData(mask.w, mask.h), d = img.data;
  const plastic = cssRgb('--plastic'), island = cssRgb('--island'), bridge = cssRgb('--bridge'), hole = cssRgb('--hole'), thinHole = cssRgb('--thin-hole'), flap = cssRgb('--flap'), sag = cssRgb('--sag');
  for (let k = 0; k < mask.solid.length; k++) {
    if (!mask.inside[k]) continue;
    const col = problems?.plastic[k] ? island : problems?.sags?.[k] ? sag : problems?.holes[k] ? thinHole : problems?.flaps[k] && mask.solid[k] ? flap
      : showIslands && isl.islandMask[k] && mask.solid[k] ? island : isl.bridgeMask[k] ? bridge : mask.solid[k] ? plastic : null;
    const o = k * 4;
    if (col) { d[o] = col[0]; d[o + 1] = col[1]; d[o + 2] = col[2]; d[o + 3] = 255; }
    else { d[o] = hole[0]; d[o + 1] = hole[1]; d[o + 2] = hole[2]; d[o + 3] = 255; }
  }
  ctx.putImageData(img, 0, 0);
}
