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

// ---- soft forms: furniture, cushions, turned pieces -------------------------------
// A triangle with its own (smooth) vertex normals.
function triN(b, ps, ns, style) {
  ps.forEach((p, i) => {
    const n = ns[i];
    b.pos.push(p[0], p[1], p[2]);
    b.nrm.push(n[0], n[1], n[2]);
    const ax = Math.abs(n[0]), ay = Math.abs(n[1]), az = Math.abs(n[2]);
    const uv = ax >= ay && ax >= az ? [p[2], p[1]] : ay >= az ? [p[0], p[2]] : [p[0], p[1]];
    b.uv.push(uv[0] + style.uvOffset[0], uv[1] + style.uvOffset[1]);
    b.col.push(style.color[0], style.color[1], style.color[2]);
  });
}

// A box with every edge and corner rounded by `radius`, shaded smooth: an
// upholstered cushion, a soft table top. Each face carries its own share of
// the rounding (the 45 degrees next to it), in equal angular steps: 15
// degrees on a cushion, 22.5 on a table edge, one step on a book's 4 mm edge.
// Every face's grid of points is worked out once, then cut into triangles.
export function pushRoundedBox(b, min, max, radius, style, seg = radius < 0.008 ? 1 : radius < 0.03 ? 2 : 3) {
  const ctr = [(min[0] + max[0]) / 2, (min[1] + max[1]) / 2, (min[2] + max[2]) / 2];
  const h = [(max[0] - min[0]) / 2, (max[1] - min[1]) / 2, (max[2] - min[2]) / 2];
  const r = Math.max(1e-4, Math.min(radius, h[0], h[1], h[2]));
  const inner = [h[0] - r, h[1] - r, h[2] - r];
  // Coordinates across a face along axis i: into the rounding, the flat, out of it.
  const C = [0, 1, 2].map(i => {
    const out = [];
    for (let k = 0; k <= seg; k++) out.push(-inner[i] - r * Math.tan(((seg - k) / seg) * Math.PI / 4));
    for (let k = 0; k <= seg; k++) out.push(inner[i] + r * Math.tan((k / seg) * Math.PI / 4));
    return out;
  });
  const n = 2 * seg + 2, P = new Float64Array(n * n * 3), N = new Float64Array(n * n * 3);
  const q = [0, 0, 0];
  const { pos, nrm, uv, col } = b, [ou, ov] = style.uvOffset, [cr, cg, cb] = style.color;
  const emit = k => {
    const x = P[k], y = P[k + 1], z = P[k + 2], nx = N[k], ny = N[k + 1], nz = N[k + 2];
    pos.push(x, y, z);
    nrm.push(nx, ny, nz);
    const ax = Math.abs(nx), ay = Math.abs(ny), az = Math.abs(nz);
    if (ax >= ay && ax >= az) uv.push(z + ou, y + ov); else if (ay >= az) uv.push(x + ou, z + ov); else uv.push(x + ou, y + ov);
    col.push(cr, cg, cb);
  };
  for (let f = 0; f < 3; f++) {
    const a = (f + 1) % 3, d = (f + 2) % 3, A = C[a], D = C[d];
    for (let sf = -1; sf <= 1; sf += 2) {
      q[f] = sf * h[f];
      for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
        q[a] = A[i]; q[d] = D[j];
        const k = (i * n + j) * 3;
        let l = 0;
        for (let t = 0; t < 3; t++) {
          const c = Math.max(-inner[t], Math.min(inner[t], q[t]));
          P[k + t] = c; N[k + t] = q[t] - c; l += N[k + t] * N[k + t];
        }
        l = Math.sqrt(l) || 1;
        for (let t = 0; t < 3; t++) { N[k + t] /= l; P[k + t] = ctr[t] + P[k + t] + N[k + t] * r; }
      }
      // Wind outward: (a, d, f) is a right-handed cycle.
      for (let i = 0; i < n - 1; i++) for (let j = 0; j < n - 1; j++) {
        const k00 = (i * n + j) * 3, k10 = ((i + 1) * n + j) * 3, k11 = ((i + 1) * n + j + 1) * 3, k01 = (i * n + j + 1) * 3;
        if (sf > 0) { emit(k00); emit(k10); emit(k11); emit(k00); emit(k11); emit(k01); }
        else { emit(k00); emit(k01); emit(k11); emit(k00); emit(k11); emit(k10); }
      }
    }
  }
}

// A turned form round a vertical axis: profile [[radius, height], ...] from
// the bottom up (heights above `base`), shaded smooth; radius 0 closes it.
export function pushLathe(b, base, profile, segments, style) {
  const [x, y, z] = base;
  const nrm = profile.map((p, i) => {
    const a = profile[Math.max(0, i - 1)], c = profile[Math.min(profile.length - 1, i + 1)];
    const dr = c[0] - a[0], dy = c[1] - a[1];
    const l = Math.hypot(dr, dy) || 1;
    return [dy / l, -dr / l];   // outward in (r, y)
  });
  const cs = [], sn = [];
  for (let s = 0; s <= segments; s++) { cs.push(Math.cos((s / segments) * Math.PI * 2)); sn.push(Math.sin((s / segments) * Math.PI * 2)); }
  const P = (i, s) => [x + cs[s] * profile[i][0], y + profile[i][1], z + sn[s] * profile[i][0]];
  const N = (i, s) => [cs[s] * nrm[i][0], nrm[i][1], sn[s] * nrm[i][0]];
  for (let s = 0; s < segments; s++) {
    for (let i = 0; i < profile.length - 1; i++) {
      triN(b, [P(i, s), P(i + 1, s), P(i + 1, s + 1)], [N(i, s), N(i + 1, s), N(i + 1, s + 1)], style);
      triN(b, [P(i, s), P(i + 1, s + 1), P(i, s + 1)], [N(i, s), N(i + 1, s + 1), N(i, s + 1)], style);
    }
  }
}
