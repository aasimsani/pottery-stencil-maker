import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { frameObject, useOrbitScene } from './scene';
import { cssRgb } from '../render/preview';

/** A theme colour token as a three.js colour. */
const tokenColor = (name: string) => { const [r, g, b] = cssRgb(name); return new THREE.Color(r / 255, g / 255, b / 255); };

interface Props { stl: ArrayBuffer; bedW: number; bedD: number; className?: string; label: string }

// stlGeometry() reads a binary STL into a three.js geometry, keeping its flat face normals.
function stlGeometry(stl: ArrayBuffer): THREE.BufferGeometry {
  const dv = new DataView(stl), n = dv.getUint32(80, true);
  const pos = new Float32Array(n * 9), nor = new Float32Array(n * 9);
  for (let t = 0; t < n; t++) {
    const o = 84 + t * 50;
    for (let v = 0; v < 3; v++) for (let k = 0; k < 3; k++) {
      pos[t * 9 + v * 3 + k] = dv.getFloat32(o + 12 + v * 12 + k * 4, true);
      nor[t * 9 + v * 3 + k] = dv.getFloat32(o + k * 4, true);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  return geo;
}

/** Shows the exact print file on the printer bed, as the slicer will place it. */
export default function PrintView({ stl, bedW, bedD, className, label }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const three = useOrbitScene(host);

  useEffect(() => {
    const t = three.current;
    if (!t) return;
    // The STL is z-up and three.js is y-up, so the whole print turns −90° about x.
    const print = new THREE.Group();
    print.rotation.x = -Math.PI / 2;

    const geo = stlGeometry(stl);
    geo.computeBoundingBox();
    const box = geo.boundingBox!, cx = (box.min.x + box.max.x) / 2, cy = (box.min.y + box.max.y) / 2;
    // Centre the part on the bed, standing on it, the way Bambu Studio places an import.
    geo.translate(-cx, -cy, -box.min.z);
    const plastic = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: tokenColor('--print-plastic'), roughness: 0.55, side: THREE.DoubleSide }));
    print.add(plastic);

    const bed = new THREE.Mesh(new THREE.PlaneGeometry(bedW, bedD), new THREE.MeshStandardMaterial({ color: tokenColor('--print-bed'), roughness: 0.9 }));
    bed.position.z = -0.05;
    print.add(bed);
    const grid = new THREE.GridHelper(Math.max(bedW, bedD), Math.round(Math.max(bedW, bedD) / 10), tokenColor('--print-grid'), tokenColor('--print-grid'));
    grid.rotation.x = Math.PI / 2;
    print.add(grid);

    t.scene.add(print);
    frameObject(t, plastic, new THREE.Vector3(0.4, 0.9, 1));
    return () => {
      t.scene.remove(print);
      geo.dispose();
      (plastic.material as THREE.Material).dispose();
      bed.geometry.dispose(); (bed.material as THREE.Material).dispose();
      grid.dispose();
    };
  }, [stl, bedW, bedD, three]);

  return <div ref={host} className={className} role="img" aria-label={label} />;
}
