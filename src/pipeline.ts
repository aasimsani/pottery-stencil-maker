import { geometry, type BandParams, type Geometry } from './core/geometry';
import { buildMask, connectIslands, countPieces, removePinches, type IslandResult, type Mask, type MaskLayer } from './core/mask';
import { planCells } from './core/layout';
import { linePeriod, makeLinesTile } from './core/lines';
import { fitAngle } from './core/bed';
import { bandOnPiece, type Band } from './core/piece';
import { thinFeatures } from './core/thin';
import { findFlaps, holdFlaps } from './core/flaps';
import { addPosts, findSags, layerGrid } from './core/overhang';
import { addMarks } from './core/marks';
import { printChecks, type Check } from './checks';
import { renderTile } from './render/tile';
import { refKey, type Art } from './render/art';
import type { Layer } from './layers';
import type { Settings } from './state';

/** How a layer actually repeats once sized to the band. Textures and lines pick their own counts. */
export interface LayerInfo { repeats: number; rows: number; cellW: number; cellH: number }

export interface StencilResult {
  g: Geometry;
  /** The parameters g was built from, so a result posted back from a worker can rebuild it. */
  gp: BandParams;
  mask: Mask;
  isl: IslandResult;
  /** Rotation that fits the bed, or null when nothing fits. */
  rot: number | null;
  /** Length difference between the band's two edges over the stencil's span, in mm. */
  edgeGap: number;
  /** Separate pieces of plastic the STL prints as. Anything above 1 falls apart on the plate. */
  pieces: number;
  /** Spots of plastic, and of paint holes, narrower than the minimum widths (1 = too thin). */
  thinPlastic: Uint8Array; thinHoles: Uint8Array;
  /** The print check's failures, errors first. */
  checks: Check[];
  /** Wide pieces still hanging off one narrow link (1 = flap), and how many bridges were added to hold the rest. */
  flapMask: Uint8Array; flapBridges: number;
  /** The curved shell's outside diameter and height in mm, as it stands on the bed. Flat sheets leave it unset. */
  shellSize?: [number, number];
  /** In a curved shell, sagMask marks spans that still print in mid-air (1 = sags), and posts counts the support posts the pipeline added. */
  sagMask?: Uint8Array; posts: number;
  /** How many repeat marks the margins got. */
  marks: number;
  /** Where the stencil sits on the piece, and how far a curved wall strays from it. */
  band: Band;
  layerInfo: Map<string, LayerInfo>;
}

/** Edge clearance kept on every side of the bed, in mm. */
export const BED_MARGIN = 3;
/** A link narrower than this (mm) acts as a hinge when the stencil bends. */
const FLAP_NECK = 2;
/** Pieces narrower than this (mm) across the band lift too little to matter. */
const FLAP_MIN_WIDTH = 6;
/** The longest bridge added to hold a flap, in mm. */
const FLAP_MAX_BRIDGE = 8;
/** The opening left in a full-wrap shell so it springs open round the pot, in mm. */
const SHELL_SLIT = 3;
/** The tallest shell the printer builds, in mm (Bambu Lab P2S). */
const SHELL_MAX_HEIGHT = 250;
/** A repeat mark is a 2 mm hole, big enough for a pencil tip. */
const MARK_RADIUS = 1;
/** Upright shells: 0.2 mm layers, and a shelf may reach 2 mm (about 5 line widths) out unsupported, which
 *  covers the sloping tops of round holes. A point that starts in mid-air may be one 0.4 mm line wide,
 *  which droops too little to matter. maxBridge comes from the settings. */
const SAG = { layer: 0.2, maxBridge: 8, maxReach: 2, maxFloat: 0.4 };

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

// layerToMask() renders one layer into a repeat cell sized for the band. arc is the band's
// length round its middle line and bandH its height along the surface, both in mm.
function layerToMask(L: Layer, arc: number, bandH: number, res: number, arts: Map<string, Art>): [MaskLayer, LayerInfo] | null {
  if (!L.visible) return null;
  // Lines are positioned against the whole band, so they ignore the layer's slice.
  const from = L.kind === 'lines' ? 0 : clamp(L.from, 0, 99), to = L.kind === 'lines' ? 100 : clamp(L.to, from + 1, 100);
  const sliceH = (bandH * (to - from)) / 100;
  let tile, repeats, rows;
  if (L.kind === 'lines') {
    repeats = Math.max(1, Math.round(arc / linePeriod(L.lines))); rows = 1;
    tile = makeLinesTile(L.lines, arc / repeats, sliceH, res);
  } else {
    const art = L.ref && arts.get(refKey(L.ref));
    if (!art) return null; // still loading
    const image = { threshold: L.threshold, invert: L.invert, smooth: L.smooth };
    if (L.ref!.texture) {
      // A seamless pattern repeats at its own size, rounded so whole repeats fit the slice and the circumference.
      rows = Math.max(1, Math.round(sliceH / Math.max(1, L.patternSize)));
      repeats = Math.max(1, Math.round(arc / ((sliceH / rows) * art.aspect)));
      tile = renderTile({ textures: [0], placements: [] }, [{ scale: 1, art }], arc / repeats, sliceH / rows, res, image, false);
    } else {
      repeats = Math.max(1, Math.round(L.repeats)); rows = Math.max(1, Math.round(L.rows));
      const cw = arc / repeats, ch = sliceH / rows, scatter = L.arrange === 'scatter';
      const [plan] = planCells([{ texture: false, scale: L.size / 100, rotate: L.rotate }], scatter ? 'scatter' : 'together', cw, ch,
        { count: L.count, seed: L.seed, jitter: L.jitter });
      tile = renderTile(plan, [{ scale: L.size / 100, art }], cw, ch, res, image, scatter);
    }
  }
  const info = { repeats, rows, cellW: arc / repeats, cellH: sliceH / rows };
  return [{
    tile, repeats, rows, stagger: L.stagger, offsetU: L.offsetX / 100, offsetV: L.offsetY / 100,
    from: from / 100, to: to / 100, blend: L.blend, haloPx: L.halo / res,
    // Layers saved before thickening existed have no grow value.
    growPx: (L.grow ?? 0) / res,
  }, info];
}

/** Everything finishStencil() needs. It is plain data, so it can be posted to a Web Worker. */
export interface Prepared {
  /** The geometry's parameters. Functions can't cross to a worker, so each side rebuilds the geometry from these. */
  gp: BandParams;
  maskLayers: MaskLayer[];
  layerInfo: Map<string, LayerInfo>;
  band: Band;
  shell: boolean; strip: boolean;
}

// prepareStencil() fits the stencil to the piece and renders each layer's repeat cell. Rendering
// draws on canvases, so this half runs on the page. It is quick compared with finishStencil().
export function prepareStencil(s: Settings, layers: Layer[], arts: Map<string, Art>): Prepared {
  const band = bandOnPiece(s.piece, { from: s.bandFrom, to: s.bandTo, above: s.above, below: s.below, ends: s.ends, toBase: s.toBase });
  const shell = s.printAs === 'shell';
  // A curved shell can't overlap itself, so a full wrap leaves a slit wide enough to spring it open.
  const around = Math.PI * (band.topD + band.botD) / 2;
  const coverage = shell ? Math.min(s.coverage, (around - 2 * band.frame - SHELL_SLIT) / around) : s.coverage;
  // A straight strip is the cylinder with the band's mean diameter, so it matches the middle line exactly.
  // A flat stencil bends about its middle layer, which squeezes its pot-side face by half the thickness
  // all round. Unrolling at the diameter plus the thickness makes that face wrap exactly once round.
  // A curved shell is printed in shape and never bends, so it needs no allowance.
  const mid = (band.topD + band.botD) / 2, strip = s.shape === 'strip' && !shell, allowance = shell ? 0 : s.thick;
  const gp: BandParams = {
    topD: (strip ? mid : band.topD) + allowance, botD: (strip ? mid : band.botD) + allowance, slant: band.slant, coverage,
    frame: band.frame, frameTop: band.frameTop, frameBottom: band.frameBottom, res: s.res,
  };
  const [arc, bandH] = geometry(gp).cellMm(1, 1);
  const maskLayers: MaskLayer[] = [], layerInfo = new Map<string, LayerInfo>();
  for (const L of layers) {
    const r = layerToMask(L, arc, bandH, s.res, arts);
    if (r) { maskLayers.push(r[0]); layerInfo.set(L.id, r[1]); }
  }
  return { gp, maskLayers, layerInfo, band, shell, strip };
}

// computeStencil() turns the settings and the loaded layers into a printable stencil, all on one thread.
export const computeStencil = (s: Settings, layers: Layer[], arts: Map<string, Art>): StencilResult =>
  finishStencil(s, prepareStencil(s, layers, arts));

// finishStencil() builds the stencil from its prepared layers, then makes it printable and checks it:
// bridges, held flaps, support posts, bed fit, and the print check. It touches no DOM, so it can run
// in a Web Worker and keep the page responsive while you type.
export function finishStencil(s: Settings, { gp, maskLayers, layerInfo, band, shell, strip }: Prepared): StencilResult {
  const g = geometry(gp), { topD, botD } = gp;
  const mask = buildMask(g, maskLayers);
  const isl = connectIslands(mask, { mode: s.islandMode, bridgePx: s.bridge / s.res, minIslandPx: 0.5 / (s.res * s.res) });
  removePinches(mask.solid, mask.w, mask.h);
  const marks = s.marks && s.coverage < 1
    ? addMarks(mask, g, { radius: MARK_RADIUS, top: gp.frameTop ?? gp.frame, bottom: gp.frameBottom ?? gp.frame }) : 0;

  // Pieces hanging off one link narrower than FLAP_NECK lift off the pot when the stencil bends.
  // Holding them at both ends makes them bend with the sheet. New bridges show in the bridge colour.
  const neckPx = FLAP_NECK / s.res, minFlapPx = FLAP_MIN_WIDTH / s.res;
  let flaps = findFlaps(mask, neckPx, minFlapPx), flapBridges = 0;
  if (shell) flaps = { flaps: [], mask: new Uint8Array(mask.solid.length) }; // a shell never bends, so nothing lifts
  else if (s.holdFlaps && flaps.flaps.length) {
    const before = mask.solid.slice();
    flapBridges = holdFlaps(mask, flaps.flaps, { bridgePx: s.bridge / s.res, maxLenPx: FLAP_MAX_BRIDGE / s.res });
    removePinches(mask.solid, mask.w, mask.h);
    for (let k = 0; k < before.length; k++) if (mask.solid[k] && !before[k]) isl.bridgeMask[k] = 1;
    flaps = findFlaps(mask, neckPx, minFlapPx);
  }
  // A shell prints upright, so the top of every hole is printed in mid-air. Short spans bridge
  // cleanly. Longer ones get thin posts down through the hole, which stay in the stencil.
  // The check runs on a grid whose rows are printed layers, which on a tapered pot are arcs of the flat stencil.
  let sags: ReturnType<typeof findSags> | undefined, posts = 0, sagMask: Uint8Array | undefined;
  if (shell) {
    const grid = layerGrid(mask, g), sag = { ...SAG, maxBridge: s.maxBridge };
    sags = findSags(grid.mask, sag);
    if (s.posts && sags.spans.length) {
      const before = grid.mask.solid.slice();
      posts = addPosts(grid.mask, sags.spans, { postPx: s.bridge / s.res, maxBridge: s.maxBridge });
      for (let k = 0; k < before.length; k++) {
        const f = grid.flat[k];
        if (f >= 0 && grid.mask.solid[k] && !before[k]) { mask.solid[f] = 1; isl.bridgeMask[f] = 1; }
      }
      sags = findSags(grid.mask, sag);
    }
    sagMask = new Uint8Array(mask.solid.length);
    for (let k = 0; k < grid.flat.length; k++) if (sags.mask[k] && grid.flat[k] >= 0) sagMask[grid.flat[k]] = 1;
  }

  // A flap held at one end stays flat while the pot curves away under it: its free edge lifts
  // about width² ÷ (2 × radius), and never more than its own width.
  const radius = (topD + botD) / 4;
  const maxLift = Math.max(0, ...flaps.flaps.map((f) => { const wmm = f.width * s.res; return Math.min(wmm, (wmm * wmm) / (2 * radius)); }));

  // A shell stands upright, so it fits when its outside diameter and height fit the bed.
  const shellSize: [number, number] = [2 * (Math.max(band.topD, band.botD) / 2 + s.clearance + s.thick), g.heightMm];
  const rot = shell
    ? (shellSize[0] <= Math.min(s.bedW, s.bedD) - 2 * BED_MARGIN && shellSize[1] <= SHELL_MAX_HEIGHT ? 0 : null)
    : fitAngle(mask, s.bedW - 2 * BED_MARGIN, s.bedD - 2 * BED_MARGIN);

  // The print check measures the finished stencil, the way the slicer will see it.
  // Spots smaller than twice the minimum width squared are pointed tips and square corners, not real problems.
  const holes = new Uint8Array(mask.solid.length);
  for (let k = 0; k < holes.length; k++) holes[k] = mask.inside[k] && !mask.solid[k] ? 1 : 0;
  const pPx = s.minPlastic / s.res, hPx = s.minHole / s.res;
  const thinPlastic = thinFeatures(mask.solid, mask.w, mask.h, pPx, 2 * pPx * pPx);
  const thinHoles = thinFeatures(holes, mask.w, mask.h, hPx, 2 * hPx * hPx);
  let holeArea = 0, thinArea = 0;
  for (let k = 0; k < holes.length; k++) if (holes[k]) { holeArea++; thinArea += thinHoles.mask[k]; }
  const pieces = countPieces(mask.solid, mask.w, mask.h), edgeGap = Math.PI * Math.abs(band.topD - band.botD) * s.coverage;
  const checks = printChecks({
    pieces, islandMode: s.islandMode, thinPlasticSpots: thinPlastic.spots, thinHoleSpots: thinHoles.spots, thinHoleShare: holeArea ? thinArea / holeArea : 0,
    thick: s.thick, nozzle: s.nozzle, minPlastic: s.minPlastic, minHole: s.minHole, bridge: s.bridge,
    above: s.above, below: s.below, ends: s.ends, toBase: s.toBase, fits: rot !== null, curve: band.curve, strip, edgeGap,
    flaps: flaps.flaps.length, maxLift, shell, overhang: (Math.atan2(Math.abs(g.dr), g.height) * 180) / Math.PI,
    sags: sags?.spans.length ?? 0, worstSag: Math.max(0, ...(sags?.spans.map((x) => x.length) ?? [])),
  });
  return { g, gp, mask, isl, rot, pieces, thinPlastic: thinPlastic.mask, thinHoles: thinHoles.mask, checks, flapMask: flaps.mask, flapBridges, shellSize: shell ? shellSize : undefined, sagMask, posts, marks, edgeGap, band, layerInfo };
}
