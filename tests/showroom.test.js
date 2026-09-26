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

// The configurator's 9 public product keys -- part of the URL contract, so
// they are pinned here rather than read from the calculator's code.
test('the showroom covers exactly the 9 product directions, with the configurator\'s public product keys', () => {
  const expected = ['lestnitsa', 'panno', 'podokonnik', 'pol', 'stena', 'fasad', 'stoleshnitsa_vannaya', 'stoleshnitsa_kuhnya', 'stupeni'];
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
  assert.ok(parts.some(p => p.kind === 'box' && p.mat === 'basalt' && p.max[1] === House.LEVELS.FF1), 'a basalt plinth');
  assert.equal(parts.filter(p => p.group === 'stair' && p.mat === 'travertine').length, 36, '18 treads + 18 risers');
});

const FACADE_GROUPS = ['gf-south', 'gf-west', 'gf-north', 'gf-east', 'uf-south', 'uf-east', 'uf-north', 'uf-west'];

test('the facades are stone: the upper floor is clad in stone slabs, no timber cladding anywhere outside', () => {
  ['uf-south', 'uf-east', 'uf-north', 'uf-west'].forEach(g => {
    assert.ok(parts.some(p => p.group === g && p.kind === 'cladding' && p.mat === 'travertine'), g + ' stone panels');
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
  const niche = parts.filter(p => p.group === 'gf-south' && p.mat === 'stone-graphite' && p.kind === 'cladding');
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

test('the house stands on an island in a calm pond, reached by a bridge', () => {
  const { WATER, ISLAND, POND, BRIDGE } = House.SITE;
  const water = parts.filter(p => p.mat === 'water');
  assert.equal(water.length, 1);
  assert.equal(water[0].max[1], WATER);
  assert.ok(WATER < 0, 'the water lies below the island');
  assert.ok(POND.x0 < ISLAND.x0 - 5 && POND.x1 > ISLAND.x1 + 5 && POND.z0 < ISLAND.z0 - 5 && POND.z1 > ISLAND.z1 + 5, 'a ring of water all round');
  const house = parts.filter(p => p.kind === 'box' && p.group !== 'site');
  house.forEach(p => assert.ok(p.min[0] >= ISLAND.x0 && p.max[0] <= ISLAND.x1 && p.min[2] >= ISLAND.z0 && p.max[2] <= ISLAND.z1, p.group + ' on the island'));
  const deck = parts.find(p => p.kind === 'cladding' && p.plane === 'y' && p.a[0] === BRIDGE.x0 && p.b[0] > ISLAND.z1);
  assert.ok(deck && deck.b[1] >= POND.z1 - 0.2, 'the bridge spans the water to the far bank');
  assert.ok(parts.filter(p => p.kind === 'tree').length <= 12, 'a few large trees, not a forest');
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
  const treads = parts.filter(p => p.group === 'stair' && p.mat === 'travertine' && p.max[1] - p.min[1] < 0.06).sort((a, b) => a.max[1] - b.max[1]);
  assert.equal(treads.length, 18);
  assert.ok(treads[landingAfter].max[2] - treads[landingAfter].min[2] >= landing, 'the landing is a deep tread');
  assert.ok(parts.some(p => p.group === 'stair' && p.mat === 'stone-graphite' && p.kind === 'beam'), 'a stone stringer');
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

test('the no-3D fallback in showroom.html links all 9 directions to the configurator contract', () => {
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
