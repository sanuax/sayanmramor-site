// tests/showroom.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Data = require('../js/showroom/showroom-data.js');
const State = require('../js/showroom/showroom-state.js');
const House = require('../js/showroom/house-model.js');

const parts = House.buildHouse();
const GF_ZONES = ['hall', 'living', 'kitchen', 'staircase'];

function inside(point, bounds, pad) {
  return [0, 1, 2].every(i => point[i] >= bounds.min[i] - pad && point[i] <= bounds.max[i] + pad);
}

// ---- products / URL contract ------------------------------------------------

// The configurator's 10 public product keys -- part of the URL contract, so
// they are pinned here rather than read from the calculator's code.
test('the showroom covers exactly the 10 product directions, with the configurator\'s public product keys', () => {
  const expected = ['lestnitsa', 'panno', 'podokonnik', 'pol', 'stena', 'fasad', 'stoleshnitsa_vannaya', 'stoleshnitsa_kuhnya', 'stupeni', 'kaminy'];
  assert.deepEqual(Data.PRODUCT_KEYS, expected);
});

test('every product has at least one object in the house and exactly one primary object', () => {
  Data.PRODUCTS.forEach(p => {
    const objects = Data.OBJECTS.filter(o => o.productKey === p.key);
    assert.ok(objects.length >= 1, p.key);
    assert.equal(objects.filter(o => o.primary).length, 1, p.key + ' primary');
    assert.equal(Data.primaryObjectFor(p.key).productKey, p.key);
  });
});

test('every product links to its existing category page', () => {
  Data.PRODUCTS.forEach(p => {
    const file = path.join(__dirname, '..', p.categoryHref.replace('/sayanmramor-site/', ''));
    assert.ok(fs.existsSync(file), p.categoryHref);
  });
});

test('buildConfiguratorUrl produces the unchanged site -> configurator contract', () => {
  assert.equal(Data.CONFIGURATOR_PATH, '/calculator/sayanmramor-calculator.html');
  assert.equal(Data.buildConfiguratorUrl('stoleshnitsa_kuhnya'), '/calculator/sayanmramor-calculator.html?product=stoleshnitsa_kuhnya');
  assert.equal(Data.buildConfiguratorUrl('stupeni', 'delicato-brown'), '/calculator/sayanmramor-calculator.html?product=stupeni&stone=delicato-brown');
  assert.equal(Data.buildConfiguratorUrl('pol', 'a b&c'), '/calculator/sayanmramor-calculator.html?product=pol&stone=a%20b%26c');
  Data.PRODUCT_KEYS.forEach(k => assert.equal(new URL(Data.buildConfiguratorUrl(k), 'http://x').searchParams.get('product'), k));
});

test('buildConfiguratorUrl refuses an unknown product key instead of sending the client to a default', () => {
  assert.throws(() => Data.buildConfiguratorUrl('kitchen'), /Unknown product key/);
});

// ---- objects on real geometry -------------------------------------------------

test('every showroom object is real geometry in the house, and its marker anchor sits on that geometry', () => {
  Data.OBJECTS.forEach(o => {
    const own = parts.filter(p => p.object === o.id);
    assert.ok(own.length > 0, o.id + ' has no parts in the house model');
    assert.ok(own.some(p => inside(o.anchor, House.partBounds(p), 0.1)), o.id + ' anchor is not on its object');
  });
});

test('every tagged part in the house belongs to a declared showroom object', () => {
  const ids = new Set(Data.OBJECTS.map(o => o.id));
  parts.filter(p => p.object).forEach(p => assert.ok(ids.has(p.object), p.object));
});

test('an object is never cut away in its own zone (the client can always see what the marker points at)', () => {
  Data.OBJECTS.forEach(o => {
    const hidden = Data.zoneById(o.zone).hide;
    parts.filter(p => p.object === o.id).forEach(p => assert.ok(!hidden.includes(p.group), o.id + ' is hidden in ' + o.zone));
  });
});

test('zones only hide groups that exist in the house model', () => {
  const groups = new Set(parts.map(p => p.group));
  Data.ZONES.forEach(z => z.hide.forEach(g => assert.ok(groups.has(g), z.id + ': ' + g)));
});

test('ground-floor interiors hide EVERYTHING of the upper floor (nothing floats above the cut)', () => {
  GF_ZONES.forEach(zoneId => {
    const hidden = Data.zoneById(zoneId).hide;
    parts.filter(p => p.kind === 'box' && !hidden.includes(p.group) && p.group !== 'site' && p.group !== 'stair')
      .forEach(p => assert.ok(p.min[1] < House.LEVELS.FF2 - 0.01, zoneId + ': ' + p.group + ' ' + p.mat + ' starts at ' + p.min[1]));
  });
});

test('no arrival or object camera starts inside a visible solid (no clipping into walls)', () => {
  const solids = zoneId => {
    const hidden = Data.zoneById(zoneId).hide;
    return parts.filter(p => p.kind === 'box' && !hidden.includes(p.group) && p.mat !== 'glass');
  };
  Data.ZONES.forEach(z => solids(z.id).forEach(p => assert.ok(!inside(z.view.position, p, 0.05), z.id + ' camera inside ' + p.mat)));
  Data.OBJECTS.forEach(o => {
    const cam = Data.objectView(o).position;
    solids(o.zone).forEach(p => assert.ok(!inside(cam, p, 0.05), o.id + ' camera inside ' + p.mat));
  });
});

test('house parts are well-formed boxes/beams with a material and a group', () => {
  parts.forEach(p => {
    assert.ok(p.group, JSON.stringify(p).slice(0, 80));
    if (p.kind === 'joints') assert.ok(['dark', 'light'].includes(p.tone));
    else assert.ok(p.mat, JSON.stringify(p).slice(0, 80));
    if (p.kind === 'box' || p.kind === 'slats') [0, 1, 2].forEach(i => assert.ok(p.max[i] > p.min[i], 'degenerate ' + p.mat));
  });
});

test('the house reads as one building: two storeys, a cantilevered upper floor, a plinth, a terrace, a stair', () => {
  const upper = parts.filter(p => p.group === 'uf-south' && p.kind === 'box');
  const ground = parts.filter(p => p.group === 'gf-south' && p.kind === 'box');
  assert.ok(Math.max(...upper.map(p => p.max[2])) > Math.max(...ground.map(p => p.max[2])) + 1, 'upper floor overhangs the street facade');
  assert.ok(parts.some(p => p.kind === 'box' && p.mat === 'steel-grey' && p.max[1] === House.LEVELS.FF1), 'a Steel Grey plinth');
  assert.equal(parts.filter(p => p.group === 'stair' && p.kind === 'box' && /^staircase/.test(p.object || '')).length, 36, '18 treads + 18 risers');
});

const FACADE_GROUPS = ['gf-south', 'gf-west', 'gf-north', 'gf-east', 'uf-south', 'uf-east', 'uf-north', 'uf-west'];

test('the facades are stone: the upper floor is clad in stone slabs, no timber cladding anywhere outside', () => {
  ['uf-south', 'uf-east', 'uf-north', 'uf-west'].forEach(g => {
    assert.ok(parts.some(p => p.group === g && p.kind === 'cladding' && p.mat === 'limestone'), g + ' stone panels');
  });
  ['gf-west', 'gf-north', 'gf-east'].forEach(g => {
    assert.ok(parts.some(p => p.group === g && p.kind === 'cladding' && p.mat === 'limestone'), g + ' stone panels');
  });
  parts.filter(p => FACADE_GROUPS.includes(p.group) && p.kind !== 'joints').forEach(p => {
    assert.ok(p.kind !== 'slats', 'no timber slats on ' + p.group);
    // The only timber on a facade is the entrance door, deep inside the niche.
    if (p.mat === 'wood' || p.mat === 'wood-dark') assert.ok(p.group === 'gf-south' && p.max[2] < 3.0, p.group + ' ' + p.mat);
  });
});

test('facade depth: stone surrounds stand proud of the wall, sills project, the entrance niche is deep', () => {
  const south = parts.filter(p => p.group === 'uf-south' && p.kind === 'box');
  const sills = parts.filter(p => p.object === 'exterior-sills');
  assert.ok(south.some(p => p.mat === 'limestone-light' && p.max[2] >= 6.5 + 0.3), 'upper window surrounds project >= 30 cm');
  sills.forEach(p => assert.ok(p.max[2] > Math.max(...south.filter(q => q.mat === 'limestone-light').map(q => q.max[2])), 'the sill projects past its frame'));
  const niche = parts.filter(p => p.group === 'gf-south' && p.kind === 'cladding' && p.mat === 'limestone' &&
    ((p.plane === 'x' && (Math.abs(p.at + 3.2) < 0.06 || Math.abs(p.at + 0.4) < 0.06)) || (p.plane === 'z' && Math.abs(p.at - 3.0) < 0.06)));
  assert.ok(niche.length >= 3, 'the niche is lined with stone');
  assert.ok(5.0 - Math.min(...niche.map(p => House.partBounds(p).min[2])) >= 1.9, 'the niche is ~2 m deep');
});

test('stone cladding: slabs tile each surface exactly, in whole courses, with no slivers', () => {
  const clad = parts.filter(p => p.kind === 'cladding');
  assert.ok(clad.length > 50);
  clad.forEach(p => {
    const slabs = House.claddingSlabs(p);
    const area = (p.a[1] - p.a[0]) * (p.b[1] - p.b[0]);
    const sum = slabs.reduce((s, q) => s + (q.a1 - q.a0) * (q.b1 - q.b0), 0);
    assert.ok(Math.abs(sum - area) < 1e-6, p.mat + ' ' + p.group + ' tiles its surface');
    slabs.forEach(q => {
      assert.ok(q.a0 >= p.a[0] - 1e-9 && q.a1 <= p.a[1] + 1e-9 && q.b0 >= p.b[0] - 1e-9 && q.b1 <= p.b[1] + 1e-9);
      const fullA = p.a[1] - p.a[0] < p.module[0] * 0.3, fullB = p.b[1] - p.b[0] < p.module[1] * 0.3;
      assert.ok(fullA || q.a1 - q.a0 >= p.module[0] * 0.3 - 1e-9, 'no sliver along ' + p.mat);
      assert.ok(fullB || q.b1 - q.b0 >= p.module[1] * 0.3 - 1e-9, 'no sliver across ' + p.mat);
    });
    assert.ok(p.gap > 0 && p.gap < 0.2 && p.depth > 0, 'real joints and thickness');
  });
  // Running bond: the vertical joints of neighbouring courses do not line up.
  const facade = parts.find(p => p.object === 'facade' && p.kind === 'cladding');
  const slabs = House.claddingSlabs(facade);
  const joints = b0 => slabs.filter(q => q.b0 === b0 && q.a0 > facade.a[0]).map(q => q.a0);
  const courses = Array.from(new Set(slabs.map(q => q.b0))).sort((x, y) => x - y);
  assert.ok(joints(courses[0]).every(a => !joints(courses[1]).some(b => Math.abs(a - b) < 0.01)));
});

test('the plot is fenced: stone plinth, dark metal fins, stone pillars -- and no water anywhere', () => {
  const { FENCE, PATH, GATE } = House.SITE;
  assert.ok(!parts.some(p => p.mat === 'water'), 'no water');
  assert.ok(!parts.some(p => p.kind !== 'joints' && House.partBounds(p).max[1] < -0.01), 'nothing sunk below grade (no basin)');
  const house = parts.filter(p => p.kind === 'box' && p.group !== 'site');
  house.forEach(p => assert.ok(p.min[0] > FENCE.x0 && p.max[0] < FENCE.x1 && p.min[2] > FENCE.z0 && p.max[2] < FENCE.z1, p.group + ' inside the fence'));
  const near = (p, axis, at) => { const b = House.partBounds(p); const i = axis === 'x' ? 2 : 0; return b.min[i] <= at + 0.4 && b.max[i] >= at - 0.4; };
  const fence = parts.filter(p => p.group === 'site' && !['joints', 'cladding', 'tree'].includes(p.kind) &&
    [['x', FENCE.z0], ['x', FENCE.z1], ['z', FENCE.x0], ['z', FENCE.x1]].some(([axis, at]) => near(p, axis, at)) &&
    House.partBounds(p).min[1] >= -0.001 && House.partBounds(p).max[1] > 0.3 &&
    !(p.kind === 'box' && ['lawn', 'meadow'].includes(p.mat)));
  [['x', FENCE.z0], ['x', FENCE.z1], ['z', FENCE.x0], ['z', FENCE.x1]].forEach(([axis, at]) => {
    const side = fence.filter(p => near(p, axis, at));
    assert.ok(side.some(p => p.mat === 'limestone' && Math.abs(p.max[1] - FENCE.plinth) < 1e-9), 'a stone plinth on ' + axis + at);
    assert.ok(side.some(p => p.kind === 'slats' && p.mat === 'metal-dark'), 'metal fins on ' + axis + at);
    assert.ok(side.some(p => p.mat === 'limestone' && p.max[1] > FENCE.height), 'stone pillars on ' + axis + at);
  });
  [[FENCE.x0, FENCE.z0], [FENCE.x1, FENCE.z0], [FENCE.x0, FENCE.z1], [FENCE.x1, FENCE.z1]].forEach(([x, z]) => {
    assert.ok(fence.some(p => p.kind === 'box' && p.max[1] > FENCE.height && p.min[0] <= x && p.max[0] >= x && p.min[2] <= z && p.max[2] >= z), 'corner pillar ' + x + ',' + z);
  });
  // It never hides the house: low, and see-through between the fins.
  fence.forEach(p => assert.ok(House.partBounds(p).max[1] <= 2.3, 'fence part ' + p.mat + ' is low'));
  assert.ok(FENCE.height < House.LEVELS.FF1 + 1.5, 'below the ground-floor window heads');
  parts.filter(p => p.kind === 'slats').forEach(p => assert.ok(p.pitch - p.width >= 0.08, 'open between the fins'));
  // The gate: nothing but a flush threshold across the path at the fence line.
  fence.filter(p => near(p, 'x', FENCE.z1)).forEach(p => {
    const b = House.partBounds(p);
    assert.ok(b.max[0] <= PATH.x0 - 0.15 || b.min[0] >= PATH.x1 + 0.15, p.mat + ' blocks the gate');
  });
  assert.ok(GATE.x0 < PATH.x0 && GATE.x1 > PATH.x1, 'the gate is wider than the path');
  const path = parts.filter(p => p.kind === 'cladding' && p.plane === 'y' && p.a[0] === PATH.x0);
  assert.ok(path.some(p => p.b[0] <= 7.05) && path.some(p => p.b[1] > FENCE.z1), 'the path runs from the entrance out through the gate');
  assert.ok(parts.filter(p => p.kind === 'tree').length <= 12, 'a few large trees, not a forest');
});

test('the terrace on the ground-floor roof has a balustrade on every open edge, standing on its coping', () => {
  const { FF2 } = House.LEVELS;
  const roof = parts.filter(p => p.group === 'gf-roof' && p.kind === 'box');
  const edges = {
    south: p => p.min[2] > 4.8, north: p => p.max[2] < -4.8, east: p => p.min[0] > 6.8 && p.max[2] - p.min[2] > 1,
  };
  const coping = roof.filter(p => p.mat === 'limestone-light');
  Object.entries(edges).forEach(([name, on]) => {
    const glass = roof.filter(p => p.mat === 'glass-smoke' && on(p));
    const metal = roof.filter(p => p.mat === 'metal-dark' && on(p));
    assert.ok(glass.length >= 2, name + ': glass panels');
    const shoe = metal.find(p => Math.abs(p.min[1] - (FF2 + 0.1)) < 1e-9);
    const top = metal.find(p => p.max[1] > FF2 + 1.0);
    assert.ok(shoe && top, name + ': a shoe and a top rail');
    assert.ok(top.max[1] - (FF2 + 0.02) >= 1.05, name + ': at least 1.05 m above the terrace floor');
    // The shoe sits on the coping (not in the air, not over the facade).
    const along = shoe.max[0] - shoe.min[0] > shoe.max[2] - shoe.min[2] ? 0 : 2, across = 2 - along;
    const mid = (shoe.min[across] + shoe.max[across]) / 2;
    for (let t = shoe.min[along]; t <= shoe.max[along] + 1e-9; t += 0.02) {
      const pt = []; pt[along] = t; pt[across] = mid;
      assert.ok(coping.some(c => Math.abs(c.max[1] - shoe.min[1]) < 1e-9 && pt[0] >= c.min[0] - 1e-9 && pt[0] <= c.max[0] + 1e-9 && pt[2] >= c.min[2] - 1e-9 && pt[2] <= c.max[2] + 1e-9),
        name + ': stone coping under the shoe at ' + t.toFixed(2));
    }
    glass.forEach(g => assert.ok(g.min[1] >= shoe.min[1] && g.min[1] < shoe.max[1] && g.max[1] <= top.min[1] + 1e-9, name + ': glass held by shoe and rail'));
  });
  // South and north runs reach the upper floor's wall; the terrace door opens onto the terrace only.
  ['south', 'north'].forEach(name => {
    const shoe = roof.find(p => p.mat === 'metal-dark' && edges[name](p) && Math.abs(p.min[1] - (FF2 + 0.1)) < 1e-9);
    assert.ok(Math.abs(shoe.min[0] - 3.5) < 1e-9, name + ' run starts at the wall');
  });
  const door = parts.filter(p => p.group === 'uf-east' && p.mat === 'glass').find(p => p.max[1] > 6.4 && p.min[1] <= FF2 + 0.03);
  assert.ok(door.max[2] < 4.9, 'the terrace door ends inside the balustrade');
});

test('entrance: wide monolithic steps up to the floor level, even risers, a landing in front of the niche', () => {
  const steps = parts.filter(p => p.object === 'entrance-steps' && p.kind === 'box').sort((a, b) => b.max[1] - a.max[1]);
  assert.equal(steps.length, 3);
  steps.forEach(p => assert.ok(p.max[0] - p.min[0] >= 4.5, 'wider than the niche'));
  assert.ok(Math.abs(steps[0].max[1] - (House.LEVELS.FF1 + 0.02)) < 1e-9, 'the landing is at the floor level');
  const risers = [steps[0].max[1] - steps[1].max[1], steps[1].max[1] - steps[2].max[1], steps[2].max[1]];
  risers.forEach(r => assert.ok(r >= 0.14 && r <= 0.18, 'riser ' + r));
  assert.ok(steps[0].max[2] - steps[0].min[2] >= 1.2, 'a real landing');
});

test('the main stair has a landing, a stone stringer and a balustrade', () => {
  const { landingAfter, landing } = House.STAIR;
  const treads = parts.filter(p => p.group === 'stair' && /^staircase/.test(p.object || '') && p.max[1] - p.min[1] < 0.06).sort((a, b) => a.max[1] - b.max[1]);
  treads.forEach(p => assert.equal(p.mat, 'steel-grey-honed', 'a stone stair: Steel Grey treads'));
  assert.equal(treads.length, 18);
  assert.ok(treads[landingAfter].max[2] - treads[landingAfter].min[2] >= landing, 'the landing is a deep tread');
  assert.ok(parts.some(p => p.group === 'stair' && p.mat === 'steel-grey-honed' && p.kind === 'beam'), 'a stone stringer');
  assert.ok(parts.some(p => p.group === 'stair' && p.mat === 'glass'), 'a balustrade');
});

test('joint lines stay inside their surface and on the requested module', () => {
  const segs = House.jointSegments({ plane: 'y', at: 0.5, normal: 1, a: [0, 2.4], b: [0, 1.2], module: [1.2, 0.6], stagger: false });
  // 2 courses x 2 modules: one course line between them + one vertical joint in each course.
  assert.equal(segs.length, 3);
  segs.forEach(s => { assert.ok(s[0] >= 0 && s[3] <= 2.4 && s[2] >= 0 && s[5] <= 1.2); assert.ok(Math.abs(s[1] - 0.503) < 1e-9); });
});

// ---- state: navigation, marker -> card -> configurator ------------------------------

test('starting state is outside; an unknown hash falls back to outside', () => {
  assert.equal(State.initialState(null).zone, 'exterior');
  assert.equal(State.initialState(State.zoneFromHash('#kitchen')).zone, 'kitchen');
  assert.equal(State.zoneFromHash('#nope'), null);
});

test('marker -> card: selecting an object opens its card, in its own zone, with the configurator CTA', () => {
  const s = State.reduce(State.initialState(), { type: 'selectObject', id: 'kitchen-island' });
  assert.equal(s.zone, 'kitchen');
  const d = State.describe(s);
  assert.equal(d.card.title, 'Кухонный остров');
  assert.equal(d.card.productLabel, 'Столешницы на кухню');
  assert.equal(d.card.ctaLabel, 'Создать изделие →');
  assert.equal(d.card.ctaHref, '/calculator/sayanmramor-calculator.html?product=stoleshnitsa_kuhnya');
  assert.equal(d.card.categoryHref, '/sayanmramor-site/categories/stoleshnitsy-kuhnya.html');
  assert.ok(d.markers.find(m => m.id === 'kitchen-island').selected);
  assert.deepEqual(d.cameraView, Data.objectView(Data.objectById('kitchen-island')));
});

test('card -> configurator for every object uses that object\'s real product key', () => {
  Data.OBJECTS.forEach(o => {
    const d = State.describe(State.reduce(State.initialState(), { type: 'selectObject', id: o.id }));
    assert.equal(d.card.ctaHref, Data.buildConfiguratorUrl(o.productKey));
  });
});

test('navigation: zones, back outside, close card, unknown actions change nothing', () => {
  let s = State.initialState();
  s = State.reduce(s, { type: 'goToZone', zone: 'bathroom' });
  assert.equal(s.zone, 'bathroom');
  assert.equal(State.describe(s).backVisible, true);
  assert.deepEqual(State.describe(s).markers.map(m => m.id), ['bath-counter', 'bath-wall', 'bath-floor', 'bath-sill']);
  s = State.reduce(s, { type: 'selectObject', id: 'bath-wall' });
  s = State.reduce(s, { type: 'closeCard' });
  assert.equal(s.selectedObjectId, null);
  assert.equal(s.zone, 'bathroom');
  s = State.reduce(s, { type: 'goOutside' });
  assert.equal(s.zone, 'exterior');
  assert.equal(State.describe(s).backVisible, false);
  assert.equal(State.reduce(s, { type: 'goToZone', zone: 'attic' }), s);
  assert.equal(State.reduce(s, { type: 'selectObject', id: 'nope' }), s);
  assert.equal(State.reduce(s, { type: 'whatever' }), s);
});

test('«Все изделия»: opening closes the card, choosing a product flies to its primary object and closes the panel', () => {
  let s = State.reduce(State.initialState(), { type: 'selectObject', id: 'facade' });
  s = State.reduce(s, { type: 'openPanel' });
  assert.equal(s.panelOpen, true);
  assert.equal(State.describe(s).card, null);
  s = State.reduce(s, { type: 'chooseProduct', productKey: 'stoleshnitsa_vannaya' });
  assert.deepEqual([s.zone, s.selectedObjectId, s.panelOpen], ['bathroom', 'bath-counter', false]);
  Data.PRODUCT_KEYS.forEach(k => {
    const d = State.describe(State.reduce(State.initialState(), { type: 'chooseProduct', productKey: k }));
    assert.equal(Data.objectById(d.card.objectId).productKey, k);
  });
});

test('"what can I make here" lists each product of the zone once', () => {
  const d = State.describe(State.reduce(State.initialState(), { type: 'goToZone', zone: 'kitchen' }));
  assert.deepEqual(d.productsHere.map(p => p.key), ['stoleshnitsa_kuhnya']);
  const ext = State.describe(State.initialState());
  assert.deepEqual(ext.productsHere.map(p => p.key), ['fasad', 'stupeni', 'podokonnik', 'pol']);
});

test('all 6 zones exist and every zone has something to create', () => {
  assert.deepEqual(Data.ZONES.map(z => z.id), ['exterior', 'hall', 'living', 'kitchen', 'staircase', 'bathroom']);
  Data.ZONES.forEach(z => assert.ok(Data.objectsInZone(z.id).length >= 2, z.id));
});

// ---- mobile / layout / fallback ------------------------------------------------------

test('layout mode: phones are compact (bottom sheets), tablets and desktops are wide', () => {
  [375, 390, 430, 767].forEach(w => assert.equal(State.layoutMode(w), 'compact', String(w)));
  [768, 1280, 1440, 1920].forEach(w => assert.equal(State.layoutMode(w), 'wide', String(w)));
});

test('view insets keep the house clear of the UI: caption on wide screens, sheets on phones', () => {
  assert.deepEqual(State.viewInsets('wide', { cardOpen: false, panelOpen: false }, { width: 1440, height: 900 }), { left: 350, right: 0, bottom: 0 });
  assert.equal(State.viewInsets('wide', { cardOpen: true, panelOpen: false }, { width: 1440, height: 900 }).right, 400);
  assert.equal(State.viewInsets('compact', { cardOpen: false, panelOpen: false }, { width: 390, height: 844 }).bottom, 203);
  assert.equal(State.viewInsets('compact', { cardOpen: true, panelOpen: false }, { width: 390, height: 844 }).bottom, 422);
});

test('portrait screens pull the camera back (capped), landscape keeps the composed view', () => {
  assert.equal(State.distanceScale(1.6, 38), 1);
  const phone = State.distanceScale(390 / 844, 48);
  assert.ok(phone > 1.3 && phone <= 2.2);
  assert.ok(State.distanceScale(0.3, 48) <= 2.2);
  const v = State.scaleView({ position: [10, 10, 10], target: [0, 0, 0] }, 2);
  assert.deepEqual(v.position, [20, 20, 20]);
});

test('WebGL detection: available, unavailable and throwing canvases', () => {
  const doc = ctx => ({ createElement: () => ({ getContext: ctx }) });
  assert.equal(State.canUseWebGL(doc(() => ({}))), true);
  assert.equal(State.canUseWebGL(doc(() => null)), false);
  assert.equal(State.canUseWebGL({ createElement: () => { throw new Error('no canvas'); } }), false);
});

test('the no-3D fallback in showroom.html links all 10 directions to the configurator contract', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'showroom.html'), 'utf8');
  const fallback = html.slice(html.indexOf('id="srFallback"'), html.indexOf('</section>', html.indexOf('id="srFallback"')));
  Data.PRODUCTS.forEach(p => {
    assert.ok(fallback.includes('href="' + Data.buildConfiguratorUrl(p.key) + '"'), p.key);
    assert.ok(fallback.includes('href="' + p.categoryHref + '"'), p.categoryHref);
  });
  assert.ok(html.includes('<noscript>'));
});

test('every site page links to the showroom from its main navigation', () => {
  const root = path.join(__dirname, '..');
  const pages = ['index.html', 'katalog.html'].concat(fs.readdirSync(path.join(root, 'categories')).map(f => 'categories/' + f));
  pages.forEach(page => {
    const html = fs.readFileSync(path.join(root, page), 'utf8');
    const nav = html.slice(html.indexOf('<nav class="site-nav">'), html.indexOf('</nav>'));
    assert.ok(nav.includes('href="/sayanmramor-site/showroom.html"'), page);
  });
});

// ---- entry from the configurator (?product=&stone=) ------------------------------

test('entry: every product key opens its main object -- its zone, camera on it, its card open', () => {
  Data.PRODUCT_KEYS.forEach(key => {
    const state = State.initialStateFromLocation('?product=' + key, '');
    const primary = Data.primaryObjectFor(key);
    assert.equal(state.selectedObjectId, primary.id, key);
    assert.equal(state.zone, primary.zone, key);
    const d = State.describe(state);
    assert.equal(d.card.objectId, primary.id);
    assert.deepEqual(d.cameraView, Data.objectView(primary), key + ': the camera frames the object, not the zone');
    assert.ok(d.markers.find(m => m.id === primary.id).selected);
  });
});

test('entry: the product lands on the honest object for it', () => {
  const at = key => State.initialStateFromLocation('?product=' + key, '').selectedObjectId;
  assert.equal(at('stoleshnitsa_kuhnya'), 'kitchen-counter');
  assert.equal(at('stoleshnitsa_vannaya'), 'bath-counter');
  assert.equal(at('lestnitsa'), 'staircase');
  assert.equal(at('stupeni'), 'entrance-steps');
  assert.equal(at('podokonnik'), 'living-sill');
  assert.equal(at('panno'), 'living-panno');
  assert.equal(at('pol'), 'living-floor');
  assert.equal(at('stena'), 'hall-wall');
  assert.equal(at('fasad'), 'facade');
});

test('entry: a valid stone is carried into every "Создать изделие" link, and survives moving around', () => {
  let state = State.initialStateFromLocation('?product=stoleshnitsa_kuhnya&stone=delicato-brown', '');
  assert.equal(state.stoneId, 'delicato-brown');
  assert.equal(State.describe(state).card.ctaHref, '/calculator/sayanmramor-calculator.html?product=stoleshnitsa_kuhnya&stone=delicato-brown');
  state = State.reduce(state, { type: 'goOutside' });
  state = State.reduce(state, { type: 'selectObject', id: 'staircase' });
  assert.equal(State.describe(state).card.ctaHref, '/calculator/sayanmramor-calculator.html?product=lestnitsa&stone=delicato-brown');
});

test('entry: no stone means none is invented; a malformed stone is dropped', () => {
  assert.equal(State.initialStateFromLocation('?product=pol', '').stoneId, null);
  ['', 'Delicato Brown', '../x', '<script>', 'a'.repeat(200), 'UPPER'].forEach(stone => {
    const state = State.initialStateFromLocation('?product=pol&stone=' + encodeURIComponent(stone), '');
    assert.equal(state.stoneId, null, stone);
    assert.equal(State.describe(state).card.ctaHref, '/calculator/sayanmramor-calculator.html?product=pol');
  });
});

test('entry: an unknown/empty product opens the showroom as usual; a #zone deep link still works', () => {
  ['', '?product=', '?product=unknown', '?product=garbage&stone=delicato-brown', '?product=__proto__', '?foo=bar'].forEach(search => {
    const state = State.initialStateFromLocation(search, '');
    assert.equal(state.zone, 'exterior', search);
    assert.equal(state.selectedObjectId, null, search);
    assert.equal(State.describe(state).card, null, search);
  });
  assert.equal(State.initialStateFromLocation('', '#kitchen').zone, 'kitchen');
  assert.equal(State.initialStateFromLocation('?product=nope', '#bathroom').zone, 'bathroom');
  assert.equal(State.initialStateFromLocation('?product=lestnitsa', '#kitchen').zone, 'staircase', 'a valid product wins over the hash');
});

test('entry is only a starting point: the client can leave the object, the zone and go outside', () => {
  let state = State.initialStateFromLocation('?product=stoleshnitsa_vannaya&stone=delicato-brown', '');
  state = State.reduce(state, { type: 'closeCard' });
  assert.equal(state.selectedObjectId, null);
  state = State.reduce(state, { type: 'goToZone', zone: 'living' });
  assert.equal(state.zone, 'living');
  state = State.reduce(state, { type: 'goOutside' });
  assert.equal(state.zone, 'exterior');
  assert.equal(state.stoneId, 'delicato-brown');
});

test('locationFor: zone as #hash, the carried stone as ?stone, the product entry not repeated', () => {
  assert.equal(State.locationFor(Object.assign({}, State.INITIAL)), '');
  assert.equal(State.locationFor(Object.assign({}, State.INITIAL, { zone: 'kitchen' })), '#kitchen');
  assert.equal(State.locationFor(Object.assign({}, State.INITIAL, { zone: 'kitchen', stoneId: 'delicato-brown' })), '?stone=delicato-brown#kitchen');
  const back = State.initialStateFromLocation('?stone=delicato-brown', '#kitchen');
  assert.equal(back.zone, 'kitchen');
  assert.equal(back.stoneId, 'delicato-brown', 'a reload keeps the zone and the stone');
});

// ---- the stone palette ---------------------------------------------------------

const Photos = require('../js/showroom/stone-photos.js');
const STONE_FAMILY = {
  limestone: 'limestone', 'limestone-light': 'limestone', paving: 'limestone',
  'steel-grey': 'steel-grey', 'steel-grey-honed': 'steel-grey',
  'viscont-white': 'viscont-white', 'calacatta-nova': 'calacatta-nova', majestic: 'majestic',
};
const NOT_STONE = new Set(['graphite', 'poche', 'grout', 'plaster', 'soil', 'wood', 'wood-dark', 'wood-floor', 'cabinet', 'fabric', 'fabric-light', 'rug', 'shade',
  'metal', 'metal-dark', 'steel', 'hob-ring', 'glass', 'glass-smoke', 'glass-black', 'ceramic', 'basin', 'mirror', 'lamp', 'foliage', 'grass', 'lawn', 'meadow', 'gravel']);
const ofObject = id => parts.filter(p => p.object === id);

test('one house, one set of stones: our limestone, Steel Grey, Viscont White, Calacatta Nova, Majestic', () => {
  const families = new Set();
  parts.filter(p => p.mat).forEach(p => {
    assert.ok(STONE_FAMILY[p.mat] || NOT_STONE.has(p.mat), 'unexpected material ' + p.mat);
    if (STONE_FAMILY[p.mat]) families.add(STONE_FAMILY[p.mat]);
  });
  assert.deepEqual(Array.from(families).sort(), ['calacatta-nova', 'limestone', 'majestic', 'steel-grey', 'viscont-white']);
});

test('each stone is where the concept puts it', () => {
  // The facades are our own limestone -- never a supplier photo.
  ['gf-south', 'gf-west', 'gf-north', 'gf-east', 'uf-south', 'uf-east', 'uf-north', 'uf-west'].forEach(g => {
    const clad = parts.filter(p => p.group === g && p.kind === 'cladding' && STONE_FAMILY[p.mat] === 'limestone');
    assert.ok(clad.length > 0, g);
    clad.forEach(p => assert.ok(!p.photos && !p.photo, g + ' facade uses no photo'));
  });
  ofObject('facade').filter(p => p.kind === 'cladding').forEach(p => assert.equal(p.mat, 'limestone'));
  // Steel Grey: plinth, outside steps, outside sills.
  ofObject('entrance-steps').forEach(p => assert.equal(STONE_FAMILY[p.mat], 'steel-grey', 'entrance steps'));
  ofObject('exterior-sills').forEach(p => assert.equal(p.mat, 'steel-grey'));
  // Viscont White: the kitchen; Calacatta Nova: the bathroom; Majestic: the feature wall only.
  ['kitchen-counter', 'kitchen-island', 'kitchen-bar', 'kitchen-backsplash'].forEach(id => ofObject(id).forEach(p => assert.equal(p.mat, 'viscont-white', id)));
  ['bath-counter', 'bath-wall', 'bath-sill'].forEach(id => ofObject(id).filter(p => p.mat !== 'grout').forEach(p => assert.equal(p.mat, 'calacatta-nova', id)));
  parts.filter(p => p.mat === 'majestic').forEach(p => assert.equal(p.object, 'living-panno', 'Majestic stays the one accent'));
  assert.ok(ofObject('living-panno').some(p => p.mat === 'majestic'));
  // Floors: warm oak boards in the rooms, never the facade limestone; the bathroom's is Calacatta Nova.
  ['hall-floor', 'living-floor'].forEach(id => ofObject(id).forEach(p => assert.equal(p.mat, 'wood-floor', id)));
  ofObject('bath-floor').forEach(p => assert.equal(p.mat, 'calacatta-nova'));
  parts.filter(p => p.kind === 'cladding' && p.plane === 'y' && p.normal > 0 && ['gf-floors', 'uf-interior'].includes(p.group))
    .forEach(p => assert.ok(['wood-floor', 'calacatta-nova'].includes(p.mat), 'indoor floor ' + p.mat));
});

// The w x h a photo is laid over, as the renderer measures it.
function photoUses() {
  const uses = [];
  parts.forEach(p => {
    if (p.kind === 'box' && p.photo) {
      const area = p.photo.area || p;
      const d = [0, 1, 2].map(i => area.max[i] - area.min[i]), plane = p.photo.plane || 'y';
      const [w, h] = plane === 'y' ? [d[0], d[2]] : plane === 'x' ? [d[2], d[1]] : [d[0], d[1]];
      uses.push({ part: p, spec: p.photo, w, h });
    }
    if (p.kind === 'cladding' && p.photos) {
      const slabs = House.claddingSlabs(p);
      assert.equal(p.photos.length, slabs.length, 'one photo per slab: ' + p.mat);
      slabs.forEach((r, i) => uses.push({ part: p, spec: p.photos[i], w: r.a1 - r.a0, h: r.b1 - r.b0 }));
    }
  });
  return uses;
}

test('slab photos: real Venezia Stone slabs of the agreed bundles, each region lies on the stone at true scale', () => {
  const uses = photoUses();
  assert.ok(uses.length >= 15);
  uses.forEach(({ part, spec, w, h }) => {
    const photo = Photos.PHOTOS[spec.src];
    assert.ok(photo && photo.kind === 'slab', spec.src);
    assert.equal(photo.stone, part.mat, spec.src + ' is ' + part.mat);
    const { region, size } = Photos.photoMap(spec, w, h);
    assert.ok(region[0] >= -1e-6 && region[1] >= -1e-6 && region[2] <= size[0] + 1e-6 && region[3] <= size[1] + 1e-6,
      spec.src + ' region ' + region.map(x => x.toFixed(3)) + ' outside ' + size.map(x => x.toFixed(3)));
    const s = spec.scale || 1;
    assert.ok(s > 0.9 && s <= 1, 'true scale (within 10%)');
  });
  const bundles = mat => new Set(uses.filter(u => u.part.mat === mat).map(u => Photos.PHOTOS[u.spec.src].bundle));
  assert.deepEqual(Array.from(bundles('viscont-white')), ['BLK10421']);
  assert.deepEqual(Array.from(bundles('calacatta-nova')), ['BLP03755']);
  assert.deepEqual(Array.from(bundles('majestic')), ['BLM17290']);
  // The kitchen's waves all run along the worktop and the island.
  uses.filter(u => u.part.mat === 'viscont-white' && (u.spec.plane || 'y') === 'y').forEach(u => assert.ok([0, 180].includes(u.spec.rotate || 0)));
});

test('the Majestic bookmatch: two consecutive slabs, full height, their mirrored top edges meeting on the axis', () => {
  const wall = ofObject('living-panno').find(p => p.kind === 'cladding');
  const slabs = House.claddingSlabs(wall);
  assert.equal(slabs.length, 2);
  assert.ok(Math.abs((slabs[0].a1 - slabs[0].a0) - (slabs[1].a1 - slabs[1].a0)) < 1e-9, 'two equal halves');
  slabs.forEach(r => assert.ok(r.b1 - r.b0 > 2.9, 'full height'));
  const [right, left] = wall.photos;   // slab 0 is on the viewer's right (+x wall, seen looking toward -x)
  assert.deepEqual([left.src, right.src], ['majestic-M0491372', 'majestic-M0491373']);
  assert.deepEqual([left.rotate, right.rotate], [90, 270], 'turned opposite ways');
  assert.equal(Photos.PHOTOS[left.src].party, Photos.PHOTOS[right.src].party);
  assert.equal(Photos.PHOTOS[left.src].bundle, Photos.PHOTOS[right.src].bundle);
  // Both slabs' top edges (photo y = 0, texture v = 1) run along the axis.
  const w = slabs[0].a1 - slabs[0].a0, h = slabs[0].b1 - slabs[0].b0;
  const L = Photos.photoMap(left, w, h), R = Photos.photoMap(right, w, h);
  [0.1, 0.5, 0.9].forEach(t => {
    assert.ok(Math.abs(L.uv(w, h * t)[1] - 1) < 1e-9, 'left half: top edge at the axis');
    assert.ok(Math.abs(R.uv(0, h * t)[1] - 1) < 1e-9, 'right half: top edge at the axis');
  });
});

test('stone assets: every shipped photo is in the manifest and used, with its source recorded', () => {
  const dir = path.join(__dirname, '..', 'assets', 'showroom', 'stone');
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.webp')).sort();
  assert.deepEqual(files, Object.keys(Photos.PHOTOS).map(k => k + '.webp').sort());
  const used = new Set(photoUses().map(u => u.spec.src));
  Object.entries(Photos.PHOTOS).forEach(([key, p]) => {
    assert.ok(p.source.startsWith('https://storage.yandexcloud.net/venezia-photo/') && p.page.startsWith('https://veneziastone.com/'), key);
    if (p.kind === 'slab') assert.ok(used.has(key), key + ' is laid somewhere');
    const size = fs.statSync(path.join(dir, key + '.webp')).size;
    assert.ok(size < 2.5 * 1024 * 1024, key + ' is optimised');
  });
  const sources = fs.readFileSync(path.join(dir, 'SOURCES.md'), 'utf8');
  Object.keys(Photos.PHOTOS).forEach(key => assert.ok(sources.includes(key), 'SOURCES.md lists ' + key));
});

test('stone photos load zone by zone: the outside needs only Steel Grey, every zone lists the stones of its objects', () => {
  const photoStones = new Set(Object.values(Photos.PHOTOS).map(p => p.stone));
  const listed = new Set();
  Data.ZONES.forEach(z => {
    assert.ok(Array.isArray(z.stones) && z.stones.length > 0, z.id);
    z.stones.forEach(s => { assert.ok(photoStones.has(s), z.id + ': ' + s); listed.add(s); });
    Data.objectsInZone(z.id).forEach(o => ofObject(o.id).forEach(p => {
      const family = STONE_FAMILY[p.mat];
      if (family && family !== 'limestone') assert.ok(z.stones.includes(family), z.id + ' / ' + o.id + ': ' + family);
    }));
  });
  assert.deepEqual(Data.zoneById('exterior').stones, ['steel-grey']);
  // Every stone the house shows is reached by some zone (the background preload loads them all).
  parts.forEach(p => { const f = STONE_FAMILY[p.mat]; if (f && f !== 'limestone') assert.ok(listed.has(f), f); });
});

test('floors: wide oak boards in the rooms, large Calacatta Nova slabs in the bathroom', () => {
  const boards = parts.filter(p => p.kind === 'cladding' && p.mat === 'wood-floor');
  assert.ok(boards.some(p => p.object === 'living-floor') && boards.some(p => p.object === 'hall-floor') && boards.some(p => p.group === 'uf-interior'));
  boards.forEach(p => {
    assert.ok(p.module[0] >= 1.8 && p.module[1] >= 0.18 && p.module[1] <= 0.25, 'wide long boards');
    assert.ok(p.stagger > 0 && p.stagger !== 0.5, 'a loose running bond');
  });
  const bath = ofObject('bath-floor').find(p => p.kind === 'cladding');
  assert.ok(bath.module[0] >= 1.2 && bath.module[1] >= 1.2, 'large-format slabs, few joints');
  assert.equal(House.claddingSlabs(bath).length, 9);
  bath.photos.forEach(ph => assert.equal(Photos.PHOTOS[ph.src].bundle, 'BLP03755'));
});

test('outside window sills: Steel Grey pieces with real thickness, a projection and visible ends', () => {
  const faces = { 'gf-north': ['z', -5, -1], 'gf-east': ['x', 7, 1], 'uf-south': ['z', 6.5, 1], 'uf-east': ['x', 3.5, 1], 'uf-west': ['x', -8.5, -1] };
  Object.entries(faces).forEach(([group, [axis, face, out]]) => {
    const sills = parts.filter(p => p.group === group && p.kind === 'box' && p.mat === 'steel-grey');
    assert.ok(sills.length >= 1, group + ' has stone sills');
    const frames = parts.filter(p => p.group === group && p.kind === 'box' && p.mat === 'limestone-light');
    sills.forEach(sill => {
      const t = sill.max[1] - sill.min[1];
      assert.ok(t >= 0.06 && t <= 0.1, group + ' sill thickness ' + t);
      const i = axis === 'z' ? 2 : 0, along = axis === 'z' ? 0 : 2;
      const proj = out > 0 ? sill.max[i] - face : face - sill.min[i];
      assert.ok(proj >= 0.35, group + ' sill projects ' + proj.toFixed(2));
      const jambs = frames.filter(f => f.min[1] <= sill.max[1] + 0.01 && f.min[1] >= sill.max[1] - 0.01 && f.max[1] - f.min[1] > 0.5 &&
        f.min[along] >= sill.min[along] - 1e-9 && f.max[along] <= sill.max[along] + 1e-9);
      assert.ok(jambs.length >= 2, group + ': the jambs stand on the sill');
      const frameFront = Math.max(...jambs.map(f => (out > 0 ? f.max[i] : -f.min[i])));
      assert.ok((out > 0 ? sill.max[i] : -sill.min[i]) > frameFront + 0.05, group + ': the sill stands proud of its frame');
      assert.ok(Math.min(...jambs.map(f => f.min[along])) - sill.min[along] >= 0.05, group + ': its end shows past the frame');
    });
  });
});

test('kitchen: an undermount sink cut into the worktop, a flush hob, real fronts, proper bar stools', () => {
  const top = ofObject('kitchen-counter').filter(p => p.max[1] === 1.35);
  // Nothing covers the sink opening: the stone is cut round it.
  const sink = { x: 4.1, z: -4.37 };
  assert.ok(!top.some(p => sink.x > p.min[0] && sink.x < p.max[0] && sink.z > p.min[2] && sink.z < p.max[2]), 'the worktop is open over the sink');
  const areaPieces = top.filter(p => p.photo && p.photo.area);
  assert.ok(areaPieces.length >= 4 && areaPieces.every(p => p.photo.area === areaPieces[0].photo.area), 'one pattern across the cut');
  const steel = parts.filter(p => p.mat === 'steel' && p.kind === 'box' && p.min[0] >= 3.68 && p.max[0] <= 4.52 && p.min[2] >= -4.57 && p.max[2] <= -4.18);
  assert.ok(steel.length >= 5, 'a steel bowl: four walls and a bottom');
  assert.ok(Math.min(...steel.map(p => p.min[1])) < 1.2, 'a deep bowl under the stone');
  const hob = parts.find(p => p.mat === 'glass-black' && p.kind === 'box' && p.max[1] - p.min[1] < 0.01 && p.min[1] === 1.35);
  assert.ok(hob, 'a thin glass-ceramic hob on the stone');
  assert.equal(parts.filter(p => p.kind === 'cyl' && p.mat === 'hob-ring').length, 4, 'four cooking zones');
  const doors = parts.filter(p => p.group === 'gf-interior' && p.kind === 'box' && ['wood', 'cabinet'].includes(p.mat) && Math.abs((p.max[2] - p.min[2]) - 0.02) < 1e-9);
  assert.ok(doors.length >= 15, 'separate fronts, not one block');
  const legs = parts.filter(p => p.kind === 'beam' && p.mat === 'metal-dark' && p.group === 'gf-interior' && p.from[1] < 0.5 && p.to[1] > 1.1);
  assert.equal(legs.length, 12, 'three stools on four legs');
  assert.ok(!parts.some(p => p.kind === 'cyl' && p.group === 'gf-interior' && p.base[2] === -1.35), 'no cylinder stools left');
});

test('every marker is in plain view from its zone camera on a phone, a tablet and a desktop', () => {
  Data.ZONES.forEach(zone => {
    const solids = parts.filter(p => !zone.hide.includes(p.group) && ['box', 'cladding'].includes(p.kind) && !['glass', 'glass-smoke', 'lamp'].includes(p.mat));
    Data.objectsInZone(zone.id).forEach(obj => [390 / 760, 0.95, 1.6].forEach(aspect => {
      const o = State.scaleView(zone.view, State.distanceScale(aspect, 38)).position, a = obj.anchor;
      const d = a.map((x, i) => x - o[i]), len = Math.hypot(...d);
      const blocker = solids.find(p => {
        if (p.object === obj.id) return false;
        const b = House.partBounds(p);
        let t0 = 0, t1 = 1;
        for (let i = 0; i < 3; i++) {
          if (Math.abs(d[i]) < 1e-12) { if (o[i] < b.min[i] || o[i] > b.max[i]) return false; continue; }
          let ta = (b.min[i] - o[i]) / d[i], tb = (b.max[i] - o[i]) / d[i];
          if (ta > tb) [ta, tb] = [tb, ta];
          t0 = Math.max(t0, ta); t1 = Math.min(t1, tb);
          if (t0 > t1) return false;
        }
        return t0 < 1 - 0.12 / len;
      });
      assert.ok(!blocker, obj.id + ' hidden by ' + (blocker && blocker.group + ' ' + blocker.mat) + ' at aspect ' + aspect.toFixed(2));
    }));
  });
});

// Two faces in one plane, facing the same way, overlapping, and not covered
// by a third solid: the geometric cause of flickering (z-fighting).
function coplanarFaces() {
  const solids = parts.filter(p => p.kind === 'box' || p.kind === 'cladding');
  const bounds = solids.map(p => House.partBounds(p));
  const faces = new Map();
  solids.forEach((p, idx) => {
    const b = bounds[idx];
    for (let ax = 0; ax < 3; ax++) {
      [[-1, b.min[ax]], [1, b.max[ax]]].forEach(([dir, at]) => {
        // A cladding shows only its face; its back sits on its bed.
        if (p.kind === 'cladding' && (ax !== { x: 0, y: 1, z: 2 }[p.plane] || dir !== p.normal)) return;
        const key = ax + '|' + dir + '|' + Math.round(at * 1e4);
        if (!faces.has(key)) faces.set(key, []);
        faces.get(key).push({ idx, ax, dir, at });
      });
    }
  });
  const covered = (pt, skip) => bounds.some((b, i) => !skip.includes(i) && [0, 1, 2].every(k => pt[k] > b.min[k] + 1e-6 && pt[k] < b.max[k] - 1e-6));
  const found = [];
  faces.forEach(list => {
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const A = list[i], C = list[j];
        const o = [0, 1, 2].filter(k => k !== A.ax);
        const lo = o.map(k => Math.max(bounds[A.idx].min[k], bounds[C.idx].min[k]));
        const hi = o.map(k => Math.min(bounds[A.idx].max[k], bounds[C.idx].max[k]));
        if (hi[0] - lo[0] < 1e-4 || hi[1] - lo[1] < 1e-4) continue;
        // Sample the overlap just in front of the faces; a point no third solid covers is visible.
        const fr = [0.13, 0.37, 0.61, 0.89];
        const visible = fr.some(s => fr.some(t => {
          const pt = [0, 0, 0];
          pt[A.ax] = A.at + A.dir * 0.002;
          pt[o[0]] = lo[0] + (hi[0] - lo[0]) * s;
          pt[o[1]] = lo[1] + (hi[1] - lo[1]) * t;
          return !covered(pt, [A.idx, C.idx]);
        }));
        if (visible) found.push(solids[A.idx].group + ':' + solids[A.idx].mat + ' / ' + solids[C.idx].group + ':' + solids[C.idx].mat + ' at ' + 'xyz'[A.ax] + '=' + A.at.toFixed(3));
      }
    }
  });
  return found;
}

test('no two visible surfaces share a plane (walls meet at corners, cladding, niche, belt, frames)', () => {
  assert.deepEqual(coplanarFaces(), []);
});

test('the coplanar-face check catches a wall face laid over another', () => {
  const { FF1, SLAB } = House.LEVELS;
  const extra = { kind: 'box', min: [-6.94, FF1, 4.7], max: [-6.7, SLAB, 5.0], mat: 'plaster', group: 'gf-south' };
  parts.push(extra);
  try { assert.ok(coplanarFaces().length > 0); } finally { parts.pop(); }
});

// ---- the fireplace in the living room ---------------------------------------------

test('the fireplace: a showroom object in the living room, «Камины», its card opens the configurator on kaminy', () => {
  const o = Data.objectById('living-fireplace');
  assert.deepEqual([o.productKey, o.zone, o.primary], ['kaminy', 'living', true]);
  assert.equal(Data.primaryObjectFor('kaminy'), o);
  const d = State.describe(State.reduce(State.initialState(), { type: 'selectObject', id: 'living-fireplace' }));
  assert.equal(d.zone.id, 'living');
  assert.equal(d.card.productLabel, 'Камины');
  assert.equal(d.card.title, 'Каминный портал');
  assert.equal(d.card.ctaHref, '/calculator/sayanmramor-calculator.html?product=kaminy');
  assert.equal(d.card.categoryHref, '/sayanmramor-site/categories/kaminy.html');
  // The other living-room objects are all still there.
  assert.deepEqual(Data.objectsInZone('living').map(x => x.id), ['living-floor', 'living-panno', 'living-sill', 'living-fireplace']);
});

test('the fireplace stands on the floor, centred on the Majestic wall, in front of it -- the panno stays visible around it', () => {
  const { FF1 } = House.LEVELS;
  const box = ids => {
    const b = ids.map(p => House.partBounds(p));
    return { min: [0, 1, 2].map(i => Math.min(...b.map(x => x.min[i]))), max: [0, 1, 2].map(i => Math.max(...b.map(x => x.max[i]))) };
  };
  const fire = box(ofObject('living-fireplace'));
  const panno = box(ofObject('living-panno'));
  const pannoFace = panno.max[0];
  // Centred on the wall's axis (the bookmatch axis), standing on the floor boards.
  const axis = (panno.min[2] + panno.max[2]) / 2;
  assert.ok(Math.abs((fire.min[2] + fire.max[2]) / 2 - axis) < 1e-6, 'centred on the panno axis');
  assert.ok(Math.abs(fire.min[1] - (FF1 + 0.02)) < 1e-9, 'on the floor');
  // In front of the panno, touching it, never inside it.
  assert.ok(Math.abs(fire.min[0] - pannoFace) < 1e-9, 'against the panno face');
  ofObject('living-fireplace').forEach(p => assert.ok(House.partBounds(p).min[0] >= pannoFace - 1e-9, 'nothing inside the wall'));
  // Not massive: the Majestic shows above it and on both sides.
  assert.ok(panno.max[1] - fire.max[1] > 1.8, 'panno visible above the shelf');
  assert.ok(fire.min[2] - panno.min[2] > 0.9 && panno.max[2] - fire.max[2] > 0.9, 'panno visible on both sides');
  assert.ok(fire.max[2] - fire.min[2] < 1.7, 'about 1.5 m wide');
  // Our light limestone round a dark firebox; the Majestic stays the one accent.
  assert.deepEqual([...new Set(ofObject('living-fireplace').map(p => p.mat))].sort(), ['limestone-light', 'poche']);
});

test('the fireplace replaced the low stone console, and the sofa faces it', () => {
  // No limestone box is left floating on the feature wall where the console was.
  const console = parts.filter(p => p.kind === 'box' && p.group === 'gf-interior' && p.mat === 'limestone-light' && !p.object &&
    House.partBounds(p).min[0] < 1.2 && House.partBounds(p).min[2] > 1.05 && House.partBounds(p).max[2] < 4.7);
  assert.deepEqual(console, []);
  // The sofa: the fabric seat across the room, its middle on the fireplace's axis.
  const fire = ofObject('living-fireplace').map(p => House.partBounds(p));
  const zc = (Math.min(...fire.map(b => b.min[2])) + Math.max(...fire.map(b => b.max[2]))) / 2;
  const seat = parts.find(p => p.mat === 'fabric' && p.kind === 'box' && Math.abs(p.min[0] - 4.3) < 1e-9 && Math.abs(p.min[1] - 0.56) < 1e-9);
  const b = House.partBounds(seat);
  assert.ok(b.min[0] > Math.max(...fire.map(x => x.max[0])), 'across the room');
  assert.ok(Math.abs((b.min[2] + b.max[2]) / 2 - zc) < 0.15, 'facing the fireplace');
});
