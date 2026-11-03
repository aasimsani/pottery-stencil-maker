import { useEffect, useState } from 'react';
import type { IslandMode } from './core/mask';
import type { Piece } from './core/piece';
import { layersFromMix, newDesignLayer, newLinesLayer, type Layer } from './layers';
import { builtinRef } from './sources/builtin';

export interface Settings {
  /** The piece being decorated, base to rim. */
  piece: Piece;
  /** The paint band, in mm along the surface from the base. */
  bandFrom: number; bandTo: number;
  /** Plastic margins above the band, below it, and past its ends, in mm. */
  above: number; below: number; ends: number;
  /** Runs the bottom margin down to the base, so the stencil sits on the table. */
  toBase: boolean;
  // Stencil
  coverage: number; shape: 'arc' | 'strip'; thick: number;
  islandMode: IslandMode; bridge: number; res: number;
  /** Bridges wide pieces at both ends, so they bend with the sheet instead of lifting off the pot. */
  holdFlaps: boolean;
  /** 'flat' prints a sheet you bend round the pot. 'shell' prints it already curved, standing upright. */
  printAs: 'flat' | 'shell';
  /** Cuts repeat marks into the margins of a stencil that covers part of the way round. */
  marks: boolean;
  /** Gap between a curved shell and the pot, in mm. */
  clearance: number;
  /** Props a curved shell's wide hole tops with thin posts, and the longest bridge left between them, in mm. */
  posts: boolean; maxBridge: number;
  // Printer (Bambu Lab P2S defaults)
  bedW: number; bedD: number;
  // The print check reads these limits before every download.
  nozzle: number; minPlastic: number; minHole: number; strict: boolean;
  // Preview
  paintColor: string;
}

export const DEFAULTS: Settings = {
  piece: { name: 'Flared mug', profile: [{ z: 0, d: 78 }, { z: 95, d: 86 }] },
  bandFrom: 20, bandTo: 70, above: 5, below: 5, ends: 5, toBase: false,
  coverage: 0.5, shape: 'arc', thick: 0.6, islandMode: 'bridge', bridge: 1.2, res: 0.15, holdFlaps: true, printAs: 'flat', marks: true, clearance: 0.2, posts: true, maxBridge: 8,
  bedW: 256, bedD: 256,
  nozzle: 0.4, minPlastic: 0.8, minHole: 0.8, strict: true,
  paintColor: '#2b4c8c',
};

// settingsFrom() fills saved settings in with defaults. Earlier versions measured only the band
// (botD, topD, slant), which becomes a piece that is exactly that band.
export function settingsFrom(saved: Record<string, unknown> | null): Settings {
  const s = { ...DEFAULTS, ...(saved ?? {}) } as Settings & { botD?: number; topD?: number; slant?: number; frame?: number };
  if (saved && !saved.piece && typeof s.botD === 'number' && typeof s.topD === 'number' && typeof s.slant === 'number') {
    const height = Math.sqrt(Math.max(0, s.slant ** 2 - ((s.topD - s.botD) / 2) ** 2));
    s.piece = { name: 'My piece', profile: [{ z: 0, d: s.botD }, { z: height, d: s.topD }] };
    s.bandFrom = 0; s.bandTo = s.slant;
    s.above = s.below = s.ends = s.frame ?? DEFAULTS.ends;
  }
  const { botD: _b, topD: _t, slant: _s, frame: _f, ...rest } = s;
  return rest;
}

// initialLayers() starts from the mix an earlier version saved, or from a sprig between two framing lines.
export function initialLayers(): Layer[] {
  try {
    const mix = JSON.parse(localStorage.getItem('mix') ?? 'null');
    if (Array.isArray(mix) && mix.length) return layersFromMix(mix);
  } catch { /* storage blocked or corrupt */ }
  return [newDesignLayer(builtinRef('Leafy sprig')), newLinesLayer()];
}

// All three pottery apps run on aasimsani.net and share one localStorage, so each app keeps its keys under its own
// prefix. Saved pieces stay shared, because the roller maker reads the same pots.
const APP = 'stencil.';
const SHARED = new Set<string>(['pieces']);
export const storageKey = (key: string) => (SHARED.has(key) ? key : APP + key);

// settingsFromLegacy() keeps this app's fields from settings saved under the bare "settings" key. The rib maker
// saved its settings under that key too, and each app wrote the other's fields back. When the object holds the
// rib maker's fields, it also drops thick and above, because both apps use those names for different things.
const OWN = new Set([...Object.keys(DEFAULTS), 'botD', 'topD', 'slant', 'frame']);
export function settingsFromLegacy(saved: Record<string, unknown>): Record<string, unknown> {
  const mixed = ['shrink', 'trimLine', 'profile'].some((k) => k in saved);
  return Object.fromEntries(Object.entries(saved).filter(([k]) => OWN.has(k) && !(mixed && (k === 'thick' || k === 'above'))));
}
const identity = (v: unknown) => v;
const LEGACY: Record<string, (v: unknown) => unknown> = {
  settings: (v) => (v && typeof v === 'object' ? settingsFromLegacy(v as Record<string, unknown>) : null),
  layers: identity,
};

// usePersistent() is useState backed by localStorage. Storage can be missing or full
// (private windows, large uploaded images), so failures fall back to in-memory state.
// The first load reads what an older version saved under the bare key, through LEGACY, and saves it under the prefix.
export function usePersistent<T>(key: string, initial: T | (() => T)): [T, (v: T | ((prev: T) => T)) => void] {
  const full = storageKey(key);
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(full);
      if (raw) return JSON.parse(raw) as T;
      const old = full !== key && LEGACY[key] ? localStorage.getItem(key) : null;
      if (old) return LEGACY[key](JSON.parse(old)) as T;
    } catch { /* fall through to the initial value */ }
    return typeof initial === 'function' ? (initial as () => T)() : initial;
  });
  useEffect(() => {
    try { localStorage.setItem(full, JSON.stringify(value)); } catch { /* storage full or blocked */ }
  }, [full, value]);
  return [value, setValue];
}
