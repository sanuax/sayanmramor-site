// js/showroom/house-model.js
//
// The showroom house as data: one two-storey modern house -- a stone-clad
// ground floor on a near-black plinth, a cantilevered timber upper floor,
// a deep entrance niche, large glazing, a terrace and a roof terrace. Pure
// geometry description (no Three.js), so the architecture is testable and
// the renderer (showroom-scene.js) only turns parts into meshes.
//
// Units: metres. Y up, grade at y = 0. The street side is +Z, east is +X.
// Part kinds:
//   box    { min:[x,y,z], max:[x,y,z] }
//   beam   { from:[x,y,z], to:[x,y,z], width, height }   (oriented box)
//   slats  { min, max, axis:'x'|'z' }                     (vertical timber slats)
//   joints { plane:'x'|'y'|'z', at, a:[a0,a1], b:[b0,b1], module:[ma,mb], stagger, normal:+1|-1 }
//   tree   { position:[x,0,z], trunk, crown }
// Every part has a material role `mat` and a visibility `group` (zones hide
// groups to cut the house open like a section model). Parts that ARE a
// showroom object carry `object: <id>` (see showroom-data.js).
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
  const STAIR = { x0: -6.6, x1: -5.3, zStart: 3.4, risers: 18, going: 0.28 };
  const RISE = (FF2 - FF1) / STAIR.risers;

  function box(min, max, mat, group, extra) {
    return Object.assign({ kind: 'box', min, max, mat, group }, extra || {});
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

  // A wall: normal along `axis` ('z' -> wall in the XY plane, 'x' -> YZ),
  // outer face at `outer`, interior toward `inward` (+1/-1). Layers from the
  // outside in. Openings with glass get a pane and a slim metal frame.
  function wall(parts, spec) {
    const { axis, outer, inward, u, v, openings = [], layers, group } = spec;
    const rects = solidRects(u[0], u[1], v[0], v[1], openings);
    const toBox = (r, n0, n1) => (axis === 'z'
      ? [[r.u0, r.v0, Math.min(n0, n1)], [r.u1, r.v1, Math.max(n0, n1)]]
      : [[Math.min(n0, n1), r.v0, r.u0], [Math.max(n0, n1), r.v1, r.u1]]);
    let depth = 0;
    layers.forEach(layer => {
      const n0 = outer + inward * depth, n1 = outer + inward * (depth + layer.t);
      rects.forEach(r => {
        const [min, max] = toBox(r, n0, n1);
        parts.push(box(min, max, layer.mat, group, spec.object && layer.object ? { object: spec.object } : null));
      });
      depth += layer.t;
    });
    // Section cut: where a wall's top is exposed in a cut-away view, it
    // reads as dark poché (like a drawn section), not a blank white edge.
    if (spec.cap) {
      rects.filter(r => r.v1 >= v[1] - 1e-6).forEach(r => {
        const [min, max] = toBox({ u0: r.u0, u1: r.u1, v0: v[1], v1: v[1] + 0.012 }, outer, outer + inward * depth);
        parts.push(box(min, max, 'poche', group));
      });
    }
    openings.filter(o => o.glass).forEach(o => {
      const mid = outer + inward * depth * 0.5;
      const [gMin, gMax] = toBox(o, mid - 0.012, mid + 0.012);
      parts.push(box(gMin, gMax, 'glass', group));
      const f = 0.05;
      const frame = [
        { u0: o.u0, u1: o.u1, v0: o.v0, v1: o.v0 + f }, { u0: o.u0, u1: o.u1, v0: o.v1 - f, v1: o.v1 },
        { u0: o.u0, u1: o.u0 + f, v0: o.v0, v1: o.v1 }, { u0: o.u1 - f, u1: o.u1, v0: o.v0, v1: o.v1 },
      ];
      // Mullions: at most ~1.6 m of glass between vertical frames.
      const panes = Math.max(1, Math.round((o.u1 - o.u0) / 1.6));
      for (let k = 1; k < panes; k++) {
        const uc = o.u0 + (o.u1 - o.u0) * (k / panes);
        frame.push({ u0: uc - f / 2, u1: uc + f / 2, v0: o.v0, v1: o.v1 });
      }
      frame.forEach(r => {
        const [min, max] = toBox(r, mid - 0.04, mid + 0.04);
        parts.push(box(min, max, 'metal', group));
      });
    });
    return rects;
  }

  function slatsOn(parts, rects, spec) {
    // Timber slats in front of the solid parts of a wall.
    const { axis, outer, outward, group } = spec;
    rects.forEach(r => {
      if (r.u1 - r.u0 < 0.1 || r.v1 - r.v0 < 0.1) return;
      const n0 = outer, n1 = outer + outward * 0.035;
      const min = axis === 'z' ? [r.u0, r.v0, Math.min(n0, n1)] : [Math.min(n0, n1), r.v0, r.u0];
      const max = axis === 'z' ? [r.u1, r.v1, Math.max(n0, n1)] : [Math.max(n0, n1), r.v1, r.u1];
      parts.push({ kind: 'slats', min, max, axis: axis === 'z' ? 'x' : 'z', pitch: 0.11, width: 0.05, mat: 'wood', group });
    });
  }

  function joints(parts, spec) {
    parts.push(Object.assign({ kind: 'joints', stagger: false, tone: 'dark' }, spec));
  }

  function stoneCourses(parts, rects, spec) {
    // Ashlar courses on the outer face of every solid stone rectangle.
    rects.forEach(r => joints(parts, {
      plane: spec.axis, at: spec.outer, normal: -spec.inward, a: [r.u0, r.u1], b: [r.v0, r.v1],
      module: [1.2, 0.6], stagger: true, group: spec.group, tone: 'dark',
    }));
  }

  function buildHouse() {
    const parts = [];

    // ---- site, plinth, terrace, entrance -------------------------------
    parts.push(box([GF.x0, 0, GF.z0], [GF.x1, FF1, GF.z1], 'basalt', 'site'));
    parts.push(box([1, 0, GF.z1], [8.5, FF1, 8], 'basalt', 'site'));
    parts.push(box([1, FF1, GF.z1], [8.5, FF1 + 0.02, 8], 'paving', 'site', { object: 'terrace-floor' }));
    joints(parts, { plane: 'y', at: FF1 + 0.02, normal: 1, a: [1, 8.5], b: [GF.z1, 8], module: [0.9, 0.9], group: 'site', tone: 'dark' });
    // Entrance steps: three monolithic blocks up to the niche.
    [[5.7, 6.05, 0.15], [5.35, 5.7, 0.3], [5.0, 5.35, FF1]].forEach(([z0, z1, top]) => {
      parts.push(box([-3.0, 0, z0], [-0.6, top, z1], 'limestone', 'site', { object: 'entrance-steps' }));
    });
    // Hard landscaping: a gravel forecourt the house stands on, a paved path
    // to the entrance, clipped hedges; the lawn (rendered by the scene)
    // starts beyond it.
    parts.push(box([-10.5, 0, -7.5], [11, 0.012, 10], 'gravel', 'site'));
    parts.push(box([-2.8, 0, 6.05], [-0.8, 0.025, 10], 'paving', 'site'));
    parts.push(box([-7, 0, 6.3], [-3.4, 0.7, 7.0], 'foliage', 'site'));
    parts.push(box([-9.6, 0, -4.5], [-9.0, 0.8, 4.5], 'foliage', 'site'));
    [[-13.5, 4, 1.1, 2.4], [-12, -9, 1.3, 2.8], [13, -8, 1.2, 2.6], [-7, 13.5, 1.0, 2.2], [15, 1.5, 1.1, 2.4], [16.5, 11, 1.0, 2.2]]
      .forEach(([x, z, crown, trunk]) => parts.push({ kind: 'tree', position: [x, 0, z], trunk, crown, mat: 'foliage', group: 'site' }));

    // ---- ground floor: stone skin + plaster core ------------------------
    const gfLayers = [{ t: 0.06, mat: 'limestone', object: true }, { t: 0.24, mat: 'plaster' }];
    const south = { axis: 'z', outer: GF.z1, inward: -1, u: [GF.x0, GF.x1], v: [FF1, SLAB], group: 'gf-south', layers: gfLayers, cap: true,
      openings: [
        { u0: -3.2, u1: -0.4, v0: FF1, v1: SLAB },                  // entrance niche
        { u0: 1.2, u1: 6.6, v0: FF1, v1: 3.2, glass: true },          // living room glazing
      ] };
    // The facade object is the stone skin west of the niche.
    const southWest = Object.assign({}, south, { u: [GF.x0, -3.2], openings: [], object: 'facade' });
    const southRest = Object.assign({}, south, { u: [-3.2, GF.x1] });
    stoneCourses(parts, wall(parts, southWest), southWest);
    stoneCourses(parts, wall(parts, southRest), southRest);

    const niche = [
      { axis: 'x', outer: -3.2, inward: -1, u: [3.0, GF.z1], v: [FF1, SLAB], group: 'gf-south', layers: [{ t: 0.3, mat: 'limestone' }] },
      { axis: 'x', outer: -0.4, inward: 1, u: [3.0, GF.z1], v: [FF1, SLAB], group: 'gf-south', layers: [{ t: 0.3, mat: 'limestone' }] },
    ];
    niche.forEach(spec => wall(parts, spec));
    // Door wall at the back of the niche, with a tall timber door.
    wall(parts, { axis: 'z', outer: 3.0, inward: -1, u: [-3.2, -0.4], v: [FF1, SLAB], group: 'gf-south',
      layers: [{ t: 0.3, mat: 'limestone' }], openings: [{ u0: -2.35, u1: -1.25, v0: FF1, v1: 2.95 }] });
    parts.push(box([-2.35, FF1, 2.82], [-1.25, 2.95, 2.88], 'wood-dark', 'gf-south'));

    const west = { axis: 'x', outer: GF.x0, inward: 1, u: [GF.z0, GF.z1], v: [FF1, SLAB], group: 'gf-west', layers: gfLayers, cap: true,
      openings: [{ u0: -3.8, u1: -1.2, v0: 0.9, v1: 3.2, glass: true }] };
    stoneCourses(parts, wall(parts, west), west);
    const north = { axis: 'z', outer: GF.z0, inward: 1, u: [GF.x0, GF.x1], v: [FF1, SLAB], group: 'gf-north', layers: gfLayers, cap: true,
      openings: [{ u0: 1.8, u1: 6.2, v0: 2.45, v1: 3.2, glass: true }] };
    stoneCourses(parts, wall(parts, north), north);
    const east = { axis: 'x', outer: GF.x1, inward: -1, u: [GF.z0, GF.z1], v: [FF1, SLAB], group: 'gf-east', layers: gfLayers, cap: true,
      openings: [{ u0: 0.6, u1: 4.4, v0: 1.3, v1: 3.2, glass: true }] };
    stoneCourses(parts, wall(parts, east), east);

    // Interior partitions.
    wall(parts, { axis: 'x', outer: 0.93, inward: 1, u: [-4.7, 4.7], v: [FF1, SLAB], group: 'gf-interior', cap: true,
      layers: [{ t: 0.14, mat: 'plaster' }], openings: [{ u0: -0.2, u1: 1.0, v0: FF1, v1: 2.6 }] });
    parts.push(box([-3.57, FF1, -4.7], [-3.43, SLAB, -2.2], 'plaster', 'gf-interior'));
    parts.push(box([-3.57, SLAB, -4.7], [-3.43, SLAB + 0.012, -2.2], 'poche', 'gf-interior'));

    // Floors.
    parts.push(box([-6.7, FF1, -4.7], [0.93, FF1 + 0.02, 2.7], 'travertine', 'gf-floors', { object: 'hall-floor' }));
    parts.push(box([-0.4, FF1, 2.7], [0.93, FF1 + 0.02, 4.7], 'travertine', 'gf-floors'));
    joints(parts, { plane: 'y', at: FF1 + 0.02, normal: 1, a: [-6.7, 0.93], b: [-4.7, 2.7], module: [1.2, 1.2], group: 'gf-floors', tone: 'dark' });
    parts.push(box([1.07, FF1, -4.7], [6.7, FF1 + 0.02, 4.7], 'limestone-light', 'gf-floors', { object: 'living-floor' }));
    joints(parts, { plane: 'y', at: FF1 + 0.02, normal: 1, a: [1.07, 6.7], b: [-4.7, 4.7], module: [1.2, 0.6], stagger: true, group: 'gf-floors', tone: 'dark' });

    // Hall: stone feature wall on the north wall.
    parts.push(box([-3.43, FF1 + 0.02, -4.7], [0.93, SLAB, -4.64], 'stone-graphite', 'gf-interior', { object: 'hall-wall' }));
    joints(parts, { plane: 'z', at: -4.64, normal: 1, a: [-3.43, 0.93], b: [FF1 + 0.02, SLAB], module: [1.09, 1.49], group: 'gf-interior', tone: 'light' });
    parts.push(box([-2.6, 0.78, -4.5], [0.0, 0.86, -4.1], 'wood', 'gf-interior'));
    [-2.45, -0.15].forEach(x => parts.push(box([x - 0.03, FF1 + 0.02, -4.46], [x + 0.03, 0.78, -4.14], 'metal', 'gf-interior')));

    // Living room.
    parts.push(box([1.07, 1.0, 1.4], [1.12, 2.8, 3.8], 'onyx', 'gf-interior', { object: 'living-panno' }));
    parts.push(box([1.07, FF1 + 0.02, 1.1], [1.5, 0.85, 4.1], 'wood', 'gf-interior'));
    parts.push(box([4.3, FF1 + 0.02, 1.1], [5.3, 0.9, 4.1], 'fabric', 'gf-interior'));
    parts.push(box([5.1, 0.9, 1.1], [5.35, 1.3, 4.1], 'fabric', 'gf-interior'));
    parts.push(box([6.36, 1.26, 0.55], [6.72, 1.31, 4.45], 'marble-light', 'gf-interior', { object: 'living-sill' }));

    // Kitchen.
    parts.push(box([1.6, FF1 + 0.02, -4.7], [6.4, 1.31, -4.1], 'cabinet', 'gf-interior'));
    parts.push(box([1.55, 1.31, -4.7], [6.45, 1.35, -4.05], 'granite-black', 'gf-interior', { object: 'kitchen-counter' }));
    parts.push(box([2.3, 1.35, -4.55], [3.1, 1.353, -4.2], 'metal-dark', 'gf-interior'));
    parts.push(box([2.66, 1.35, -4.66], [2.74, 1.62, -4.6], 'metal', 'gf-interior'));
    parts.push(box([4.6, 1.35, -4.62], [5.4, 1.356, -4.14], 'glass-black', 'gf-interior'));
    parts.push(box([1.55, 1.35, -4.7], [6.45, 2.3, -4.66], 'granite-black', 'gf-interior', { object: 'kitchen-backsplash' }));
    parts.push(box([2.4, FF1 + 0.02, -3.1], [5.4, 1.31, -2.2], 'wood', 'gf-interior'));
    parts.push(box([2.35, 1.31, -3.15], [5.45, 1.35, -2.15], 'marble-light', 'gf-interior', { object: 'kitchen-island' }));
    parts.push(box([2.35, 1.51, -2.15], [5.45, 1.55, -1.7], 'marble-light', 'gf-interior', { object: 'kitchen-bar' }));
    parts.push(box([2.35, 1.35, -2.2], [5.45, 1.51, -2.15], 'marble-light', 'gf-interior', { object: 'kitchen-bar' }));
    parts.push(box([2.35, FF1 + 0.02, -2.15], [2.39, 1.51, -1.7], 'marble-light', 'gf-interior', { object: 'kitchen-bar' }));
    parts.push(box([5.41, FF1 + 0.02, -2.15], [5.45, 1.51, -1.7], 'marble-light', 'gf-interior', { object: 'kitchen-bar' }));
    [3.1, 3.9, 4.7].forEach(x => {
      parts.push(box([x - 0.2, 1.02, -1.55], [x + 0.2, 1.07, -1.15], 'wood-dark', 'gf-interior'));
      parts.push(box([x - 0.03, FF1 + 0.02, -1.38], [x + 0.03, 1.02, -1.32], 'metal', 'gf-interior'));
    });

    // Staircase: stone treads and risers on a concrete body, a stone-clad
    // wall behind it, a glass balustrade with a metal handrail.
    for (let i = 0; i < STAIR.risers; i++) {
      const top = FF1 + (i + 1) * RISE;
      const zFront = STAIR.zStart - i * STAIR.going;
      const zBack = i === STAIR.risers - 1 ? -1.9 : zFront - STAIR.going;
      const object = i < 3 ? 'staircase-steps' : 'staircase';
      parts.push(box([STAIR.x0, top - 0.04, zBack], [STAIR.x1, top, zFront + 0.03], 'travertine', 'stair', { object }));
      parts.push(box([STAIR.x0, FF1 + i * RISE, zFront - 0.02], [STAIR.x1, top - 0.04, zFront], 'travertine', 'stair', { object }));
      parts.push(box([STAIR.x0 + 0.02, FF1, zBack], [STAIR.x1 - 0.02, top - 0.04, zFront - 0.02], 'concrete', 'stair'));
    }
    const railLow = [STAIR.x1 + 0.02, FF1 + 0.1, STAIR.zStart];
    const railHigh = [STAIR.x1 + 0.02, FF2 + 0.1, STAIR.zStart - STAIR.risers * STAIR.going];
    parts.push({ kind: 'beam', from: [railLow[0], railLow[1] + 0.45, railLow[2]], to: [railHigh[0], railHigh[1] + 0.45, railHigh[2]], width: 0.015, height: 0.85, mat: 'glass', group: 'stair' });
    parts.push({ kind: 'beam', from: [railLow[0], railLow[1] + 0.9, railLow[2]], to: [railHigh[0], railHigh[1] + 0.9, railHigh[2]], width: 0.05, height: 0.05, mat: 'metal', group: 'stair' });
    const stairWallRects = solidRects(GF.z0 + 0.3, GF.z1 - 0.3, FF1 + 0.02, SLAB, [{ u0: -3.8, u1: -1.2, v0: 0.9, v1: 3.2 }]);
    stairWallRects.forEach(r => parts.push(box([-6.7, r.v0, r.u0], [-6.64, r.v1, r.u1], 'limestone', 'gf-interior', { object: 'staircase-wall' })));
    stairWallRects.forEach(r => joints(parts, { plane: 'x', at: -6.64, normal: 1, a: [r.u0, r.u1], b: [r.v0, r.v1], module: [1.2, 0.6], stagger: true, group: 'gf-interior', tone: 'dark' }));

    // ---- slabs --------------------------------------------------------------
    // Upper floor slab with the stair void; the terrace roof over the east wing.
    [
      [[UF.x0, SLAB, 3.4], [UF.x1, FF2, UF.z1]],
      [[UF.x0, SLAB, UF.z0], [UF.x1, FF2, -1.9]],
      [[UF.x0, SLAB, -1.9], [-6.7, FF2, 3.4]],
      [[-3.5, SLAB, -1.9], [UF.x1, FF2, 3.4]],
    ].forEach(([min, max]) => parts.push(box(min, max, 'graphite', 'uf-floor')));
    parts.push(box([UF.x1, SLAB, GF.z0], [GF.x1, FF2, GF.z1], 'graphite', 'gf-roof'));
    parts.push(box([UF.x1, FF2, GF.z0 + 0.1], [GF.x1 - 0.1, FF2 + 0.02, GF.z1 - 0.1], 'wood', 'gf-roof'));
    parts.push(box([UF.x1, FF2, GF.z1 - 0.12], [GF.x1, FF2 + 1.0, GF.z1 - 0.1], 'glass', 'gf-roof'));
    parts.push(box([GF.x1 - 0.12, FF2, GF.z0], [GF.x1 - 0.1, FF2 + 1.0, GF.z1], 'glass', 'gf-roof'));
    parts.push(box([UF.x1, FF2 + 1.0, GF.z1 - 0.13], [GF.x1, FF2 + 1.04, GF.z1 - 0.09], 'metal', 'gf-roof'));
    parts.push(box([GF.x1 - 0.13, FF2 + 1.0, GF.z0], [GF.x1 - 0.09, FF2 + 1.04, GF.z1], 'metal', 'gf-roof'));

    // ---- upper floor: cantilevered timber volume ---------------------------
    const ufLayers = [{ t: 0.04, mat: 'wood-dark' }, { t: 0.2, mat: 'plaster' }];
    const ufWalls = [
      { axis: 'z', outer: UF.z1, inward: -1, outward: 1, u: [UF.x0, UF.x1], v: [FF2, TOP], group: 'uf-south', layers: ufLayers, cap: true,
        openings: [{ u0: -7.6, u1: -4.4, v0: 4.6, v1: 6.4, glass: true }, { u0: -3.0, u1: 2.6, v0: 4.6, v1: 6.4, glass: true }] },
      { axis: 'x', outer: UF.x1, inward: -1, outward: 1, u: [UF.z0, UF.z1], v: [FF2, TOP], group: 'uf-east', layers: ufLayers, cap: true,
        openings: [{ u0: -3.6, u1: -1.6, v0: 4.6, v1: 6.1, glass: true }, { u0: 1.0, u1: 5.8, v0: FF2, v1: 6.45, glass: true }] },
      { axis: 'z', outer: UF.z0, inward: 1, outward: -1, u: [UF.x0, UF.x1], v: [FF2, TOP], group: 'uf-north', layers: ufLayers, cap: true, openings: [] },
      { axis: 'x', outer: UF.x0, inward: 1, outward: -1, u: [UF.z0, UF.z1], v: [FF2, TOP], group: 'uf-west', layers: ufLayers, cap: true,
        openings: [{ u0: -1.0, u1: 3.0, v0: 4.4, v1: 6.4, glass: true }] },
    ];
    ufWalls.forEach(spec => slatsOn(parts, wall(parts, spec), spec));
    // Stone sills under the street-side windows.
    [[-7.6, -4.4], [-3.0, 2.6]].forEach(([u0, u1]) => {
      parts.push(box([u0 - 0.08, 4.52, UF.z1 - 0.08], [u1 + 0.08, 4.6, UF.z1 + 0.14], 'granite-black', 'uf-south', { object: 'exterior-sills' }));
    });
    parts.push(box([UF.x0 - 0.3, TOP, UF.z0 - 0.3], [UF.x1 + 0.3, TOP + 0.3, UF.z1 + 0.3], 'graphite', 'roof'));

    // Bathroom (upper floor, north-east corner).
    parts.push(box([-1.07, FF2, -4.8], [-0.93, TOP, -0.8], 'plaster', 'uf-interior'));
    parts.push(box([-1.07, TOP, -4.8], [-0.93, TOP + 0.012, -0.8], 'poche', 'uf-interior'));
    wall(parts, { axis: 'z', outer: -0.73, inward: -1, u: [-1.0, UF.x1 - 0.24], v: [FF2, TOP], group: 'bath-south', cap: true,
      layers: [{ t: 0.14, mat: 'plaster' }], openings: [{ u0: -0.5, u1: 0.5, v0: FF2, v1: 5.9 }] });
    parts.push(box([-0.93, FF2, -4.76], [UF.x1 - 0.24, FF2 + 0.02, -0.87], 'travertine', 'uf-interior', { object: 'bath-floor' }));
    joints(parts, { plane: 'y', at: FF2 + 0.02, normal: 1, a: [-0.93, UF.x1 - 0.24], b: [-4.76, -0.87], module: [0.9, 0.9], group: 'uf-interior', tone: 'dark' });
    parts.push(box([-0.93, FF2 + 0.02, -4.76], [UF.x1 - 0.24, TOP, -4.7], 'marble-warm', 'uf-interior', { object: 'bath-wall' }));
    joints(parts, { plane: 'z', at: -4.7, normal: 1, a: [-0.93, UF.x1 - 0.24], b: [FF2 + 0.02, TOP], module: [1.03, 1.6], group: 'uf-interior', tone: 'dark' });
    parts.push(box([-0.3, 4.15, -4.7], [2.7, 4.55, -4.18], 'wood', 'uf-interior'));
    parts.push(box([-0.35, 4.55, -4.7], [2.75, 4.61, -4.12], 'marble-light', 'uf-interior', { object: 'bath-counter' }));
    [[0.15, 0.75], [1.65, 2.25]].forEach(([x0, x1]) => {
      parts.push(box([x0, 4.61, -4.55], [x1, 4.613, -4.22], 'basin', 'uf-interior'));
      parts.push(box([(x0 + x1) / 2 - 0.02, 4.61, -4.68], [(x0 + x1) / 2 + 0.02, 4.82, -4.64], 'metal', 'uf-interior'));
    });
    parts.push(box([-0.1, 4.9, -4.7], [2.5, 6.1, -4.67], 'mirror', 'uf-interior'));
    parts.push(box([1.6, FF2 + 0.02, -2.9], [3.0, 4.35, -1.2], 'ceramic', 'uf-interior'));
    parts.push(box([2.95, 4.56, -3.68], [3.27, 4.61, -1.52], 'marble-warm', 'uf-interior', { object: 'bath-sill' }));
    // Upper floor timber floor (outside the bathroom and the stair void).
    parts.push(box([UF.x0 + 0.24, FF2, 3.4], [UF.x1 - 0.24, FF2 + 0.02, UF.z1 - 0.24], 'wood', 'uf-interior'));

    return parts;
  }

  // Axis-aligned bounds of a part (boxes, slats; beams by their endpoints).
  function partBounds(part) {
    if (part.kind === 'box' || part.kind === 'slats') return { min: part.min, max: part.max };
    if (part.kind === 'beam') {
      const h = Math.max(part.width, part.height) / 2;
      return {
        min: [0, 1, 2].map(i => Math.min(part.from[i], part.to[i]) - h),
        max: [0, 1, 2].map(i => Math.max(part.from[i], part.to[i]) + h),
      };
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

  return { buildHouse, partBounds, jointSegments, solidRects, LEVELS: { FF1, SLAB, FF2, TOP } };
});
