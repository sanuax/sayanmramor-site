// js/showroom/showroom-geometry.js
//
// Triangle builders for the showroom renderer. Static house parts are not
// one mesh each: they are written into batches (one per visibility group +
// material + showroom object) and each batch becomes a single mesh, so the
// whole house costs a few dozen draw calls. Every vertex carries a colour
// (a per-slab / per-block tint, so neighbouring stones differ slightly the
// way real ones do) and a world-scaled UV (texture detail keeps its real
// size on a 30 cm step and on a 14 m wall).
import * as THREE from '../../vendor/three/three.module.js';

// Deterministic hash of a point -> [0, 1).
export function hash3(x, y, z) {
  let h = Math.imul(Math.round(x * 997) | 0, 73856093) ^ Math.imul(Math.round(y * 991) | 0, 19349663) ^ Math.imul(Math.round(z * 983) | 0, 83492791);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

export function createBatch() {
  return { pos: [], nrm: [], uv: [], col: [] };
}

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];

// One flat-shaded triangle, wound so its normal points away from `inside`
// (every solid built here is convex). UVs are a planar projection along
// the face's dominant axis, in metres, plus the element's own offset.
function tri(b, p0, p1, p2, inside, style) {
  const e1 = sub(p1, p0), e2 = sub(p2, p0);
  let n = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]];
  const len = Math.hypot(n[0], n[1], n[2]);
  if (len < 1e-12) return;
  n = n.map(v => v / len);
  const c = [(p0[0] + p1[0] + p2[0]) / 3 - inside[0], (p0[1] + p1[1] + p2[1]) / 3 - inside[1], (p0[2] + p1[2] + p2[2]) / 3 - inside[2]];
  if (n[0] * c[0] + n[1] * c[1] + n[2] * c[2] < 0) {
    [p1, p2] = [p2, p1];
    n = n.map(v => -v);
  }
  const ax = Math.abs(n[0]), ay = Math.abs(n[1]), az = Math.abs(n[2]);
  const uvOf = style.uvOf || (p => (ax >= ay && ax >= az ? [p[2], p[1]] : ay >= az ? [p[0], p[2]] : [p[0], p[1]]));
  [p0, p1, p2].forEach(p => {
    b.pos.push(p[0], p[1], p[2]);
    b.nrm.push(n[0], n[1], n[2]);
    const [u, v] = uvOf(p, n);
    b.uv.push(u + style.uvOffset[0], v + style.uvOffset[1]);
    b.col.push(style.color[0], style.color[1], style.color[2]);
  });
}

function quad(b, p0, p1, p2, p3, inside, style) {
  tri(b, p0, p1, p2, inside, style);
  tri(b, p0, p2, p3, inside, style);
}

// A box with every edge chamfered by `bevel` (a plain box when 0): six
// inset faces, twelve 45° edge strips, eight corner triangles.
export function pushBox(b, min, max, style) {
  const ctr = [0, 1, 2].map(i => (min[i] + max[i]) / 2);
  const h = [0, 1, 2].map(i => (max[i] - min[i]) / 2);
  const c = Math.max(0, Math.min(style.bevel || 0, h[0] * 0.8, h[1] * 0.8, h[2] * 0.8));
  // Point of corner s (signs per axis) on the face across axis `f`.
  const P = (s, f) => [0, 1, 2].map(i => ctr[i] + s[i] * (h[i] - (i === f ? 0 : c)));
  const signs = [-1, 1];
  const others = f => [0, 1, 2].filter(i => i !== f);
  // Faces.
  for (let f = 0; f < 3; f++) {
    const [a, d] = others(f);
    signs.forEach(sf => {
      const corner = (sa, sd) => { const s = [0, 0, 0]; s[f] = sf; s[a] = sa; s[d] = sd; return P(s, f); };
      quad(b, corner(-1, -1), corner(1, -1), corner(1, 1), corner(-1, 1), ctr, style);
    });
  }
  if (c <= 1e-6) return;
  // Edge strips: an edge runs along axis e, between the faces across a and d.
  for (let e = 0; e < 3; e++) {
    const [a, d] = others(e);
    signs.forEach(sa => signs.forEach(sd => {
      const s = se => { const v = [0, 0, 0]; v[e] = se; v[a] = sa; v[d] = sd; return v; };
      quad(b, P(s(-1), a), P(s(1), a), P(s(1), d), P(s(-1), d), ctr, style);
    }));
  }
  // Corners.
  signs.forEach(sx => signs.forEach(sy => signs.forEach(sz => {
    const s = [sx, sy, sz];
    tri(b, P(s, 0), P(s, 1), P(s, 2), ctr, style);
  })));
}

// One cladding slab: a rectangle (a0..a1, b0..b1) in a plane, from the
// substrate at n0 to its face at n1, the face edges chamfered (the back is
// never seen, so it has no back face).
export function pushSlab(b, plane, a0, a1, b0, b1, n0, n1, chamfer, style) {
  const W = (a, bb, n) => (plane === 'z' ? [a, bb, n] : plane === 'x' ? [n, bb, a] : [a, n, bb]);
  const c = Math.max(0, Math.min(chamfer, (a1 - a0) * 0.3, (b1 - b0) * 0.3, Math.abs(n1 - n0) * 0.8));
  const nc = n1 - Math.sign(n1 - n0) * c;
  const inside = W((a0 + a1) / 2, (b0 + b1) / 2, (n0 + n1) / 2);
  const f = [W(a0 + c, b0 + c, n1), W(a1 - c, b0 + c, n1), W(a1 - c, b1 - c, n1), W(a0 + c, b1 - c, n1)];
  const r = [W(a0, b0, nc), W(a1, b0, nc), W(a1, b1, nc), W(a0, b1, nc)];
  const k = [W(a0, b0, n0), W(a1, b0, n0), W(a1, b1, n0), W(a0, b1, n0)];
  quad(b, f[0], f[1], f[2], f[3], inside, style);
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4;
    if (c > 1e-6) quad(b, f[i], f[j], r[j], r[i], inside, style);
    quad(b, r[i], r[j], k[j], k[i], inside, style);
  }
}

// A (tapered) cylinder standing on `base`.
export function pushCylinder(b, base, rBottom, rTop, height, segments, style) {
  const [x, y, z] = base;
  const inside = [x, y + height / 2, z];
  const ring = (r, yy) => Array.from({ length: segments }, (_, i) => {
    const t = (i / segments) * Math.PI * 2;
    return [x + Math.cos(t) * r, yy, z + Math.sin(t) * r];
  });
  const lo = ring(rBottom, y), hi = ring(rTop, y + height);
  const topC = [x, y + height, z], botC = [x, y, z];
  for (let i = 0; i < segments; i++) {
    const j = (i + 1) % segments;
    quad(b, lo[i], lo[j], hi[j], hi[i], inside, style);
    tri(b, hi[i], hi[j], topC, inside, style);
    tri(b, lo[i], lo[j], botC, inside, style);
  }
}

// An oriented box between two points (a handrail, a glass balustrade run).
export function pushBeam(b, from, to, width, height, style) {
  const f = new THREE.Vector3(...from), t = new THREE.Vector3(...to);
  const len = f.distanceTo(t);
  const m = new THREE.Matrix4().lookAt(t, f, new THREE.Vector3(0, 1, 0));
  m.setPosition(f.clone().add(t).multiplyScalar(0.5));
  const corners = [];
  [-1, 1].forEach(sx => [-1, 1].forEach(sy => [-1, 1].forEach(sz => {
    corners.push(new THREE.Vector3(sx * width / 2, sy * height / 2, sz * len / 2).applyMatrix4(m).toArray());
  })));
  const C = (sx, sy, sz) => corners[((sx + 1) / 2) * 4 + ((sy + 1) / 2) * 2 + (sz + 1) / 2];
  const inside = f.clone().add(t).multiplyScalar(0.5).toArray();
  quad(b, C(-1, -1, -1), C(1, -1, -1), C(1, 1, -1), C(-1, 1, -1), inside, style);
  quad(b, C(-1, -1, 1), C(1, -1, 1), C(1, 1, 1), C(-1, 1, 1), inside, style);
  quad(b, C(-1, -1, -1), C(-1, 1, -1), C(-1, 1, 1), C(-1, -1, 1), inside, style);
  quad(b, C(1, -1, -1), C(1, 1, -1), C(1, 1, 1), C(1, -1, 1), inside, style);
  quad(b, C(-1, -1, -1), C(1, -1, -1), C(1, -1, 1), C(-1, -1, 1), inside, style);
  quad(b, C(-1, 1, -1), C(1, 1, -1), C(1, 1, 1), C(-1, 1, 1), inside, style);
}

export function toGeometry(b) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(b.pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(b.nrm, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(b.uv, 2));
  g.setAttribute('color', new THREE.Float32BufferAttribute(b.col, 3));
  g.computeBoundingSphere();
  g.computeBoundingBox();
  return g;
}

// White vertex colours for geometry built elsewhere (the materials
// multiply by vertex colour).
export function withWhite(geometry) {
  const n = geometry.attributes.position.count;
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(new Float32Array(n * 3).fill(1), 3));
  return geometry;
}

// A soft, irregular foliage mass: an icosphere pushed in and out by smooth
// deterministic noise, shaded smooth (normals along the radius).
export function blobGeometry() {
  const g = new THREE.IcosahedronGeometry(1, 3);
  const p = g.attributes.position;
  const n = new Float32Array(p.count * 3);
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const k = 1 + 0.11 * Math.sin(x * 4.1 + y * 2.3) * Math.cos(z * 3.7 - x * 1.3) + 0.07 * Math.sin(y * 7.9 + z * 5.3) + 0.05 * Math.cos(x * 9.1 - z * 6.7);
    p.setXYZ(i, x * k, y * k, z * k);
    n[i * 3] = x; n[i * 3 + 1] = y; n[i * 3 + 2] = z;
  }
  g.setAttribute('normal', new THREE.BufferAttribute(n, 3));
  return withWhite(g);
}
