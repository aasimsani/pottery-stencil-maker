import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import type { Settings } from '../state';
import type { StencilResult } from '../pipeline';
import { drawFlat } from '../render/preview';
import type { PieceMode } from './Piece3D';
import { exportSTL } from '../export';
import { useDialog } from './dialog';

// three.js is about 600 kB, so the 3D view loads after the rest of the page.
const Piece3D = lazy(() => import('./Piece3D'));
const PrintView = lazy(() => import('./PrintView'));

interface Props {
  s: Settings;
  result: StencilResult | null;
  error: string;
  loading: number;
  /** True while the worker rebuilds the stencil. */
  updating: boolean;
  onStl: () => void;
  /** Adds the exact STL that Download STL saves to the plate. */
  onAddToPlate: () => void;
  onPng: (canvas: HTMLCanvasElement) => void;
  onPaint: (color: string) => void;
}

// describe() is the spoken summary of the stencil, for the previews' text alternatives.
function describe(r: StencilResult, s: Settings): string {
  const size = r.shellSize ? `a curved shell ${r.shellSize[0].toFixed(0)} mm across and ${r.shellSize[1].toFixed(0)} mm tall`
    : `a flat stencil ${r.g.widthMm.toFixed(0)} by ${r.g.heightMm.toFixed(0)} mm`;
  const errors = r.checks.filter((c) => c.level === 'error').length;
  return `${s.piece.name}: ${size}, printing as ${r.pieces === 1 ? 'one piece' : `${r.pieces} pieces`}, ${errors ? `${errors} print check error${errors > 1 ? 's' : ''}` : 'passing the print check'}.`;
}

export function Preview({ s, result, error, loading, updating, onStl, onAddToPlate, onPng, onPaint }: Props) {
  const flat = useRef<HTMLCanvasElement>(null), dialog = useRef<HTMLDivElement>(null);
  const [mode, setMode] = useState<PieceMode>('painted');
  const [expanded, setExpanded] = useState(false);
  const [showProblems, setShowProblems] = useState(true);
  const [theme, setTheme] = useState(0);
  useEffect(() => {
    const mq = matchMedia('(prefers-color-scheme: dark)'), bump = () => setTheme((t) => t + 1);
    mq.addEventListener('change', bump);
    return () => mq.removeEventListener('change', bump);
  }, []);
  useDialog(dialog, expanded, () => setExpanded(false));

  useEffect(() => {
    if (!result || !flat.current) return;
    drawFlat(flat.current, result.mask, result.isl, s.islandMode === 'keep',
      showProblems ? { plastic: result.thinPlastic, holes: result.thinHoles, flaps: result.flapMask, sags: result.sagMask } : undefined);
  }, [result, s.islandMode, showProblems, theme]);

  // The legend lists only what this stencil actually shows.
  const present = useMemo(() => {
    if (!result) return null;
    const any = (a?: Uint8Array) => !!a && a.some((v) => v === 1);
    return {
      bridge: any(result.isl.bridgeMask),
      island: s.islandMode === 'keep' && result.isl.islands > 0,
      thinPlastic: showProblems && any(result.thinPlastic),
      thinHole: showProblems && any(result.thinHoles),
      flap: showProblems && any(result.flapMask),
      sag: showProblems && any(result.sagMask),
    };
  }, [result, s.islandMode, showProblems]);

  // The print file is the exact STL Download STL saves. It takes about a second to build, so only when shown.
  const print = useMemo(() => (mode === 'print' && result && result.rot !== null ? exportSTL(s, result) : null), [mode, result, s]);
  const label = result ? describe(result, s) : '';
  const view = (className: string) => mode === 'print'
    ? (print
      ? <Suspense fallback={<div className={`${className} loading`}>Loading 3D…</div>}><PrintView stl={print.stl} bedW={s.bedW} bedD={s.bedD} className={className} label={`Print file on the bed: ${label}`} /></Suspense>
      : <div className={`${className} loading`}>No print file: it doesn't fit the bed.</div>)
    : <Suspense fallback={<div className={`${className} loading`}>Loading 3D…</div>}><Piece3D s={s} result={result!} mode={mode} className={className} label={`3D view of ${label}`} /></Suspense>;
  const printInfo = print && (
    <p className="hint">
      {print.name}: {(new DataView(print.stl).getUint32(80, true)).toLocaleString()} triangles, {(print.stl.byteLength / 1e6).toFixed(1)} MB, on a {s.bedW} × {s.bedD} mm bed.
    </p>
  );

  const modeToggle = (
    <div className="seg" role="group" aria-label="3D view">
      <button aria-pressed={mode === 'painted'} className={mode === 'painted' ? 'on' : ''} onClick={() => setMode('painted')}>Painted</button>
      <button aria-pressed={mode === 'stencil'} className={mode === 'stencil' ? 'on' : ''} onClick={() => setMode('stencil')}>Stencil on</button>
      <button aria-pressed={mode === 'print'} className={mode === 'print' ? 'on' : ''} onClick={() => setMode('print')} title="The exact STL that Download STL saves, on the printer bed">Print file</button>
    </div>
  );

  const r = result;
  const layers = +(s.thick / 0.2).toFixed(1);
  const errors = r ? r.checks.filter((c) => c.level === 'error').length : 0, warns = r ? r.checks.length - errors : 0;
  // Things the app did for you, shown as notes rather than mixed in with the measurements.
  const notes = r ? [
    r.isl.islands ? `${r.isl.islands} loose piece${r.isl.islands > 1 ? 's' : ''} ${{ bridge: 'bridged to the rest', drop: 'painted over', keep: 'kept separate' }[s.islandMode]}` : '',
    r.posts ? `${r.posts} support post${r.posts > 1 ? 's' : ''} added so hole tops don't sag` : '',
    r.flapBridges ? `${r.flapBridges} bridge${r.flapBridges > 1 ? 's' : ''} added so wide pieces bend with the sheet` : '',
  ].filter(Boolean) : [];
  // Strict mode holds back the STL while the print check finds errors, with a deliberate override.
  const blocked = !!r && s.strict && errors > 0;

  return (
    <section className="panel preview" aria-labelledby="preview-title">
      <div className="previews">
        <div>
          <h2 id="preview-title">{s.printAs === 'shell' ? 'Stencil, unrolled' : 'Stencil, as printed'}</h2>
          <canvas ref={flat} className="flat" role="img" aria-label={label ? `Flat view of ${label}` : 'Stencil preview'} />
          {present && (
            <div className="legend">
              <span><i style={{ background: 'var(--plastic)' }} />plastic</span>
              <span><i className="hole-swatch" />hole, where paint goes</span>
              {present.bridge && <span><i style={{ background: 'var(--bridge)' }} />bridge</span>}
              {present.island && <span><i style={{ background: 'var(--island)' }} />loose piece</span>}
              {present.thinPlastic && <span><i style={{ background: 'var(--island)' }} />plastic too thin</span>}
              {present.thinHole && <span><i style={{ background: 'var(--thin-hole)' }} />paint line too thin</span>}
              {present.flap && <span><i style={{ background: 'var(--flap)' }} />lifts when wrapped</span>}
              {present.sag && <span><i style={{ background: 'var(--sag)' }} />prints in mid-air</span>}
            </div>
          )}
        </div>
        <div>
          <div className="piece-head">
            <h2>On the piece</h2>
            <button className="secondary small" onClick={() => setExpanded(true)} disabled={!r}>Expand</button>
          </div>
          {r && view('piece3d')}
          <div className="view-row">
            {modeToggle}
            <label className="swatch-field">Paint <input type="color" value={s.paintColor} onChange={(e) => onPaint(e.target.value)} /></label>
          </div>
          {printInfo}
          <p className="hint">Drag to rotate, scroll to zoom.</p>
        </div>
      </div>

      <p className="spec" role="status">
        {error && <span className="warn">{error}</span>}
        {loading > 0 && <span>Loading {loading} design{loading > 1 ? 's' : ''}…</span>}
        {updating && <span className="updating">Updating…</span>}
        {r && (
          <>
            {r.shellSize
              ? <span>Curved shell <b>Ø{r.shellSize[0].toFixed(0)} × {r.shellSize[1].toFixed(0)} mm</b>, printed upright</span>
              : <span>Stencil <b>{r.g.widthMm.toFixed(0)} × {r.g.heightMm.toFixed(0)} mm</b></span>}
            <span>{r.rot === 0 ? 'fits the bed'
              : r.rot === 90 ? 'fits the bed turned 90°'
              : r.rot !== null ? `fits the bed at ${r.rot}°` : 'too big for the bed'}</span>
            <span>{s.thick} mm, {layers} layers at 0.2 mm</span>
          </>
        )}
      </p>

      {r && (
        <>
          <div className="checks-head">
            <h2>Print check</h2>
            <span role="status" aria-live="polite" className={errors ? 'warn' : warns ? 'caution' : 'ok'}>
              {errors ? `${errors} error${errors > 1 ? 's' : ''}` : 'no errors'}{warns ? `, ${warns} warning${warns > 1 ? 's' : ''}` : ''}
            </span>
            <label className="check"><input type="checkbox" checked={showProblems} onChange={(e) => setShowProblems(e.target.checked)} /> Show problems on the stencil</label>
          </div>
          <ul className="checks">
            {r.checks.length === 0 && <li className="pass"><span aria-hidden="true">✓</span>Ready to print: one piece, nothing thinner than {s.minPlastic} mm, fits the bed.</li>}
            {r.checks.map((c) => (
              <li key={c.id} className={c.level}>
                <span aria-hidden="true">{c.level === 'error' ? '✕' : '⚠'}</span>
                <span><span className="visually-hidden">{c.level === 'error' ? 'Error: ' : 'Warning: '}</span>{c.message}</span>
              </li>
            ))}
            {notes.map((n) => <li key={n} className="note"><span aria-hidden="true">•</span>{n}</li>)}
          </ul>
        </>
      )}
      <div className="actions">
        <button onClick={onStl} disabled={!r || r.rot === null || blocked} title={blocked ? 'Fix the print check errors first' : undefined}>Download STL</button>
        {blocked && r.rot !== null && <button className="secondary" onClick={onStl}>Download anyway</button>}
        <button className="secondary" onClick={onAddToPlate} disabled={!r || r.rot === null || blocked}>Add to plate</button>
        <button className="secondary" onClick={() => flat.current && onPng(flat.current)} disabled={!r}>Download flat PNG</button>
      </div>

      {expanded && r && (
        <div className="modal" onClick={(e) => e.target === e.currentTarget && setExpanded(false)}>
          <div className="modal-body" ref={dialog} role="dialog" aria-modal="true" aria-labelledby="dialog-3d-title" tabIndex={-1}>
            <div className="modal-head">
              <h2 id="dialog-3d-title">On the piece</h2>
              {modeToggle}
              <span className="hint">Drag to rotate, scroll to zoom, right-drag to pan.</span>
              <button className="secondary small" onClick={() => setExpanded(false)}>Close</button>
            </div>
            {view('piece3d-large')}
            {printInfo}
          </div>
        </div>
      )}

      <details className="tips">
        <summary>Printing &amp; painting tips</summary>
        <ul>
          <li><b>PETG</b> flexes and survives repeated wrapping better than PLA. PLA works at 0.4–0.6 mm but can crack along thin bridges.</li>
          <li><b>Bambu Studio on the P2S:</b> use the stock "0.20mm Standard" process with the 0.4 mm nozzle, so 0.6 mm prints as 3 solid layers. Set Brim type to "No-brim", and leave ironing off.</li>
          <li><b>Plate:</b> the P2S's included textured PEI plate is the right one. PETG releases cleanly from it, and the textured underside grips the pot slightly. Use glue stick as a release layer if you swap to smooth PEI.</li>
          <li>Let the plate cool, then flex it, and the thin stencil peels off in one piece.</li>
          <li><b>Curved shell:</b> print it upright exactly as exported, with slicer supports off. Support posts are built into the file where a hole top would sag, so nothing has to be snapped off the delicate stencil. Set Wall loops to 2, so a 0.8 mm wall prints as two solid perimeters. If it's too tight, raise the clearance by 0.1 mm.</li>
          <li><b>Material for shells:</b> a shell never bends, so PLA works. It strings far less than PETG and bridges more cleanly.</li>
          <li><b>Stringing:</b> dry the filament first, especially PETG, and turn on "Wipe while retracting". For PETG, drop the nozzle to about 235 °C. A few seconds of hair dryer clears any strings without warping the part.</li>
          <li>The STL may come out rotated on the bed. That rotation lets a long stencil fit diagonally, so keep it as placed when you arrange the plate.</li>
          <li>Keep plastic lines and holes ≥ 0.8 mm wide, which is two nozzle widths. "Smooth edges" and larger designs help with busy images.</li>
          <li>Tapered pieces get an arc-shaped stencil, and flat plate rims get a ring, because a flat sheet only lies flush on a cone if it's cut that way.</li>
          <li>Hold the stencil with masking tape or a rubber band and dab underglaze with a sponge or stencil brush. Brush strokes push paint under the edges.</li>
          <li>For "½" or "⅓" stencils, line up each new placement on the edge of the last painted area.</li>
          <li>Bridges leave thin unpainted lines. Touch them up by hand, or paint a second pass with the stencil shifted slightly.</li>
        </ul>
      </details>
    </section>
  );
}
