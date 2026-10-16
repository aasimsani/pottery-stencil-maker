import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { pieceProfile, surfaceLength, TEX_PAD } from '../core/piece';
import type { StencilResult } from '../pipeline';
import { cssRgb } from '../render/preview';
import type { Settings } from '../state';
import { frameObject, useOrbitScene } from './scene';

export type PieceMode = 'painted' | 'stencil' | 'print';

interface Props { s: Settings; result: StencilResult; mode: PieceMode; className?: string; label: string }

// paintTexture() wraps the stencil round the piece. Texture columns run once round the
// circumference, and rows run up the whole outer surface from base to rim, with TEX_PAD rows
// of plain clay at each end. 'painted' repeats the stencil all the way round, as if every
// placement were painted. 'stencil' shows one placement of the plastic, centred on the front,
// including its margins.
function paintTexture(s: Settings, { g, gp, mask, band }: StencilResult, mode: PieceMode): HTMLCanvasElement {
  const S = surfaceLength(s.piece), meanD = s.piece.profile.reduce((a, p) => a + p.d, 0) / s.piece.profile.length;
  const W = 2048, H = Math.max(64, Math.min(2048, Math.round((W * S) / (Math.PI * meanD) / (1 - 2 * TEX_PAD))));
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const ctx = cv.getContext('2d')!, img = ctx.createImageData(W, H), d = img.data;
  const clay = cssRgb('--clay'), paint = cssRgb(s.paintColor), plastic = cssRgb('--plastic');
  const hole: typeof clay = [clay[0] * 0.88, clay[1] * 0.88, clay[2] * 0.88];
  for (let y = 0; y < H; y++) {
    // Canvas row 0 is the texture's top (v = 1), which is the rim.
    const t = (1 - (y + 0.5) / H - TEX_PAD) / (1 - 2 * TEX_PAD), sb = t * S - band.start; // mm up from the band's bottom edge
    for (let x = 0; x < W; x++) {
      let col = clay;
      if (t >= 0 && t <= 1) {
        const turn = (x + 0.5) / W; // 0→1 round the piece, starting at the front
        const ang = turn > 0.5 ? turn - 1 : turn; // −0.5…0.5 turns, centred on the front
        const span = ang / gp.coverage + 0.5;
        const frac = mode === 'painted' ? ((span % 1) + 1) % 1 : span;
        if (frac >= 0 && frac <= 1) {
          const k = g.toPixel(sb, frac);
          if (k >= 0 && mask.inside[k]) {
            if (mode === 'painted') col = mask.solid[k] ? clay : paint;
            else col = mask.solid[k] ? plastic : hole;
          }
        }
      }
      const o = (y * W + x) * 4;
      d[o] = col[0]; d[o + 1] = col[1]; d[o + 2] = col[2]; d[o + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return cv;
}

// buildMesh() revolves the piece's profile into a lathe mesh. Its UVs come from the profile,
// so u runs round the circumference and v follows the surface from base to rim.
function buildMesh(s: Settings, texture: THREE.Texture) {
  const { points, flat } = pieceProfile(s.piece);
  const segments = 256;
  const geo = new THREE.LatheGeometry(points.map((p) => new THREE.Vector2(p.r, p.z)), segments);
  const uv = geo.attributes.uv;
  // LatheGeometry lays vertices out segment by segment, with one vertex per profile point.
  for (let i = 0; i <= segments; i++) for (let j = 0; j < points.length; j++) uv.setXY(i * points.length + j, i / segments, points[j].v);
  uv.needsUpdate = true;
  const mat = new THREE.MeshStandardMaterial({ map: texture, roughness: 0.8, metalness: 0, side: THREE.DoubleSide });
  return { mesh: new THREE.Mesh(geo, mat), flat };
}

/** An orbitable 3D view of the piece. Drag to rotate, scroll to zoom, right-drag to pan. */
export default function Piece3D({ s, result, mode, className, label }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const three = useOrbitScene(host);
  const view = useRef<{ scene?: object; mesh?: THREE.Mesh; fitKey?: string }>({});

  useEffect(() => {
    const t = three.current;
    if (!t) return;
    const texture = new THREE.CanvasTexture(paintTexture(s, result, mode));
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.wrapS = THREE.RepeatWrapping;
    texture.anisotropy = t.renderer.capabilities.getMaxAnisotropy();
    const { mesh, flat } = buildMesh(s, texture);
    const v = view.current;
    // A new scene (React can mount twice in development) starts empty and unframed.
    if (v.scene !== t) { v.scene = t; v.mesh = undefined; v.fitKey = undefined; }
    if (v.mesh) {
      t.scene.remove(v.mesh);
      v.mesh.geometry.dispose();
      const m = v.mesh.material as THREE.MeshStandardMaterial;
      m.map?.dispose(); m.dispose();
    }
    t.scene.add(mesh);
    v.mesh = mesh;

    // Re-frame the camera only when the piece's shape changes, so a paint tweak keeps your view.
    const fitKey = JSON.stringify(s.piece.profile);
    if (v.fitKey !== fitKey) {
      v.fitKey = fitKey;
      frameObject(t, mesh, flat ? new THREE.Vector3(0, 1.1, 1) : new THREE.Vector3(0, 0.35, 1));
    }
  }, [s.piece, s.paintColor, result, mode, three]); // only what the texture and the mesh read, so unrelated settings don't rebuild them

  return <div ref={host} className={className} role="img" aria-label={label} />;
}
