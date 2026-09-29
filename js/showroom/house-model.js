// js/showroom/house-model.js
//
// The showroom house as data: one modern two-storey stone house on a
// fenced plot (a light stone plinth, dark metal fins, stone pillars). A
// limestone ground floor on a Steel Grey
// granite plinth, a cantilevered upper floor clad in large limestone panels
// with deep stone window surrounds, a stone belt and cornice, a deep
// graphite-lined entrance niche reached by wide monolithic steps, a stone
// terrace, and stone interiors (hall with the main stair, living room,
// kitchen, bathroom). Pure geometry description (no Three.js), so the
// architecture is testable and the renderer (showroom-scene.js) only turns
// parts into meshes.
//
// Units: metres. Y up, grade (the plot's lawn) at y = 0. The street side
// is +Z, east is +X.
// Part kinds:
//   box      { min:[x,y,z], max:[x,y,z], bevel?, photo? }    (bevel = chamfer on every edge)
//   beam     { from:[x,y,z], to:[x,y,z], width, height }     (oriented box)
//   cladding { plane:'x'|'y'|'z', at, normal:+1|-1, depth, a:[a0,a1], b:[b0,b1],
//              origin:[oa,ob], module:[ma,mb], stagger, gap, chamfer }
//              real stone slabs on a surface: laid out by claddingSlabs(), each
//              one a separate chamfered slab with a real joint around it
//   joints   { plane, at, a, b, module, stagger, normal, tone }  (drawn joint lines)
//   slats    { min, max, axis:'x'|'z', pitch, width }      (a row of vertical fins along axis)
//   cyl      { base:[x,y,z], radius, radiusTop?, height }
//   tree     { position:[x,0,z], trunk, crown }
// One set of stones, repeated: our own light limestone (facades, frames,
// cornices, fence, paving, floors, the stair), Steel Grey granite (plinth,
// steps, outside sills, the niche, the hall wall), Viscont White granite
// (kitchen), Calacatta Nova marble (bathroom), Majestic marble (the one
// feature wall, bookmatched). `photo` / `photos` (cladding: one per slab)
// lay a region of a real slab photo on a surface (see stone-photos.js):
//   { src, plane?, normal?, rotate: 0|90|180|270, mirror?, offset:[m,m], scale? }
// For cladding/joints the plane's axes are: 'z' -> a = x, b = y; 'x' -> a = z,
// b = y; 'y' -> a = x, b = z. Every part has a material role `mat` and a
// visibility `group` (zones hide groups to cut the house open like a section
// model). Parts that ARE a showroom object carry `object: <id>` (see
// showroom-data.js).
(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = factory();
  } else {
    root.HouseModel = factory();
  }
})(typeof window !== 'undefined' ? window : globalThis, function () {

  const FF1 = 0.45;   // ground floor finished level (plinth top)
  const SLAB = 3.45;  // underside of the upper floor slab / top of ground-floor walls
  const FF2 = 3.75;   // upper floor level
  const TOP = 6.95;   // top of upper-floor walls
  const GF = { x0: -7, x1: 7, z0: -5, z1: 5 };
  const UF = { x0: -8.5, x1: 3.5, z0: -5, z1: 6.5 };
  // Main stair: one straight run of 18 risers with a landing after the 9th.
  const STAIR = { x0: -6.6, x1: -5.3, zStart: 3.4, risers: 18, going: 0.28, landingAfter: 8, landing: 1.2 };
  const RISE = (FF2 - FF1) / STAIR.risers;
  // The site: the fenced plot, the fence line (pillar centres), the path to
  // the entrance and the gate opening on it.
  const PLOT = { x0: -13, x1: 14, z0: -10.5, z1: 12 };
  const FENCE = { x0: -12.7, x1: 13.7, z0: -10.2, z1: 11.7, plinth: 0.4, height: 1.5 };
  const PATH = { x0: -3.4, x1: -0.2 };
  const GATE = { x0: -3.95, x1: 0.35 };

  function stairFront(i) {
    return STAIR.zStart - i * STAIR.going - (i > STAIR.landingAfter ? STAIR.landing - STAIR.going : 0);
  }
  function stairBack(i) {
    return stairFront(i) - (i === STAIR.landingAfter ? STAIR.landing : STAIR.going);
  }
  function stairTop(i) {
    return FF1 + (i + 1) * RISE;
  }
  const STAIR_END = stairBack(STAIR.risers - 1);   // where the stair arrives upstairs

  function box(min, max, mat, group, extra) {
    return Object.assign({ kind: 'box', min, max, mat, group }, extra || {});
  }

  // A box in a wall's own frame: u along the wall, v up, n across it.
  function wallBox(axis, u0, u1, v0, v1, n0, n1) {
    const lo = Math.min(n0, n1), hi = Math.max(n0, n1);
    return axis === 'z' ? [[u0, v0, lo], [u1, v1, hi]] : [[lo, v0, u0], [hi, v1, u1]];
  }

  // Splits a wall plane into solid rectangles around its openings.
  // u runs along the wall, v is height. Openings: { u0, u1, v0, v1 }.
  function solidRects(u0, u1, v0, v1, openings) {
    const cuts = [u0, u1];
    openings.forEach(o => { cuts.push(Math.max(u0, o.u0), Math.min(u1, o.u1)); });
    const us = Array.from(new Set(cuts)).sort((a, b) => a - b);
    const rects = [];
    for (let i = 0; i < us.length - 1; i++) {
      const a = us[i], b = us[i + 1];
      if (b - a < 1e-6) continue;
      const mid = (a + b) / 2;
      const hits = openings.filter(o => mid > o.u0 && mid < o.u1).sort((p, q) => p.v0 - q.v0);
      let v = v0;
      hits.forEach(o => {
        if (o.v0 > v + 1e-6) rects.push({ u0: a, u1: b, v0: v, v1: o.v0 });
        v = Math.max(v, o.v1);
      });
      if (v1 > v + 1e-6) rects.push({ u0: a, u1: b, v0: v, v1 });
    }
    return rects;
  }

  // Stone slabs over a surface, on a thin dark bed so the joints read as
  // real gaps. `bed: false` lays them straight on what is behind (a floor on
  // the dark slab, a path on the lawn).
  function clad(parts, spec) {
    const bed = spec.bed === false ? 0 : 0.006;
    const extra = spec.object ? { object: spec.object } : null;
    if (bed) {
      const n0 = spec.at, n1 = spec.at + spec.normal * bed;
      const lo = Math.min(n0, n1), hi = Math.max(n0, n1);
      const [a0, a1] = spec.a, [b0, b1] = spec.b;
      const min = spec.plane === 'z' ? [a0, b0, lo] : spec.plane === 'x' ? [lo, b0, a0] : [a0, lo, b0];
      const max = spec.plane === 'z' ? [a1, b1, hi] : spec.plane === 'x' ? [hi, b1, a1] : [a1, hi, b1];
      parts.push(box(min, max, 'grout', spec.group, extra));
    }
    parts.push(Object.assign({
      kind: 'cladding', plane: spec.plane, at: spec.at + spec.normal * bed, normal: spec.normal, depth: spec.depth - bed,
      a: spec.a, b: spec.b, origin: spec.origin || [spec.a[0], spec.b[0]], module: spec.module,
      stagger: spec.stagger || 0, gap: spec.gap === undefined ? 0.008 : spec.gap, chamfer: spec.chamfer === undefined ? 0.006 : spec.chamfer,
      mat: spec.mat, group: spec.group,
    }, extra, spec.photos ? { photos: spec.photos } : null));
  }

  // A wall: normal along `axis` ('z' -> wall in the XY plane, 'x' -> YZ),
  // outer face at `outer`, interior toward `inward` (+1/-1). Layers from the
  // outside in; a layer with `clad` is laid as real stone slabs. Openings
  // with glass get a pane, a slim metal frame and mullions.
  function wall(parts, spec) {
    const { axis, outer, inward, u, v, openings = [], layers, group } = spec;
    const rects = solidRects(u[0], u[1], v[0], v[1], openings);
    const tag = layer => (spec.object && layer.object ? spec.object : null);
    // Corners: two walls must never fill the same space, or their faces
    // would lie in one plane and flicker. The cladding of one wall runs
    // through the corner and the other's stops short of it (`cladTrim`);
    // the cores (`coreTrim`) stop behind whichever cladding and core own
    // the corner. Each layer's section cap follows its own trim.
    const cut = (r, trim) => {
      const [t0, t1] = trim || [0, 0];
      const a0 = Math.max(r.u0, u[0] + t0), a1 = Math.min(r.u1, u[1] - t1);
      return a1 - a0 < 1e-6 ? null : Object.assign({}, r, { u0: a0, u1: a1 });
    };
    let depth = 0;
    layers.forEach(layer => {
      const n0 = outer + inward * depth, n1 = outer + inward * (depth + layer.t);
      const trim = layer.clad ? spec.cladTrim : spec.coreTrim;
      rects.map(r => cut(r, trim)).filter(Boolean).forEach(r => {
        if (layer.clad) {
          clad(parts, Object.assign({
            plane: axis, at: n1, normal: -inward, depth: layer.t, a: [r.u0, r.u1], b: [r.v0, r.v1],
            origin: spec.cladOrigin || [u[0], v[0]], mat: layer.mat, group, object: tag(layer),
          }, layer.clad));
        } else {
          const [min, max] = wallBox(axis, r.u0, r.u1, r.v0, r.v1, n0, n1);
          parts.push(box(min, max, layer.mat, group, tag(layer) ? { object: tag(layer) } : null));
        }
        // Section cut: where a wall's top is exposed in a cut-away view, it
        // reads as dark poché (like a drawn section), not a blank white edge.
        if (spec.cap && r.v1 >= v[1] - 1e-6) {
          const [min, max] = wallBox(axis, r.u0, r.u1, v[1], v[1] + 0.012, n0, n1);
          parts.push(box(min, max, 'poche', group));
        }
      });
      depth += layer.t;
    });
    openings.filter(o => o.glass).forEach(o => {
      const mid = outer + inward * depth * 0.5;
      // The pane sits 2 cm into its frame on every side (not flush with it).
      const [gMin, gMax] = wallBox(axis, o.u0 + 0.02, o.u1 - 0.02, o.v0 + 0.02, o.v1 - 0.02, mid - 0.012, mid + 0.012);
      parts.push(box(gMin, gMax, 'glass', group));
      // Frame: head and sill rails full width, stiles and mullions between
      // them (profiles meet, they do not overlap).
      const f = 0.05;
      const frame = [
        { u0: o.u0, u1: o.u1, v0: o.v0, v1: o.v0 + f }, { u0: o.u0, u1: o.u1, v0: o.v1 - f, v1: o.v1 },
        { u0: o.u0, u1: o.u0 + f, v0: o.v0 + f, v1: o.v1 - f }, { u0: o.u1 - f, u1: o.u1, v0: o.v0 + f, v1: o.v1 - f },
      ];
      // Mullions: at most ~1.6 m of glass between vertical frames.
      const panes = Math.max(1, Math.round((o.u1 - o.u0) / 1.6));
      for (let k = 1; k < panes; k++) {
        const uc = o.u0 + (o.u1 - o.u0) * (k / panes);
        frame.push({ u0: uc - f / 2, u1: uc + f / 2, v0: o.v0 + f, v1: o.v1 - f });
      }
      frame.forEach(r => {
        const [min, max] = wallBox(axis, r.u0, r.u1, r.v0, r.v1, mid - 0.04, mid + 0.04);
        parts.push(box(min, max, 'metal', group));
      });
    });
    return rects;
  }

  function wallDepth(spec) {
    return spec.layers.reduce((s, l) => s + l.t, 0);
  }

  // A deep stone frame around an opening: jambs and head standing proud of
  // the facade by `depth` and lining the reveal back to the glass, with an
  // optional projecting sill below.
  function surround(parts, spec, o, opt) {
    const { axis, outer, inward, group } = spec;
    const out = -inward, w = opt.width;
    const nIn = outer + inward * (wallDepth(spec) * 0.5 - 0.045);   // just outside the window frame
    const nOut = outer + out * opt.depth;
    const bevel = opt.bevel === undefined ? 0.012 : opt.bevel;
    const add = (u0, u1, v0, v1, n1, mat, extra) => {
      const [min, max] = wallBox(axis, u0, u1, v0, v1, nIn, n1);
      parts.push(box(min, max, mat, group, Object.assign({ bevel }, extra || null)));
    };
    // The jambs stand on the sill, so the sill reads as one stone piece: its
    // top in front of the glass, its thickness along the front, and its
    // ends sticking out past the frame on both sides.
    const sill = opt.sill;
    add(o.u0 - w, o.u0 + 0.004, o.v0, o.v1 + w, nOut, opt.mat);
    add(o.u1 - 0.004, o.u1 + w, o.v0, o.v1 + w, nOut, opt.mat);
    add(o.u0 + 0.004, o.u1 - 0.004, o.v1 - 0.004, o.v1 + w, nOut, opt.mat);
    if (sill) {
      add(o.u0 - w - 0.06, o.u1 + w + 0.06, o.v0 - sill.h, o.v0 + 0.004, nOut + out * 0.08, sill.mat,
        sill.object ? { object: sill.object } : null);
    }
  }

  function joints(parts, spec) {
    parts.push(Object.assign({ kind: 'joints', stagger: false, tone: 'dark' }, spec));
  }

  function cyl(parts, base, radius, height, mat, group, extra) {
    parts.push(Object.assign({ kind: 'cyl', base, radius, height, mat, group }, extra || {}));
  }

  // A low stone fence run between two stone pillars' faces (u0..u1) along
  // `axis` ('x': the run follows x at z = at; 'z': it follows z at x = at):
  // a light limestone plinth with a coping, dark vertical metal fins above
  // it with a slim top rail, open enough to see the house through.
  function fenceRun(parts, axis, at, u0, u1) {
    const B = (a0, a1, y0, y1, half) => (axis === 'x'
      ? [[a0, y0, at - half], [a1, y1, at + half]]
      : [[at - half, y0, a0], [at + half, y1, a1]]);
    const add = (spec, mat, extra) => parts.push(box(spec[0], spec[1], mat, 'site', extra));
    add(B(u0, u1, 0, FENCE.plinth, 0.16), 'limestone', { bevel: 0.01 });
    add(B(u0, u1, FENCE.plinth, FENCE.plinth + 0.06, 0.19), 'limestone-light', { bevel: 0.008 });
    [-1, 1].forEach(side => joints(parts, {
      plane: axis === 'x' ? 'z' : 'x', at: at + side * 0.16, normal: side, a: [u0, u1], b: [0, FENCE.plinth],
      module: [1.2, 1], group: 'site', tone: 'dark',
    }));
    const [smin, smax] = B(u0 + 0.06, u1 - 0.06, FENCE.plinth + 0.06, FENCE.height - 0.035, 0.025);
    parts.push({ kind: 'slats', min: smin, max: smax, axis, pitch: 0.15, width: 0.025, mat: 'metal-dark', group: 'site' });
    add(B(u0, u1, FENCE.height - 0.035, FENCE.height, 0.035), 'metal-dark');
  }

  // A stone pillar centred on (x, z); gate pillars are larger and carry a lamp.
  function pillar(parts, x, z, gate, facing) {
    const h = gate ? 0.32 : 0.25, top = gate ? FENCE.height + 0.45 : FENCE.height + 0.18;
    parts.push(box([x - h, 0, z - h], [x + h, top, z + h], 'limestone', 'site', { bevel: 0.012 }));
    parts.push(box([x - h - 0.04, top, z - h - 0.04], [x + h + 0.04, top + 0.08, z + h + 0.04], 'limestone-light', 'site', { bevel: 0.01 }));
    if (gate) parts.push(box([x - 0.12, top - 0.55, z + facing * h], [x + 0.12, top - 0.49, z + facing * (h + 0.02)], 'lamp', 'site'));
  }

  // Pillars at both ends of a straight side and at most every ~3.6 m, with
  // fence runs between their faces.
  function fenceSide(parts, axis, at, u0, u1, opts) {
    const n = Math.max(1, Math.ceil((u1 - u0) / 3.6));
    const posts = Array.from({ length: n + 1 }, (_, k) => u0 + (u1 - u0) * (k / n));
    posts.forEach((u, k) => {
      const end = k === 0 ? 'start' : k === n ? 'end' : null;
      if (end && opts.skip && opts.skip.includes(end)) return;
      const gate = end && opts.gate === end;
      if (axis === 'x') pillar(parts, u, at, gate, 1); else pillar(parts, at, u, gate, 1);
    });
    for (let k = 0; k < n; k++) {
      const a = posts[k] + (k === 0 && opts.gate === 'start' ? 0.32 : 0.25);
      const b = posts[k + 1] - (k === n - 1 && opts.gate === 'end' ? 0.32 : 0.25);
      fenceRun(parts, axis, at, a, b);
    }
  }

  // ---- the site: plot, fence, path, planting ------------------------------------
  function buildSite(parts) {
    const P = PLOT, F = FENCE, R = 140, low = -0.5;
    // The fenced lawn plot, and the quieter meadow round it.
    parts.push(box([P.x0, low, P.z0], [P.x1, 0, P.z1], 'lawn', 'site'));
    [
      [[-R, low, -R], [R, 0, P.z0]], [[-R, low, P.z1], [R, 0, R]],
      [[-R, low, P.z0], [P.x0, 0, P.z1]], [[P.x1, low, P.z0], [R, 0, P.z1]],
    ].forEach(([min, max]) => parts.push(box(min, max, 'meadow', 'site')));

    // The fence: north side and the two ends of the street side own the
    // corner pillars; the street side opens between two gate pillars on
    // the path.
    fenceSide(parts, 'x', F.z0, F.x0, F.x1, {});
    fenceSide(parts, 'x', F.z1, F.x0, GATE.x0, { gate: 'end' });
    fenceSide(parts, 'x', F.z1, GATE.x1, F.x1, { gate: 'start' });
    fenceSide(parts, 'z', F.x0, F.z0, F.z1, { skip: ['start', 'end'] });
    fenceSide(parts, 'z', F.x1, F.z0, F.z1, { skip: ['start', 'end'] });
    parts.push(box([GATE.x0 + 0.32, 0, F.z1 - 0.2], [GATE.x1 - 0.32, 0.04, F.z1 + 0.2], 'limestone', 'site', { bevel: 0.01 }));

    // Path from the street to the entrance: large slabs with lawn joints,
    // through the gate; a stone pavement outside the fence.
    clad(parts, {
      plane: 'y', at: 0, normal: 1, depth: 0.03, a: [PATH.x0, PATH.x1], b: [7.04, F.z1 - 0.2],
      origin: [PATH.x0, 7.04], module: [3.2, 0.9], gap: 0.1, chamfer: 0.008, mat: 'paving', group: 'site', bed: false,
    });
    clad(parts, {
      plane: 'y', at: 0, normal: 1, depth: 0.03, a: [PATH.x0, PATH.x1], b: [F.z1 + 0.2, P.z1 + 0.4],
      origin: [PATH.x0, F.z1 + 0.2], module: [3.2, 0.9], gap: 0.1, chamfer: 0.008, mat: 'paving', group: 'site', bed: false,
    });
    clad(parts, {
      plane: 'y', at: 0, normal: 1, depth: 0.03, a: [-22, 24], b: [P.z1 + 0.4, P.z1 + 2.4], origin: [-22, P.z1 + 0.4],
      module: [1.2, 1.0], stagger: 0.5, gap: 0.008, chamfer: 0.006, mat: 'paving', group: 'site', bed: false,
    });
    // Low bollard lights along the path.
    [8.6, 10.2].forEach(z => [PATH.x0 - 0.35, PATH.x1 + 0.35].forEach(x => {
      parts.push(box([x - 0.06, 0, z - 0.06], [x + 0.06, 0.55, z + 0.06], 'metal-dark', 'site'));
      parts.push(box([x - 0.062, 0.44, z - 0.062], [x + 0.062, 0.5, z + 0.062], 'lamp', 'site'));
    }));

    // A gravel drip strip round the house.
    parts.push(box([-8.8, 0, -6.2], [8.3, 0.012, 6.8], 'gravel', 'site'));

    // Planting bed west of the path: a clipped hedge and a low clipped mass of
    // grasses in a stone curb.
    const bed = { x0: -8.4, x1: -4.4, z0: 7.5, z1: 10.9 };
    [[[bed.x0, 0, bed.z0], [bed.x1, 0.22, bed.z0 + 0.12]], [[bed.x0, 0, bed.z1 - 0.12], [bed.x1, 0.22, bed.z1]],
      [[bed.x0, 0, bed.z0 + 0.12], [bed.x0 + 0.12, 0.22, bed.z1 - 0.12]], [[bed.x1 - 0.12, 0, bed.z0 + 0.12], [bed.x1, 0.22, bed.z1 - 0.12]]]
      .forEach(([min, max]) => parts.push(box(min, max, 'limestone-light', 'site', { bevel: 0.01 })));
    parts.push(box([bed.x0 + 0.12, 0, bed.z0 + 0.12], [bed.x1 - 0.12, 0.16, bed.z1 - 0.12], 'soil', 'site'));
    parts.push(box([bed.x0 + 0.25, 0.16, bed.z0 + 0.25], [bed.x1 - 0.25, 0.8, bed.z0 + 1.05], 'foliage', 'site', { bevel: 0.1 }));
    parts.push(box([bed.x0 + 0.3, 0.16, bed.z0 + 1.35], [bed.x1 - 0.3, 0.5, bed.z1 - 0.3], 'grass', 'site', { bevel: 0.12 }));

    // A few large trees: inside the fence, framing the house, and in the meadow.
    [
      [-11.2, -7.6, 3.3, 3.8], [10.8, -6.8, 3.0, 3.6], [-10.4, 8.6, 2.3, 2.8], [11.6, 3.4, 2.1, 2.6],
      [-29, -5, 3.6, 4.2], [-25, 14, 2.8, 3.4], [5, -27, 3.8, 4.4], [-10, -28, 3.0, 3.6], [31, 3, 3.0, 3.6], [28, -19, 3.6, 4.2], [-17, 27, 2.8, 3.4],
    ].forEach(([x, z, crown, trunk]) => parts.push({ kind: 'tree', position: [x, 0, z], trunk, crown, mat: 'foliage', group: 'site' }));
  }

  // ---- the house ----------------------------------------------------------------
  function buildHouse() {
    const parts = [];
    buildSite(parts);

    // ---- plinth, entrance, terrace --------------------------------------------
    parts.push(box([GF.x0 - 0.05, 0, GF.z0 - 0.05], [GF.x1 + 0.05, FF1, GF.z1 + 0.05], 'steel-grey', 'site'));

    // Entrance: a monolithic landing and two wide Steel Grey steps with
    // floating treads over recessed risers, flanked by stone cheeks.
    const E = { x0: -4.4, x1: 0.8 };
    [[5.0, 6.2, FF1 + 0.02], [6.2, 6.6, 0.32], [6.6, 7.0, 0.17]].forEach(([z0, z1, top]) => {
      parts.push(box([E.x0, top - 0.14, z0], [E.x1, top, z1 + 0.04], 'steel-grey', 'site', { bevel: 0.015, object: 'entrance-steps' }));
      parts.push(box([E.x0 + 0.04, 0, z0], [E.x1 - 0.04, top - 0.14, z1 - 0.02], 'steel-grey', 'site'));
    });
    parts.push(box([-5.3, 0, 5.05], [-4.45, 0.9, 7.2], 'steel-grey', 'site', { bevel: 0.015 }));
    parts.push(box([-5.2, 0.9, 5.15], [-4.55, 1.22, 7.1], 'foliage', 'site', { bevel: 0.08 }));
    parts.push(box([0.8, 0, 5.05], [1.0, 0.95, 7.2], 'steel-grey', 'site', { bevel: 0.012 }));

    // Terrace off the living room: limestone paving on a Steel Grey podium, steps
    // down to the lawn on the east, a planter and two loungers.
    parts.push(box([1.0, 0, GF.z1 + 0.05], [10, FF1, 9.5], 'steel-grey', 'site'));
    clad(parts, {
      plane: 'y', at: FF1, normal: 1, depth: 0.02, a: [1.0, 10], b: [GF.z1 + 0.05, 9.5], origin: [1.0, GF.z1],
      module: [0.9, 0.9], gap: 0.005, chamfer: 0.004, mat: 'paving', group: 'site', object: 'terrace-floor', bed: false,
    });
    [[10, 10.4, 0.3], [10.4, 10.8, 0.15]].forEach(([x0, x1, top]) => {
      parts.push(box([x0 - 0.04, top - 0.12, 6.0], [x1, top, 8.6], 'steel-grey', 'site', { bevel: 0.012 }));
      parts.push(box([x0, 0, 6.04], [x1 - 0.03, top - 0.12, 8.56], 'steel-grey', 'site'));
    });
    parts.push(box([1.4, FF1 + 0.02, 8.95], [6.2, 0.95, 9.4], 'steel-grey', 'site', { bevel: 0.012 }));
    parts.push(box([1.5, 0.95, 9.03], [6.1, 1.28, 9.32], 'foliage', 'site', { bevel: 0.06 }));
    [7.2, 8.4].forEach(x => {
      parts.push(box([x, FF1 + 0.02, 6.3], [x + 0.7, 0.72, 8.2], 'wood', 'site', { bevel: 0.01 }));
      parts.push(box([x + 0.04, 0.72, 6.6], [x + 0.66, 0.8, 8.16], 'fabric-light', 'site', { bevel: 0.025 }));
      parts.push({ kind: 'beam', from: [x + 0.35, 0.86, 6.52], to: [x + 0.35, 1.22, 6.24], width: 0.62, height: 0.08, mat: 'fabric-light', group: 'site' });
    });

    // ---- ground floor: limestone skin on a plaster core ---------------------------
    const gfClad = { module: [1.5, 0.75], stagger: 0.5, gap: 0.008, chamfer: 0.007 };
    const gfLayers = [{ t: 0.06, mat: 'limestone', object: true, clad: gfClad }, { t: 0.24, mat: 'plaster' }];
    const frame = { width: 0.2, depth: 0.32, mat: 'limestone-light' };
    const south = { axis: 'z', outer: GF.z1, inward: -1, u: [GF.x0, GF.x1], v: [FF1, SLAB], group: 'gf-south', layers: gfLayers, cap: true, cladOrigin: [GF.x0, FF1] };
    const slot = { u0: -6.45, u1: -6.0, v0: FF1, v1: 3.2, glass: true };
    const living = { u0: 1.2, u1: 6.6, v0: FF1, v1: 3.2, glass: true };
    // The facade object is the stone wall west of the niche.
    // The street wall stops at the niche's side walls; stone faces cover
    // those walls' ends, so no plaster shows at the opening.
    wall(parts, Object.assign({}, south, { u: [GF.x0, -3.5], openings: [slot], object: 'facade', cladTrim: [0.06, 0], coreTrim: [0.3, 0] }));
    wall(parts, Object.assign({}, south, { u: [-0.1, GF.x1], openings: [living], cladTrim: [0, 0.06], coreTrim: [0, 0.3] }));
    [[-3.5, -3.2], [-0.4, -0.1]].forEach(([x0, x1]) => parts.push(box([x0, FF1, GF.z1 - 0.06], [x1, SLAB, GF.z1], 'limestone', 'gf-south', { bevel: 0.006 })));
    surround(parts, south, slot, { width: 0.1, depth: 0.24, mat: 'metal-dark', bevel: 0 });
    surround(parts, south, living, { width: 0.32, depth: 0.46, mat: 'limestone-light' });
    // Slender stone fins on the mullions of the living-room glazing.
    [3.0, 4.8].forEach(x => parts.push(box([x - 0.075, FF1, GF.z1 - 0.1], [x + 0.075, 3.2, GF.z1 + 0.34], 'limestone-light', 'gf-south', { bevel: 0.01 })));

    // Entrance niche: 2 m deep, lined with the facade limestone in large
    // panels; its floor and the steps before it are Steel Grey.
    const nicheLayers = [{ t: 0.05, mat: 'limestone', clad: { module: [1.0, 1.5], gap: 0.006, chamfer: 0.005 } }, { t: 0.25, mat: 'plaster' }];
    // The side walls stop behind the stone faces at the street front.
    wall(parts, { axis: 'x', outer: -3.2, inward: -1, u: [3.0, GF.z1 - 0.06], v: [FF1, SLAB], group: 'gf-south', layers: nicheLayers });
    wall(parts, { axis: 'x', outer: -0.4, inward: 1, u: [3.0, GF.z1 - 0.06], v: [FF1, SLAB], group: 'gf-south', layers: nicheLayers });
    wall(parts, { axis: 'z', outer: 3.0, inward: -1, u: [-3.2, -0.4], v: [FF1, SLAB], group: 'gf-south', layers: nicheLayers,
      openings: [{ u0: -2.45, u1: -1.25, v0: FF1, v1: 3.15 }, { u0: -1.0, u1: -0.6, v0: FF1, v1: 3.15, glass: true }] });
    parts.push(box([-2.45, FF1 + 0.02, 2.8], [-1.25, 3.15, 2.86], 'wood-dark', 'gf-south'));
    parts.push(box([-1.43, 1.0, 2.86], [-1.4, 2.3, 2.92], 'metal-dark', 'gf-south'));
    clad(parts, {
      plane: 'y', at: FF1, normal: 1, depth: 0.02, a: [-3.2, -0.4], b: [3.0, GF.z1], module: [1.4, 1.0],
      gap: 0.005, chamfer: 0.004, mat: 'steel-grey', group: 'gf-south', object: 'entrance-steps', bed: false,
    });
    parts.push(box([-3.15, SLAB - 0.035, 3.0], [-0.45, SLAB - 0.005, 3.1], 'lamp', 'gf-south'));

    // East and west walls own the corners' cladding; north and south own
    // none of the corner (their cladding stops at the side walls' face,
    // their cores at the side walls' inner face).
    const west = { axis: 'x', outer: GF.x0, inward: 1, u: [GF.z0, GF.z1], v: [FF1, SLAB], group: 'gf-west', layers: gfLayers, cap: true, coreTrim: [0.06, 0.06] };
    wall(parts, west);
    const kitchenWindow = { u0: 3.0, u1: 5.2, v0: 1.6, v1: 3.2, glass: true };
    const hallWindow = { u0: -5.9, u1: -3.8, v0: 0.955, v1: 3.0, glass: true };
    const north = { axis: 'z', outer: GF.z0, inward: 1, u: [GF.x0, GF.x1], v: [FF1, SLAB], group: 'gf-north', layers: gfLayers, cap: true,
      openings: [hallWindow, kitchenWindow], cladTrim: [0.06, 0.06], coreTrim: [0.3, 0.3] };
    wall(parts, north);
    surround(parts, north, hallWindow, Object.assign({ sill: { h: 0.07, mat: 'steel-grey' } }, frame));
    surround(parts, north, kitchenWindow, Object.assign({ sill: { h: 0.07, mat: 'steel-grey' } }, frame));
    const eastWindow = { u0: 0.6, u1: 4.4, v0: 1.3, v1: 3.2, glass: true };
    const east = { axis: 'x', outer: GF.x1, inward: -1, u: [GF.z0, GF.z1], v: [FF1, SLAB], group: 'gf-east', layers: gfLayers, cap: true, openings: [eastWindow], coreTrim: [0.06, 0.06] };
    wall(parts, east);
    surround(parts, east, eastWindow, Object.assign({ sill: { h: 0.07, mat: 'steel-grey' } }, frame));

    // Interior partition between the hall and the living room.
    wall(parts, { axis: 'x', outer: 0.93, inward: 1, u: [-4.7, 4.7], v: [FF1, SLAB], group: 'gf-interior', cap: true,
      layers: [{ t: 0.14, mat: 'plaster' }], openings: [{ u0: -0.2, u1: 1.0, v0: FF1, v1: 2.6 }] });

    // ---- floors ------------------------------------------------------------------
    // Floors: wide boards of warm, light oak, laid east-west in a loose
    // running bond -- a quiet ground for the stone. (The bathroom has stone.)
    const BOARD = { module: [2.1, 0.21], stagger: 0.37, gap: 0.002, chamfer: 0.0015 };
    const floor = (a, b, object) => clad(parts, Object.assign({
      plane: 'y', at: FF1, normal: 1, depth: 0.02, a, b, origin: [-6.7, -4.7],
      mat: 'wood-floor', group: 'gf-floors', object, bed: false,
    }, BOARD));
    floor([-6.7, 0.93], [-4.7, 2.7], 'hall-floor');
    floor([-6.7, -3.5], [2.7, 4.7], 'hall-floor');
    floor([-0.1, 0.93], [2.7, 4.7], 'hall-floor');
    floor([1.07, 6.7], [-4.7, 4.7], 'living-floor');

    // ---- hall ------------------------------------------------------------------------
    // A honed Steel Grey wall in large panels (the plinth's stone, indoors)
    // with a light cove above it.
    clad(parts, {
      plane: 'z', at: -4.7, normal: 1, depth: 0.036, a: [-3.4, 0.93], b: [FF1 + 0.02, SLAB], module: [4.33 / 4, (SLAB - FF1 - 0.02) / 2],
      gap: 0.004, chamfer: 0.004, mat: 'steel-grey-honed', group: 'gf-interior', object: 'hall-wall',
    });
    parts.push(box([-3.4, SLAB - 0.04, -4.664], [0.93, SLAB - 0.01, -4.6], 'lamp', 'gf-interior'));
    // A bench: a timber seat on two stone blocks.
    parts.push(box([-2.5, 0.86, -4.6], [0.1, 0.92, -4.18], 'wood', 'gf-interior', { bevel: 0.01 }));
    [-2.3, -0.25].forEach(x => parts.push(box([x, FF1 + 0.02, -4.56], [x + 0.35, 0.86, -4.22], 'limestone-light', 'gf-interior', { bevel: 0.008 })));
    // Window seat: a deep stone sill under the hall's north window.
    parts.push(box([-5.95, 0.9, -4.85], [-3.75, 0.96, -4.08], 'limestone-light', 'gf-interior', { bevel: 0.006, object: 'hall-sill' }));
    parts.push(box([-5.88, FF1 + 0.02, -4.7], [-3.82, 0.9, -4.16], 'wood-dark', 'gf-interior'));
    parts.push(box([-5.7, 0.96, -4.62], [-4.7, 1.04, -4.2], 'fabric-light', 'gf-interior', { bevel: 0.025 }));

    // ---- living room -------------------------------------------------------------------
    // The feature wall: Majestic, bookmatched from two consecutive slabs of
    // one bundle (M0491372 / M0491373, whose faces mirror each other), each
    // standing full height, their top edges meeting on the centre axis. A
    // showroom composition from the real slab photos, not a factory
    // bookmatch.
    clad(parts, {
      plane: 'x', at: 1.07, normal: 1, depth: 0.036, a: [1.05, 4.7], b: [FF1 + 0.02, SLAB], module: [3.65 / 2, SLAB - FF1 - 0.02],
      gap: 0.003, chamfer: 0.002, mat: 'majestic', group: 'gf-interior', object: 'living-panno',
      photos: [
        { src: 'majestic-M0491373', rotate: 270, offset: [0, 0] },       // right of the axis (seen from the room)
        { src: 'majestic-M0491372', rotate: 90, offset: ['end', 0] },    // left of the axis
      ],
    });
    // Fireplace portal on the feature wall's axis, facing the sofa, in our
    // light limestone: a stone podium carried forward as the hearth; two
    // pilasters on widened plinths, each face split by a shallow recessed
    // flute; a stone frame round a deep dark firebox (stone reveals, dark
    // back and floor); a frieze set back for a shadow line; then a stepped
    // cornice -- band, step, massive shelf -- each proud of the one below.
    // Every block has its own depth (x from the Majestic face), so light
    // and shade pick the planes out. The Majestic stays the background:
    // well over a metre and a half of it shows above, almost a metre each side.
    const FP = {
      x0: 1.106, zc: 2.875,
      W: 0.78, H: 0.62,                // the firebox opening
      frame: 0.08, pil: 0.30, flute: 0.16, frieze: 0.14,
      podium: 0.08, plinth: 0.14,
    };
    {
      const X = d => FP.x0 + d, Z = (s, h) => FP.zc + s * h;
      const y0 = FF1 + 0.02, y1 = y0 + FP.podium, yH = y1 + FP.H, yF = yH + FP.frame, yP = yF + FP.frieze;
      const w = FP.W / 2, wf = w + FP.frame, wp = wf + FP.pil;
      const fp = { object: 'living-fireplace' };
      const stone = (min, max, bevel) => parts.push(box(min, max, 'limestone-light', 'gf-interior', Object.assign(bevel ? { bevel } : {}, fp)));
      const dark = (min, max) => parts.push(box(min, max, 'poche', 'gf-interior', fp));
      // Podium under the whole portal, reaching forward as the hearth.
      stone([X(0), y0, Z(-1, 0.84)], [X(0.6), y1, Z(1, 0.84)], 0.006);
      [-1, 1].forEach(s => {
        const zIn = Z(s, wf), zOut = Z(s, wp), zFl0 = Z(s, wf + (FP.pil - FP.flute) / 2), zFl1 = Z(s, wp - (FP.pil - FP.flute) / 2);
        const lo = (a, b) => [Math.min(a, b), Math.max(a, b)];
        // Plinth: wider outward and forward than the shaft above it.
        const [pz0, pz1] = lo(zIn, Z(s, wp + 0.02));
        stone([X(0), y1, pz0], [X(0.28), y1 + FP.plinth, pz1], 0.005);
        // Shaft: two outer strips and a flute recessed 1.5 cm between them.
        [[zIn, zFl0, 0.24], [zFl0, zFl1, 0.225], [zFl1, zOut, 0.24]].forEach(([a, b, d]) => {
          const [z0, z1] = lo(a, b);
          stone([X(0), y1 + FP.plinth, z0], [X(d), yP, z1], 0.003);
        });
        // Frame jamb beside the opening, 4 cm behind the pilaster faces; its
        // inner face is the firebox's stone reveal.
        const [jz0, jz1] = lo(Z(s, w), zIn);
        stone([X(0), y1, jz0], [X(0.2), yH, jz1], 0.004);
      });
      // Frame head over the opening, then the frieze set 2 cm further back.
      stone([X(0), yH, Z(-1, wf)], [X(0.2), yF, Z(1, wf)], 0.004);
      stone([X(0), yF, Z(-1, wf)], [X(0.18), yP, Z(1, wf)], 0.003);
      // Cornice: a band proud of the pilasters, a small step, the shelf.
      stone([X(0), yP, Z(-1, wp + 0.02)], [X(0.27), yP + 0.05, Z(1, wp + 0.02)], 0.004);
      stone([X(0), yP + 0.05, Z(-1, wp + 0.03)], [X(0.3), yP + 0.07, Z(1, wp + 0.03)], 0.003);
      stone([X(0), yP + 0.07, Z(-1, wp + 0.06)], [X(0.34), yP + 0.13, Z(1, wp + 0.06)], 0.008);
      // The firebox: a dark back 14 cm behind the frame and a dark floor
      // that stops short of the frame's edge.
      dark([X(0), y1, Z(-1, w)], [X(0.06), yH, Z(1, w)]);
      dark([X(0.06), y1, Z(-1, w)], [X(0.18), y1 + 0.01, Z(1, w)]);
    }
    parts.push(box([2.2, FF1 + 0.02, 1.3], [5.5, FF1 + 0.03, 4.3], 'rug', 'gf-interior'));
    parts.push(box([2.65, FF1 + 0.03, 2.25], [3.5, 0.8, 3.25], 'steel-grey-honed', 'gf-interior', { bevel: 0.01 }));
    // Sofa facing the panno.
    parts.push(box([4.36, FF1 + 0.03, 1.16], [5.24, 0.56, 4.34], 'poche', 'gf-interior'));
    parts.push(box([4.3, 0.56, 1.1], [5.3, 0.78, 4.4], 'fabric', 'gf-interior', { bevel: 0.03 }));
    parts.push(box([4.32, 0.78, 1.32], [5.02, 0.9, 2.74], 'fabric-light', 'gf-interior', { bevel: 0.035 }));
    parts.push(box([4.32, 0.78, 2.76], [5.02, 0.9, 4.18], 'fabric-light', 'gf-interior', { bevel: 0.035 }));
    parts.push(box([5.0, 0.78, 1.3], [5.3, 1.28, 4.2], 'fabric', 'gf-interior', { bevel: 0.04 }));
    parts.push(box([4.3, 0.78, 1.1], [5.3, 1.02, 1.3], 'fabric', 'gf-interior', { bevel: 0.03 }));
    parts.push(box([4.3, 0.78, 4.2], [5.3, 1.02, 4.4], 'fabric', 'gf-interior', { bevel: 0.03 }));
    // Armchair by the glazing, facing the room.
    parts.push(box([2.6, FF1 + 0.03, 3.85], [3.4, 0.8, 4.6], 'fabric', 'gf-interior', { bevel: 0.03 }));
    parts.push(box([2.6, 0.8, 4.4], [3.4, 1.25, 4.6], 'fabric', 'gf-interior', { bevel: 0.035 }));
    parts.push(box([2.64, 0.8, 3.88], [3.36, 0.88, 4.4], 'fabric-light', 'gf-interior', { bevel: 0.03 }));
    // Floor lamp.
    cyl(parts, [5.6, FF1 + 0.02, 0.85], 0.16, 0.02, 'metal-dark', 'gf-interior');
    cyl(parts, [5.6, FF1 + 0.04, 0.85], 0.012, 1.1, 'metal-dark', 'gf-interior');
    cyl(parts, [5.6, 1.45, 0.85], 0.22, 0.3, 'shade', 'gf-interior', { radiusTop: 0.19 });
    // Wide stone sill with a thick front edge.
    parts.push(box([6.36, 1.26, 0.5], [6.86, 1.31, 4.5], 'limestone-light', 'gf-interior', { bevel: 0.006, object: 'living-sill' }));
    parts.push(box([6.36, 1.2, 0.5], [6.41, 1.26, 4.5], 'limestone-light', 'gf-interior', { object: 'living-sill' }));

    // ---- kitchen ---------------------------------------------------------------------------
    // Fronts: separate panels with 4 mm gaps on a recessed carcass, a dark
    // handle-less groove under the worktop.
    const fronts = (x0, x1, y0, y1, zFace, cols, rows, mat) => {
      const gap = 0.004, w = (x1 - x0 - gap * (cols - 1)) / cols;
      for (let c = 0; c < cols; c++) {
        const r = rows[c % rows.length], hs = r.map(h => h * (y1 - y0 - gap * (r.length - 1)));
        let y = y0;
        hs.forEach(h => {
          const a = x0 + c * (w + gap);
          parts.push(box([a, y, zFace - 0.02], [a + w, y + h, zFace], mat, 'gf-interior', { bevel: 0.002 }));
          y += h + gap;
        });
      }
    };
    parts.push(box([1.57, FF1 + 0.02, -4.7], [5.95, 0.57, -4.2], 'poche', 'gf-interior'));
    parts.push(box([1.57, 0.57, -4.7], [5.95, 1.1, -4.14], 'cabinet', 'gf-interior'));
    parts.push(box([1.55, FF1 + 0.02, -4.7], [1.57, 1.31, -4.1], 'wood', 'gf-interior', { bevel: 0.002 }));
    parts.push(box([1.57, 1.25, -4.16], [5.95, 1.31, -4.14], 'poche', 'gf-interior'));
    fronts(1.57, 5.95, 0.575, 1.25, -4.12, 7, [[0.28, 0.33, 0.39], [0.28, 0.33, 0.39], [1], [1], [1], [1], [0.28, 0.33, 0.39]], 'wood');
    // Viscont White from two neighbouring cuts of one bundle (K0534518,
    // K0534519), every piece laid with the waves running the same way. The
    // 4.45 m worktop is longer than a 3.3 m strip: two pieces with a joint
    // beside the tall column, as it would be made. The first piece is cut
    // round an undermount sink; its pattern runs on across the cut.
    const VW18 = 'viscont-white-K0534518', VW19 = 'viscont-white-K0534519';
    const topA = { src: VW18, plane: 'y', offset: [0.02, 0.15], scale: 0.97, area: { min: [1.5, 1.31, -4.7], max: [4.8, 1.35, -4.05] } };
    const topB = { src: VW19, plane: 'y', offset: [2.05, 0.15], scale: 0.97 };
    const sink = { x0: 3.7, x1: 4.5, z0: -4.55, z1: -4.2 };
    [[1.5, sink.x0, -4.7, -4.05], [sink.x1, 4.8, -4.7, -4.05], [sink.x0, sink.x1, -4.7, sink.z0], [sink.x0, sink.x1, sink.z1, -4.05]].forEach(([x0, x1, z0, z1]) => {
      parts.push(box([x0, 1.31, z0], [x1, 1.35, z1], 'viscont-white', 'gf-interior', { bevel: 0.004, object: 'kitchen-counter', photo: topA }));
    });
    parts.push(box([1.5, 1.27, -4.09], [4.8, 1.31, -4.05], 'viscont-white', 'gf-interior', { object: 'kitchen-counter', photo: topA }));
    parts.push(box([4.8, 1.31, -4.7], [5.95, 1.35, -4.05], 'viscont-white', 'gf-interior', { bevel: 0.004, object: 'kitchen-counter', photo: topB }));
    parts.push(box([4.8, 1.27, -4.09], [5.95, 1.31, -4.05], 'viscont-white', 'gf-interior', { object: 'kitchen-counter', photo: topB }));
    // Undermount stainless sink: a deep bowl just under the stone's cut.
    const t = 0.008, bowlTop = 1.31, bowlBottom = 1.12;
    [[sink.x0 - t, sink.x0, sink.z0 - t, sink.z1 + t], [sink.x1, sink.x1 + t, sink.z0 - t, sink.z1 + t],
      [sink.x0, sink.x1, sink.z0 - t, sink.z0], [sink.x0, sink.x1, sink.z1, sink.z1 + t]].forEach(([x0, x1, z0, z1]) => {
      parts.push(box([x0, bowlBottom, z0], [x1, bowlTop, z1], 'steel', 'gf-interior'));
    });
    parts.push(box([sink.x0 - t, bowlBottom - t, sink.z0 - t], [sink.x1 + t, bowlBottom, sink.z1 + t], 'steel', 'gf-interior'));
    cyl(parts, [(sink.x0 + sink.x1) / 2, bowlBottom, (sink.z0 + sink.z1) / 2], 0.045, 0.003, 'metal-dark', 'gf-interior');
    // Gooseneck mixer in dark metal.
    const fx = (sink.x0 + sink.x1) / 2, fz = -4.62;
    cyl(parts, [fx, 1.35, fz], 0.026, 0.02, 'metal', 'gf-interior');
    cyl(parts, [fx, 1.37, fz], 0.016, 0.3, 'metal', 'gf-interior');
    const arc = [];
    for (let k = 0; k <= 8; k++) {
      const a = Math.PI - (k / 8) * Math.PI;
      arc.push([fx, 1.67 + Math.sin(a) * 0.1, fz + 0.1 + Math.cos(a) * 0.1]);
    }
    for (let k = 0; k < 8; k++) parts.push({ kind: 'beam', from: arc[k], to: arc[k + 1], width: 0.022, height: 0.022, mat: 'metal', group: 'gf-interior' });
    parts.push({ kind: 'beam', from: [fx, 1.67, fz + 0.2], to: [fx, 1.61, fz + 0.2], width: 0.024, height: 0.024, mat: 'metal', group: 'gf-interior' });
    parts.push({ kind: 'beam', from: [fx + 0.02, 1.52, fz], to: [fx + 0.09, 1.55, fz], width: 0.012, height: 0.012, mat: 'metal', group: 'gf-interior' });
    // Glass-ceramic hob set flush into the stone: thin black glass, four
    // quiet rings, a touch strip.
    parts.push(box([1.86, 1.35, -4.6], [2.64, 1.355, -4.14], 'glass-black', 'gf-interior', { bevel: 0.002 }));
    [[2.05, -4.46, 0.1], [2.45, -4.46, 0.085], [2.05, -4.27, 0.085], [2.45, -4.27, 0.1]].forEach(([x, z, r]) => {
      cyl(parts, [x, 1.3551, z], r, 0.0006, 'hob-ring', 'gf-interior');
      cyl(parts, [x, 1.3551, z], r - 0.006, 0.0009, 'glass-black', 'gf-interior');
    });
    parts.push(box([2.14, 1.3551, -4.185], [2.36, 1.3556, -4.165], 'hob-ring', 'gf-interior'));
    [[1.5, 3.0, 2.35], [3.0, 5.2, 1.55], [5.2, 5.95, 2.35]].forEach(([x0, x1, top]) => {
      parts.push(box([x0, 1.35, -4.7], [x1, top, -4.68], 'viscont-white', 'gf-interior', { object: 'kitchen-backsplash' }));
    });
    parts.push(box([2.95, 1.55, -4.85], [5.25, 1.605, -4.62], 'viscont-white', 'gf-interior', { bevel: 0.004, object: 'kitchen-backsplash' }));
    // Wall units: a carcass with separate doors, a light strip underneath,
    // the hood's filter set into the unit over the hob.
    [[1.5, 3.0, 3], [5.2, 5.95, 1]].forEach(([x0, x1, cols]) => {
      parts.push(box([x0, 2.35, -4.7], [x1, 3.2, -4.38], 'cabinet', 'gf-interior'));
      fronts(x0 + 0.002, x1 - 0.002, 2.352, 3.198, -4.36, cols, [[1]], 'cabinet');
      parts.push(box([x0 + 0.05, 2.335, -4.46], [x1 - 0.05, 2.35, -4.41], 'lamp', 'gf-interior'));
    });
    parts.push(box([1.95, 2.338, -4.66], [2.55, 2.35, -4.47], 'steel', 'gf-interior'));
    // Tall column: a drawer, two built-in ovens with steel handles, a door.
    parts.push(box([5.95, FF1 + 0.02, -4.7], [6.7, 3.0, -4.14], 'cabinet', 'gf-interior'));
    parts.push(box([5.955, 0.575, -4.14], [6.695, 1.03, -4.12], 'cabinet', 'gf-interior', { bevel: 0.002 }));
    parts.push(box([5.955, 2.12, -4.14], [6.695, 2.995, -4.12], 'cabinet', 'gf-interior', { bevel: 0.002 }));
    [[1.05, 1.62], [1.66, 2.08]].forEach(([y0, y1]) => {
      parts.push(box([5.975, y0, -4.14], [6.675, y1, -4.115], 'glass-black', 'gf-interior', { bevel: 0.003 }));
      parts.push({ kind: 'beam', from: [6.03, y1 - 0.05, -4.09], to: [6.62, y1 - 0.05, -4.09], width: 0.016, height: 0.016, mat: 'steel', group: 'gf-interior' });
    });
    // Island with stone waterfall ends, and the raised bar on its south side.
    // The ends fold the island top's pattern down over its edges (a mitred
    // waterfall), so the stone reads as one piece turning the corner.
    const isl = { ox: 0.08, s: 0.92, len: 3.1, drop: 1.29 - (FF1 + 0.02) };
    parts.push(box([2.35, 1.29, -3.15], [5.45, 1.35, -2.15], 'viscont-white', 'gf-interior', {
      bevel: 0.005, object: 'kitchen-island', photo: { src: VW19, plane: 'y', offset: [isl.ox, 0], scale: isl.s } }));
    parts.push(box([2.35, FF1 + 0.02, -3.15], [2.41, 1.29, -2.2], 'viscont-white', 'gf-interior', {
      object: 'kitchen-island', photo: { src: VW19, plane: 'x', normal: -1, rotate: 90, mirror: true, offset: [isl.ox, 0], scale: isl.s } }));
    parts.push(box([5.39, FF1 + 0.02, -3.15], [5.45, 1.29, -2.2], 'viscont-white', 'gf-interior', {
      object: 'kitchen-island', photo: { src: VW19, plane: 'x', normal: 1, rotate: 270, mirror: true, offset: [isl.ox + (isl.len - isl.drop) * isl.s, 0], scale: isl.s } }));
    parts.push(box([2.45, FF1 + 0.02, -3.05], [5.35, 1.29, -2.25], 'wood', 'gf-interior'));
    const bar = { src: VW18, scale: 0.92 };
    parts.push(box([2.35, 1.5, -2.15], [5.45, 1.55, -1.7], 'viscont-white', 'gf-interior', {
      bevel: 0.005, object: 'kitchen-bar', photo: Object.assign({ plane: 'y', rotate: 180, offset: [0.1, 0.05] }, bar) }));
    parts.push(box([2.35, 1.35, -2.2], [5.45, 1.5, -2.15], 'viscont-white', 'gf-interior', {
      object: 'kitchen-bar', photo: Object.assign({ plane: 'z', normal: -1, offset: [0.1, 0.55] }, bar) }));
    [[2.35, -1], [5.39, 1]].forEach(([x, normal]) => parts.push(box([x, FF1 + 0.02, -2.15], [x + 0.06, 1.5, -1.7], 'viscont-white', 'gf-interior', {
      object: 'kitchen-bar', photo: Object.assign({ plane: 'x', normal, rotate: 90, offset: [normal < 0 ? 0.1 : 1.6, 0.05] }, bar) })));
    // Bar stools: a slim dark-metal frame (splayed legs, a footrest ring),
    // an oak seat frame, an upholstered seat and a low back.
    [3.1, 3.9, 4.7].forEach(x => {
      const z = -1.35, f = FF1 + 0.02, seat = 1.17, legAt = h => 0.2 - 0.04 * (h - f) / (seat - f);
      const leg = (sx, sz, h) => [x + sx * legAt(h), h, z + sz * legAt(h)];
      [[-1, -1], [1, -1], [1, 1], [-1, 1]].forEach(([sx, sz]) => parts.push({
        kind: 'beam', from: leg(sx, sz, f), to: leg(sx, sz, seat), width: 0.02, height: 0.02, mat: 'metal-dark', group: 'gf-interior' }));
      const ring = 0.77;
      [[[-1, -1], [1, -1]], [[1, -1], [1, 1]], [[1, 1], [-1, 1]], [[-1, 1], [-1, -1]]].forEach(([a, b]) => parts.push({
        kind: 'beam', from: leg(a[0], a[1], ring), to: leg(b[0], b[1], ring), width: 0.014, height: 0.014, mat: 'metal-dark', group: 'gf-interior' }));
      parts.push(box([x - 0.2, seat, z - 0.2], [x + 0.2, seat + 0.02, z + 0.2], 'wood-dark', 'gf-interior', { bevel: 0.006 }));
      parts.push(box([x - 0.19, seat + 0.02, z - 0.19], [x + 0.19, seat + 0.075, z + 0.19], 'fabric', 'gf-interior', { bevel: 0.022 }));
      [-0.14, 0.14].forEach(dx => parts.push({
        kind: 'beam', from: [x + dx, seat + 0.02, z + 0.18], to: [x + dx, seat + 0.26, z + 0.205], width: 0.014, height: 0.014, mat: 'metal-dark', group: 'gf-interior' }));
      parts.push(box([x - 0.18, seat + 0.18, z + 0.19], [x + 0.18, seat + 0.29, z + 0.235], 'fabric', 'gf-interior', { bevel: 0.02 }));
    });

    // ---- staircase ------------------------------------------------------------------------
    // Honed Steel Grey treads and risers on a smooth monolithic body, a
    // Steel Grey stringer along the open side, a glass balustrade with a
    // timber handrail, step lights in the stone wall.
    for (let i = 0; i < STAIR.risers; i++) {
      const top = stairTop(i), zFront = stairFront(i), zBack = stairBack(i);
      const object = i < 3 ? 'staircase-steps' : 'staircase';
      parts.push(box([STAIR.x0, top - 0.05, zBack], [STAIR.x1, top, zFront + 0.03], 'steel-grey-honed', 'stair', { bevel: 0.006, object }));
      parts.push(box([STAIR.x0, top - RISE, zFront - 0.02], [STAIR.x1, top - 0.05, zFront], 'steel-grey-honed', 'stair', { object }));
      parts.push(box([STAIR.x0 + 0.02, FF1, zBack], [STAIR.x1 - 0.02, top - 0.05, zFront - 0.02], 'plaster', 'stair'));
      if (i % 2 === 1 && i !== STAIR.landingAfter && top < SLAB - 0.3) {
        const zc = (zFront + zBack) / 2;
        parts.push(box([-6.668, top + 0.18, zc - 0.12], [-6.655, top + 0.22, zc + 0.12], 'lamp', 'stair'));
      }
    }
    const L = STAIR.landingAfter, last = STAIR.risers - 1, xs = STAIR.x1 + 0.03;
    const flights = [
      [[stairFront(0) + STAIR.going + 0.03, FF1], [stairFront(L) + 0.03, stairTop(L)]],
      [[stairFront(L + 1) + STAIR.going + 0.03, stairTop(L)], [stairFront(last) + 0.03, stairTop(last)]],
    ];
    flights.forEach(([[z0, y0], [z1, y1]]) => {
      parts.push({ kind: 'beam', from: [xs, y0 - 0.12, z0], to: [xs, y1 - 0.12, z1], width: 0.06, height: 0.34, mat: 'steel-grey-honed', group: 'stair' });
      parts.push({ kind: 'beam', from: [xs + 0.005, y0 + 0.52, z0], to: [xs + 0.005, y1 + 0.52, z1], width: 0.015, height: 0.86, mat: 'glass', group: 'stair' });
      parts.push({ kind: 'beam', from: [xs + 0.005, y0 + 0.97, z0], to: [xs + 0.005, y1 + 0.97, z1], width: 0.05, height: 0.05, mat: 'wood', group: 'stair' });
    });
    const landTop = stairTop(L), landBack = stairBack(L), landFront = stairFront(L) + 0.03;
    parts.push(box([STAIR.x1, landTop - 0.3, landBack], [STAIR.x1 + 0.06, landTop + 0.02, landFront], 'steel-grey-honed', 'stair', { bevel: 0.006 }));
    parts.push(box([xs - 0.003, landTop + 0.09, landBack + 0.005], [xs + 0.012, landTop + 0.95, landFront - 0.005], 'glass', 'stair'));
    parts.push(box([xs - 0.02, landTop + 0.945, landBack], [xs + 0.03, landTop + 0.995, landFront], 'wood', 'stair'));
    // The stone wall the stair climbs along.
    clad(parts, {
      plane: 'x', at: -6.7, normal: 1, depth: 0.036, a: [STAIR_END, 4.7], b: [FF1 + 0.02, SLAB], origin: [STAIR_END, FF1 + 0.02],
      module: [1.5, 0.75], stagger: 0.5, gap: 0.005, chamfer: 0.005, mat: 'limestone', group: 'gf-interior', object: 'staircase-wall',
    });

    // ---- slabs ---------------------------------------------------------------------------------
    // Upper floor slab with the stair void; the terrace roof over the east wing.
    [
      [[UF.x0, SLAB, 3.4], [UF.x1, FF2, UF.z1]],
      [[UF.x0, SLAB, UF.z0], [UF.x1, FF2, STAIR_END]],
      [[UF.x0, SLAB, STAIR_END], [-6.664, FF2, 3.4]],   // the void's edge is flush with the stair wall's stone face
      [[-3.5, SLAB, STAIR_END], [UF.x1, FF2, 3.4]],
    ].forEach(([min, max]) => parts.push(box(min, max, 'graphite', 'uf-floor')));
    // Stone belt round the slab edge, a timber soffit with downlights under
    // the cantilever and in the entrance niche.
    // The belt is a stone fascia round the slab edge that drops 3 cm below
    // the soffit as a drip edge (its underside never shares the slab's).
    const belt = { bevel: 0.01 }, beltLow = SLAB - 0.03;
    // It stays within the upper walls' thickness (bw), so it never shows
    // inside the rooms; the timber soffit runs up to it.
    const bw = 0.2;
    parts.push(box([UF.x0 - 0.04, beltLow, UF.z0 - 0.04], [UF.x0 + bw, FF2 + 0.06, UF.z1 + 0.04], 'limestone-light', 'uf-floor', belt));
    parts.push(box([UF.x0 + bw, beltLow, UF.z1 - bw], [UF.x1 + 0.04, FF2 + 0.06, UF.z1 + 0.04], 'limestone-light', 'uf-floor', belt));
    parts.push(box([UF.x0 + bw, beltLow, UF.z0 - 0.04], [UF.x1 + 0.04, FF2 + 0.06, UF.z0 + bw], 'limestone-light', 'uf-floor', belt));
    parts.push(box([UF.x1 - bw, beltLow, GF.z1], [UF.x1 + 0.04, FF2 + 0.06, UF.z1 - bw], 'limestone-light', 'uf-floor', belt));
    parts.push(box([UF.x0 + bw, SLAB - 0.025, GF.z1], [UF.x1 - bw, SLAB, UF.z1 - bw], 'wood', 'uf-floor'));
    parts.push(box([UF.x0 + bw, SLAB - 0.025, UF.z0 + bw], [GF.x0, SLAB, GF.z1], 'wood', 'uf-floor'));
    parts.push(box([-3.2, SLAB - 0.025, 3.0], [-0.4, SLAB, GF.z1], 'wood', 'uf-floor'));
    const downlight = (x, z) => parts.push(box([x - 0.07, SLAB - 0.03, z - 0.07], [x + 0.07, SLAB - 0.024, z + 0.07], 'lamp', 'uf-floor'));
    [-7.4, -5.9, -4.4, 0.6, 2.1].forEach(x => downlight(x, 5.65));
    [3.55, 4.4].forEach(z => downlight(-1.8, z));
    [-3.5, -1.0, 1.5, 4.0].forEach(z => downlight(-7.75, z));

    // GF roof terrace: stone paving, a stone coping, a glass railing.
    parts.push(box([UF.x1, SLAB, GF.z0], [GF.x1, FF2, GF.z1], 'graphite', 'gf-roof'));
    clad(parts, {
      plane: 'y', at: FF2, normal: 1, depth: 0.02, a: [UF.x1, GF.x1 - 0.1], b: [GF.z0 + 0.1, GF.z1 - 0.1], module: [1.0, 1.0],
      gap: 0.005, chamfer: 0.004, mat: 'paving', group: 'gf-roof', bed: false,
    });
    parts.push(box([GF.x1 - 0.1, SLAB, GF.z0 - 0.06], [GF.x1 + 0.06, FF2 + 0.1, GF.z1 + 0.06], 'limestone-light', 'gf-roof', belt));
    parts.push(box([UF.x1, SLAB, GF.z1 - 0.1], [GF.x1 - 0.1, FF2 + 0.1, GF.z1 + 0.06], 'limestone-light', 'gf-roof', belt));
    parts.push(box([UF.x1, SLAB, GF.z0 - 0.06], [GF.x1 - 0.1, FF2 + 0.1, GF.z0 + 0.1], 'limestone-light', 'gf-roof', belt));
    // Balustrade on every open edge of the terrace (south, east, north; the
    // west edge is the upper floor's wall): frameless smoky glass panels in
    // a slim dark metal shoe that sits on the stone coping, a thin dark top
    // rail, no posts. Centred on the coping, so it never overhangs the facade.
    const rail = { c: 0.02, shoe: FF2 + 0.1, top: FF2 + 1.12 };
    const zs = GF.z1 - rail.c, zn = GF.z0 + rail.c, xe = GF.x1 - rail.c;
    const railRun = (axis, at, u0, u1, capEnds) => {
      const B = (a0, a1, y0, y1, half) => (axis === 'x'
        ? [[a0, y0, at - half], [a1, y1, at + half]]
        : [[at - half, y0, a0], [at + half, y1, a1]]);
      const push = (spec, mat) => parts.push(box(spec[0], spec[1], mat, 'gf-roof'));
      const e0 = capEnds[0], e1 = capEnds[1];
      push(B(u0 + e0 * 0.035, u1 + e1 * 0.035, rail.shoe, rail.shoe + 0.1, 0.035), 'metal-dark');
      push(B(u0 + e0 * 0.0225, u1 + e1 * 0.0225, rail.top - 0.04, rail.top, 0.0225), 'metal-dark');
      // Glass stops just short of the neighbouring run's glass at a corner.
      const g0 = u0 + (e0 ? 0.012 : 0), g1 = u1 - (e1 ? 0.012 : 0);
      const n = Math.max(1, Math.ceil((g1 - g0) / 1.6)), gap = 0.012, w = (g1 - g0 - gap * (n - 1)) / n;
      for (let k = 0; k < n; k++) {
        const a = g0 + k * (w + gap);
        push(B(a, a + w, rail.shoe + 0.04, rail.top - 0.04, 0.008), 'glass-smoke');
      }
    };
    // South and north runs own the corners (their shoe and rail run past
    // the east run's centre line); the east run stops between them.
    railRun('x', zs, UF.x1, xe, [0, 1]);
    railRun('x', zn, UF.x1, xe, [0, 1]);
    railRun('z', xe, zn, zs, [1, -1]);

    // ---- upper floor: cantilevered stone volume --------------------------------------------
    // Large limestone panels in stack bond, deep limestone window surrounds
    // with near-black stone sills, a stone cornice.
    const ufClad = { module: [0.8, 1.6], gap: 0.008, chamfer: 0.006 };
    const ufLayers = [{ t: 0.06, mat: 'limestone', clad: ufClad }, { t: 0.2, mat: 'plaster' }];
    const ufFrame = { width: 0.2, depth: 0.36, mat: 'limestone-light' };
    const w1 = { u0: -7.6, u1: -4.4, v0: 4.6, v1: 6.4, glass: true };
    const w2 = { u0: -3.0, u1: 2.6, v0: 4.6, v1: 6.4, glass: true };
    const ufSouth = { axis: 'z', outer: UF.z1, inward: -1, u: [UF.x0, UF.x1], v: [FF2, TOP], group: 'uf-south', layers: ufLayers, cap: true, openings: [w1, w2], cladTrim: [0.06, 0.06], coreTrim: [0.26, 0.26] };
    wall(parts, ufSouth);
    [w1, w2].forEach(o => surround(parts, ufSouth, o, Object.assign({ sill: { h: 0.08, mat: 'steel-grey', object: 'exterior-sills' } }, ufFrame)));
    const bathWindow = { u0: -3.6, u1: -1.6, v0: 4.6, v1: 6.1, glass: true };
    const terraceDoor = { u0: 1.0, u1: 4.6, v0: FF2, v1: 6.45, glass: true };   // opens onto the terrace only
    const ufEast = { axis: 'x', outer: UF.x1, inward: -1, u: [UF.z0, UF.z1], v: [FF2, TOP], group: 'uf-east', layers: ufLayers, cap: true, openings: [bathWindow, terraceDoor], coreTrim: [0.06, 0.06] };
    wall(parts, ufEast);
    surround(parts, ufEast, bathWindow, Object.assign({ sill: { h: 0.08, mat: 'steel-grey' } }, ufFrame));
    surround(parts, ufEast, terraceDoor, ufFrame);
    wall(parts, { axis: 'z', outer: UF.z0, inward: 1, u: [UF.x0, UF.x1], v: [FF2, TOP], group: 'uf-north', layers: ufLayers, cap: true, cladTrim: [0.06, 0.06], coreTrim: [0.26, 0.26] });
    const westWindow = { u0: -1.0, u1: 3.0, v0: 4.4, v1: 6.4, glass: true };
    const ufWest = { axis: 'x', outer: UF.x0, inward: 1, u: [UF.z0, UF.z1], v: [FF2, TOP], group: 'uf-west', layers: ufLayers, cap: true, openings: [westWindow], coreTrim: [0.06, 0.06] };
    wall(parts, ufWest);
    surround(parts, ufWest, westWindow, Object.assign({ sill: { h: 0.08, mat: 'steel-grey' } }, ufFrame));

    // Roof: a flat slab inside a crisp stone cornice.
    parts.push(box([UF.x0 + 0.3, TOP, UF.z0 + 0.3], [UF.x1 - 0.3, TOP + 0.22, UF.z1 - 0.3], 'graphite', 'roof'));
    const cornice = { bevel: 0.012 };
    parts.push(box([UF.x0 - 0.18, TOP, UF.z1 - 0.3], [UF.x1 + 0.18, TOP + 0.34, UF.z1 + 0.18], 'limestone-light', 'roof', cornice));
    parts.push(box([UF.x0 - 0.18, TOP, UF.z0 - 0.18], [UF.x1 + 0.18, TOP + 0.34, UF.z0 + 0.3], 'limestone-light', 'roof', cornice));
    parts.push(box([UF.x0 - 0.18, TOP, UF.z0 + 0.3], [UF.x0 + 0.3, TOP + 0.34, UF.z1 - 0.3], 'limestone-light', 'roof', cornice));
    parts.push(box([UF.x1 - 0.3, TOP, UF.z0 + 0.3], [UF.x1 + 0.18, TOP + 0.34, UF.z1 - 0.3], 'limestone-light', 'roof', cornice));

    // ---- upper floor interior ----------------------------------------------------------------
    const ufIn = { x0: UF.x0 + 0.26, x1: UF.x1 - 0.26, z0: UF.z0 + 0.26, z1: UF.z1 - 0.26 };
    [
      [[ufIn.x0, ufIn.x1], [3.4, ufIn.z1]],
      [[ufIn.x0, -6.7], [STAIR_END, 3.4]],
      [[-3.5, ufIn.x1], [-0.87, 3.4]],
      [[-3.5, -1.07], [STAIR_END, -0.87]],
      [[ufIn.x0, -1.07], [ufIn.z0, STAIR_END]],
    ].forEach(([a, b]) => clad(parts, Object.assign({
      plane: 'y', at: FF2, normal: 1, depth: 0.02, a, b, origin: [ufIn.x0, ufIn.z0],
      mat: 'wood-floor', group: 'uf-interior', bed: false,
    }, BOARD)));
    // Glass guard round the stair void.
    parts.push(box([-3.52, FF2, STAIR_END], [-3.5, FF2 + 1.0, 3.4], 'glass', 'uf-interior'));
    parts.push(box([-6.7, FF2, 3.4], [-3.5, FF2 + 1.0, 3.42], 'glass', 'uf-interior'));
    parts.push(box([-3.53, FF2 + 1.0, STAIR_END], [-3.49, FF2 + 1.04, 3.43], 'metal', 'uf-interior'));
    parts.push(box([-6.7, FF2 + 1.0, 3.39], [-3.53, FF2 + 1.04, 3.43], 'metal', 'uf-interior'));

    // ---- bathroom (upper floor, north-east corner) -------------------------------------------
    const bx1 = ufIn.x1, bz0 = ufIn.z0;
    parts.push(box([-1.07, FF2, bz0], [-0.93, TOP, -0.8], 'plaster', 'uf-interior'));
    parts.push(box([-1.07, TOP, bz0], [-0.93, TOP + 0.012, -0.8], 'poche', 'uf-interior'));
    wall(parts, { axis: 'z', outer: -0.73, inward: -1, u: [-0.93, bx1], v: [FF2, TOP], group: 'bath-south', cap: true,
      layers: [{ t: 0.14, mat: 'plaster' }], openings: [{ u0: -0.5, u1: 0.5, v0: FF2, v1: 5.9 }] });
    // The floor in large Calacatta Nova slabs (3 x 3), cut from the same
    // two slabs as the wall; the veins all run one way.
    const C09 = 'calacatta-nova-P0585309', C10 = 'calacatta-nova-P0585310';
    const tile = (src, x, rotate) => ({ src, rotate: rotate || 0, offset: [x, 0.17] });
    clad(parts, {
      plane: 'y', at: FF2, normal: 1, depth: 0.02, a: [-0.93, bx1], b: [bz0, -0.87], module: [(bx1 + 0.93) / 3, (-0.87 - bz0) / 3],
      gap: 0.003, chamfer: 0.003, mat: 'calacatta-nova', group: 'uf-interior', object: 'bath-floor', bed: false,
      photos: [
        tile(C09, 0.01), tile(C10, 1.4, 180), tile(C09, 1.4),
        tile(C10, 0.01), tile(C09, 0.7), tile(C10, 0.01, 180),
        tile(C09, 1.4, 180), tile(C10, 1.4), tile(C09, 0.01, 180),
      ],
    });
    // Calacatta Nova on the vanity wall, the panels cut from two slabs of one
    // bundle (P0585309 / P0585310): neighbouring panels are neighbouring
    // pieces of the same slab, so the soft veins run on across the joints.
    const cw = (bx1 + 0.93) / 4 * 0.97;
    const panel = (src, x, rotate) => ({ src, rotate: rotate || 0, offset: [x, 0.02], scale: 0.97 });
    clad(parts, {
      plane: 'z', at: bz0, normal: 1, depth: 0.036, a: [-0.93, bx1], b: [FF2 + 0.02, TOP], module: [(bx1 + 0.93) / 4, (TOP - FF2 - 0.02) / 2],
      gap: 0.004, chamfer: 0.004, mat: 'calacatta-nova', group: 'uf-interior', object: 'bath-wall',
      photos: [
        panel(C09, 0.04), panel(C09, 0.04 + cw), panel(C10, 0.04), panel(C10, 0.04 + cw),
        panel(C10, 0.7 + cw, 180), panel(C10, 0.7, 180), panel(C09, 0.7 + cw, 180), panel(C09, 0.7, 180),
      ],
    });
    const wf = bz0 + 0.036;   // face of the stone wall
    // Floating vanity: a thick stone counter, two stone bowls, timber drawers.
    parts.push(box([0.3, 4.55, wf], [2.9, 4.61, -4.15], 'calacatta-nova', 'uf-interior', { bevel: 0.006, object: 'bath-counter', photo: { src: C10, plane: 'y', offset: [0.15, 0.9] } }));
    parts.push(box([0.4, 4.17, wf], [2.8, 4.55, -4.2], 'wood', 'uf-interior', { bevel: 0.006 }));
    [0.95, 2.25].forEach(x => {
      cyl(parts, [x, 4.61, -4.43], 0.15, 0.13, 'ceramic', 'uf-interior', { radiusTop: 0.21 });
      cyl(parts, [x, 4.742, -4.43], 0.18, 0.002, 'basin', 'uf-interior');
      parts.push({ kind: 'beam', from: [x, 4.88, wf], to: [x, 4.88, wf + 0.18], width: 0.022, height: 0.022, mat: 'metal', group: 'uf-interior' });
    });
    parts.push(box([0.4, 4.85, wf - 0.004], [2.8, 6.0, wf + 0.002], 'lamp', 'uf-interior'));
    parts.push(box([0.45, 4.9, wf + 0.002], [2.75, 5.95, wf + 0.014], 'mirror', 'uf-interior'));
    // Walk-in shower: a Calacatta Nova panel, a glass screen, a rain head.
    clad(parts, {
      plane: 'x', at: -0.93, normal: 1, depth: 0.036, a: [wf, -3.0], b: [FF2 + 0.02, 6.3], module: [(-3.0 - wf) / 2, (6.3 - FF2 - 0.02) / 2],
      gap: 0.004, chamfer: 0.004, mat: 'calacatta-nova', group: 'uf-interior',
    });
    parts.push(box([0.1, FF2 + 0.02, wf], [0.112, 6.0, -3.2], 'glass', 'uf-interior'));
    parts.push(box([0.094, 6.0, wf], [0.118, 6.03, -3.2], 'metal', 'uf-interior'));
    parts.push(box([-0.85, FF2 + 0.02, -3.12], [0.0, FF2 + 0.024, -3.06], 'metal-dark', 'uf-interior'));
    parts.push({ kind: 'beam', from: [-0.89, 6.45, -3.95], to: [-0.42, 6.45, -3.95], width: 0.02, height: 0.02, mat: 'metal', group: 'uf-interior' });
    cyl(parts, [-0.42, 6.42, -3.95], 0.14, 0.015, 'metal', 'uf-interior');
    // Stone sill in the east window, on the east wall cut at sill height
    // (the wall itself is hidden in the bathroom's cut-away view).
    parts.push(box([bx1 + 0.005, FF2, bz0], [UF.x1 - 0.005, 4.55, -0.87], 'plaster', 'uf-interior'));
    parts.push(box([3.36, 4.55, bz0], [UF.x1 - 0.005, 4.562, -0.87], 'poche', 'uf-interior'));
    parts.push(box([2.95, 4.55, -3.7], [3.36, 4.605, -1.5], 'calacatta-nova', 'uf-interior', { bevel: 0.005, object: 'bath-sill' }));

    return parts;
  }

  // Warm light sources the renderer adds as point lights.
  const LIGHTS = [
    { position: [-1.8, 3.0, 4.1], color: '#ffc68c', intensity: 9, distance: 7 },    // entrance niche
    { position: [5.6, 1.55, 0.85], color: '#ffcf9e', intensity: 3, distance: 5 },   // floor lamp
    { position: [3.8, 2.2, -3.6], color: '#ffd7aa', intensity: 3, distance: 5 },    // kitchen
    { position: [1.6, 5.8, -3.9], color: '#ffd7aa', intensity: 2.5, distance: 4.5 }, // bathroom mirror
  ];

  // Grid lines inside (lo, hi) at origin + k*step; lines that would leave a
  // sliver narrower than minPiece at either end are dropped (that piece
  // joins its neighbour, as a stone setter would cut it).
  function cuts(lo, hi, origin, step, minPiece) {
    const lines = [];
    for (let k = Math.ceil((lo - origin) / step - 1e-9); origin + k * step < hi - 1e-9; k++) {
      const x = origin + k * step;
      if (x > lo + 1e-9) lines.push(x);
    }
    while (lines.length && lines[0] - lo < minPiece) lines.shift();
    while (lines.length && hi - lines[lines.length - 1] < minPiece) lines.pop();
    return [lo].concat(lines, [hi]);
  }

  // The slabs of a cladding part as rectangles in its plane's (a, b) axes,
  // courses along b, running bond shifted by `stagger` of a module per course.
  function claddingSlabs(part) {
    const [a0, a1] = part.a, [b0, b1] = part.b;
    const [oa, ob] = part.origin, [ma, mb] = part.module;
    const bs = cuts(b0, b1, ob, mb, mb * 0.3);
    const slabs = [];
    for (let j = 0; j < bs.length - 1; j++) {
      const course = Math.floor(((bs[j] + bs[j + 1]) / 2 - ob) / mb + 1e-6);
      const shift = (((course * (part.stagger || 0)) % 1) + 1) % 1 * ma;
      const as = cuts(a0, a1, oa + shift, ma, ma * 0.3);
      for (let i = 0; i < as.length - 1; i++) slabs.push({ a0: as[i], a1: as[i + 1], b0: bs[j], b1: bs[j + 1] });
    }
    return slabs;
  }

  // Axis-aligned bounds of a part.
  function partBounds(part) {
    if (part.kind === 'box' || part.kind === 'slats') return { min: part.min, max: part.max };
    if (part.kind === 'beam') {
      const h = Math.max(part.width, part.height) / 2;
      return {
        min: [0, 1, 2].map(i => Math.min(part.from[i], part.to[i]) - h),
        max: [0, 1, 2].map(i => Math.max(part.from[i], part.to[i]) + h),
      };
    }
    if (part.kind === 'cladding') {
      const n0 = part.at, n1 = part.at + part.normal * part.depth;
      const lo = Math.min(n0, n1), hi = Math.max(n0, n1);
      const [a0, a1] = part.a, [b0, b1] = part.b;
      if (part.plane === 'z') return { min: [a0, b0, lo], max: [a1, b1, hi] };
      if (part.plane === 'x') return { min: [lo, b0, a0], max: [hi, b1, a1] };
      return { min: [a0, lo, b0], max: [a1, hi, b1] };
    }
    if (part.kind === 'cyl') {
      const r = Math.max(part.radius, part.radiusTop || 0), [x, y, z] = part.base;
      return { min: [x - r, y, z - r], max: [x + r, y + part.height, z + r] };
    }
    if (part.kind === 'tree') {
      const [x, , z] = part.position;
      return { min: [x - part.crown, 0, z - part.crown], max: [x + part.crown, part.trunk + part.crown * 1.8, z + part.crown] };
    }
    return null;
  }

  // Joint lines as world-space segments [x1,y1,z1,x2,y2,z2], lifted 3 mm
  // off the surface so they never z-fight with it.
  function jointSegments(part) {
    const segs = [];
    const [ma, mb] = part.module;
    const off = part.at + part.normal * 0.003;
    const P = (a, b) => (part.plane === 'z' ? [a, b, off] : part.plane === 'x' ? [off, b, a] : [a, off, b]);
    const [a0, a1] = part.a, [b0, b1] = part.b;
    let course = 0;
    for (let b = b0; b < b1 - 1e-6; b += mb, course++) {
      const top = Math.min(b + mb, b1);
      if (top < b1 - 1e-6) segs.push(P(a0, top).concat(P(a1, top)));
      const shift = part.stagger && course % 2 ? ma / 2 : 0;
      for (let a = a0 + shift + ma; a < a1 - 1e-6; a += ma) segs.push(P(a, b).concat(P(a, top)));
      if (shift > 0 && a0 + shift < a1) segs.push(P(a0 + shift, b).concat(P(a0 + shift, top)));
    }
    return segs;
  }

  return {
    buildHouse, partBounds, jointSegments, claddingSlabs, solidRects,
    LEVELS: { FF1, SLAB, FF2, TOP }, SITE: { PLOT, FENCE, PATH, GATE }, STAIR: Object.assign({ end: STAIR_END }, STAIR), LIGHTS,
  };
});
