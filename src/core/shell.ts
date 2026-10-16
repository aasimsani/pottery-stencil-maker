import type { Geometry } from './geometry';

// wrapSTL() bends a flat stencil mesh (from meshSTL) back onto the pot, so it prints already
// curved and never has to bend. The flat mesh's bottom face (z = 0) becomes the inside of the
// shell, clearance mm off the pot, and its thickness runs outward along the surface normal.
// The shell stands on its bottom edge with the pot's axis vertical, ready to print upright.
// Every flat face should be narrow (meshSTL's maxRunPx), or it cuts a chord through the curve.
export function wrapSTL(flat: ArrayBuffer, g: Geometry, clearance: number): ArrayBuffer {
  const src = new DataView(flat), n = src.getUint32(80, true);
  const out = flat.slice(0), dv = new DataView(out);
  // The outward normal of the cone, in the plane through its axis: (radial, vertical) per mm of surface.
  const nr = g.height / g.slant, nz = -g.dr / g.slant, up = g.height / g.slant;
  const rows = g.H;
  const verts = new Float64Array(n * 9);
  let zMin = Infinity, volume = 0;
  for (let t = 0; t < n; t++) {
    for (let v = 0; v < 3; v++) {
      const o = 84 + t * 50 + 12 + v * 12;
      const X = src.getFloat32(o, true), Y = src.getFloat32(o + 4, true), Z = src.getFloat32(o + 8, true);
      // meshSTL writes x = column × res and y = (rows − row) × res.
      const { s, theta } = g.wrap(X / g.res, rows - Y / g.res);
      const off = clearance + Z, r = g.radiusAt(s) + off * nr, z = s * up + off * nz;
      // Facing the pot from +y, theta increases to your right, so a flat stencil reads unmirrored.
      verts.set([-r * Math.sin(theta), r * Math.cos(theta), z], t * 9 + v * 3);
      zMin = Math.min(zMin, z);
    }
    const [ax, ay, az, bx, by, bz, cx, cy, cz] = verts.subarray(t * 9, t * 9 + 9);
    volume += (ax * (by * cz - bz * cy) - ay * (bx * cz - bz * cx) + az * (bx * cy - by * cx)) / 6;
  }
  // The mapping may reverse handedness. Swapping two corners then turns every face back outward.
  const flip = volume < 0;
  for (let t = 0; t < n; t++) {
    const p = verts.subarray(t * 9, t * 9 + 9);
    const [a, b, c] = flip ? [0, 2, 1] : [0, 1, 2];
    const P = [a, b, c].map((i) => [p[i * 3], p[i * 3 + 1], p[i * 3 + 2] - zMin]);
    const ux = P[1][0] - P[0][0], uy = P[1][1] - P[0][1], uz = P[1][2] - P[0][2];
    const vx = P[2][0] - P[0][0], vy = P[2][1] - P[0][1], vz = P[2][2] - P[0][2];
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nzz = ux * vy - uy * vx, nl = Math.hypot(nx, ny, nzz) || 1;
    const o = 84 + t * 50;
    dv.setFloat32(o, nx / nl, true); dv.setFloat32(o + 4, ny / nl, true); dv.setFloat32(o + 8, nzz / nl, true);
    P.forEach((q, i) => q.forEach((c2, k) => dv.setFloat32(o + 12 + i * 12 + k * 4, c2, true)));
  }
  return out;
}
