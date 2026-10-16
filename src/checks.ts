import type { IslandMode } from './core/mask';

/** Everything the print check looks at, measured on the finished stencil. */
export interface CheckInput {
  /** Separate pieces of plastic the STL prints as. */
  pieces: number;
  islandMode: IslandMode;
  /** Spots of plastic narrower than minPlastic, and paint holes narrower than minHole. */
  thinPlasticSpots: number; thinHoleSpots: number;
  /** Share of the paint area (0–1) taken up by too-thin paint lines. */
  thinHoleShare: number;
  /** Stencil thickness, nozzle size, minimum widths and bridge width, in mm. */
  thick: number; nozzle: number; minPlastic: number; minHole: number; bridge: number;
  above: number; below: number; ends: number; toBase: boolean;
  fits: boolean;
  /** How far a curved wall strays from the flat stencil, in mm. */
  curve: number;
  strip: boolean;
  /** How much the band's two edges differ in length under a straight strip, in mm. */
  edgeGap: number;
  /** Wide pieces hanging off one narrow link, and how far the worst one lifts when wrapped, in mm. */
  flaps: number; maxLift: number;
  /** Printing as a curved shell, and how far its wall leans from vertical, in degrees. */
  shell: boolean; overhang: number;
  /** Spans of a curved shell that would print in mid-air, and the longest one, in mm. */
  sags: number; worstSag: number;
}

export interface Check {
  id: string;
  /** An error means the print will fail. A warning means it prints but may work badly. */
  level: 'error' | 'warn';
  message: string;
}

const LAYER = 0.2;
/** Thin paint lines covering this share of the paint area or more mean the design won't paint. */
const THIN_PAINT_ERROR = 0.1;

// printChecks() is the guardrail before download. It returns only the checks that fail, errors first.
export function printChecks(i: CheckInput): Check[] {
  const out: Check[] = [];
  const add = (ok: boolean, id: string, level: Check['level'], message: string) => { if (!ok) out.push({ id, level, message }); };

  add(i.pieces <= 1, 'pieces', i.islandMode === 'keep' ? 'warn' : 'error', i.islandMode === 'keep'
    ? `Prints as ${i.pieces} separate pieces, because loose pieces are kept. You'll have to place them by hand.`
    : `Prints as ${i.pieces} separate pieces, which will fall apart on the plate. Add a margin or check that the layers leave plastic joining every part.`);
  add(i.thinPlasticSpots === 0, 'thin-plastic', 'error',
    `${i.thinPlasticSpots} spot${i.thinPlasticSpots > 1 ? 's' : ''} of plastic narrower than ${i.minPlastic} mm, which won't print or will snap when bent. Make the design larger, or reduce Thicken lines and Clear margin around it.`);
  add(i.fits, 'bed', 'error', 'Too big for the bed at any angle. Pick a smaller "Covers" share or a narrower band.');
  add(!i.shell || i.overhang <= 45, 'shell-overhang', 'error',
    `This band leans ${Math.round(i.overhang)}° from upright, too shallow to print as a curved shell without supports. Print it as a flat sheet instead.`);
  add(!i.shell || i.sags === 0, 'sag', 'error',
    `${i.sags} span${i.sags > 1 ? 's' : ''} of the shell would print in mid-air (the longest is ${i.worstSag.toFixed(1)} mm), so ${i.sags > 1 ? 'they' : 'it'} would sag and string. Turn on "Support posts", or make the holes smaller.`);
  add(i.thick >= 2 * LAYER, 'thickness', 'error', `Thinner than 2 layers (${2 * LAYER} mm), which tears when you lift it off the plate.`);

  // A few thin tips are normal in fine art. When thin lines are a big share of the paint, the design itself won't paint.
  const brokenDesign = i.thinHoleShare >= THIN_PAINT_ERROR;
  add(i.thinHoleSpots === 0, 'thin-holes', brokenDesign ? 'error' : 'warn', `${brokenDesign ? `${Math.round(i.thinHoleShare * 100)}% of the paint area is` : `${i.thinHoleSpots} paint line${i.thinHoleSpots > 1 ? 's are' : ' is'}`} narrower than ${i.minHole} mm. The slicer will close ${i.thinHoleSpots > 1 || brokenDesign ? 'them' : 'it'} up and underglaze won't get through. Use Thicken lines on that layer, or make the pattern larger.`);
  add(i.bridge >= 2 * i.nozzle, 'bridge', 'warn', `Bridges narrower than ${2 * i.nozzle} mm (2 nozzle widths) can snap when you wrap the stencil.`);
  add(i.above > 0 || i.below > 0 || i.ends > 0 || i.toBase, 'margins', 'warn', 'No margins, so nothing frames the stencil. It is hard to handle and tape down. Add 3–5 mm.');
  add(i.thick <= 1.2, 'stiff', 'warn', 'Thicker than 1.2 mm, which is stiff to wrap round a pot. 0.6–0.8 mm bends easily.');
  add(i.flaps === 0, 'flaps', 'warn',
    `${i.flaps} wide piece${i.flaps > 1 ? 's hang' : ' hangs'} off one narrow link, so ${i.flaps > 1 ? 'they' : 'it'} will lift up to ${i.maxLift.toFixed(1)} mm off the pot when you wrap the stencil. Turn on "Hold wide pieces at both sides", or join ${i.flaps > 1 ? 'them' : 'it'} to the design.`);
  add(i.curve <= 1.5, 'curve', 'warn', `The wall curves up to ${i.curve.toFixed(1)} mm away from the flat stencil, so it will lift there. Use a narrower band.`);
  add(!i.strip || i.edgeGap <= 3, 'strip', 'warn',
    `The band's edges differ in length by ${i.edgeGap.toFixed(0)} mm, so a straight strip buckles on one edge and gaps on the other. Use the fitted arc.`);

  return [...out.filter((c) => c.level === 'error'), ...out.filter((c) => c.level === 'warn')];
}
