// tests/contacts-map.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ContactsMap = require('../js/contacts-map.js');

const site = path.join(__dirname, '..');
const index = fs.readFileSync(path.join(site, 'index.html'), 'utf8');
const unescape = s => s.replace(/&amp;/g, '&');
const section = index.slice(index.indexOf('id="contacts"'), index.indexOf('</section>', index.indexOf('id="contacts"')));

test('the one point is the sales office and production in Ivanteevka, at the Yandex address point', () => {
  const { OFFICE } = ContactsMap;
  assert.equal(OFFICE.purpose, 'Офис продаж и производство');
  assert.equal(OFFICE.addressLines.join(' '), 'МО, г. Ивантеевка, ул. Толмачева, д. 80');
  assert.equal(OFFICE.lat, 55.960447);
  assert.equal(OFFICE.lon, 37.923215);
});

test('the marker stands on the company\'s building in the complex (OSM way 134908625), the address unchanged', () => {
  const { OFFICE } = ContactsMap;
  assert.deepEqual(OFFICE.pin, { lat: 55.959584, lon: 37.925953 });
  // ~170 m east and ~96 m south of the address point -- not the street point.
  const mLat = 111320, mLon = 111320 * Math.cos(OFFICE.lat * Math.PI / 180);
  const east = (OFFICE.pin.lon - OFFICE.lon) * mLon, south = (OFFICE.lat - OFFICE.pin.lat) * mLat;
  assert.ok(Math.abs(east - 170) < 5 && Math.abs(south - 96) < 5, east + ' / ' + south);
  // One marker, at the pin.
  const src = fs.readFileSync(path.join(site, 'js/contacts-map.js'), 'utf8');
  assert.equal((src.match(/new y\.YMapMarker\(/g) || []).length, 1);
  assert.match(src, /YMapMarker\(\{ coordinates: \[OFFICE\.pin\.lon, OFFICE\.pin\.lat\] \}/);
});

test('route and "open in maps" go to the company\'s own card in Yandex Maps, in its building -- not the complex\'s address point', () => {
  const { OFFICE, routeUrl, openUrl } = ContactsMap;
  // rtext: from~to as lat,lon (an empty "from" is the visitor's location); ruri: the organisation at the end.
  assert.equal(routeUrl(OFFICE), 'https://yandex.ru/maps/?rtext=~55.959646,37.925940&rtt=auto&ruri=~ymapsbm1%3A%2F%2Forg%3Foid%3D195958427090');
  assert.equal(openUrl(OFFICE), 'https://yandex.ru/maps/org/sayanmramor/195958427090/');
  // Yandex's point for the card is the company's building: a few metres from the pin.
  const m = 111320, dy = (OFFICE.yandex.lat - OFFICE.pin.lat) * m, dx = (OFFICE.yandex.lon - OFFICE.pin.lon) * m * Math.cos(OFFICE.pin.lat * Math.PI / 180);
  assert.ok(Math.hypot(dx, dy) < 20, Math.hypot(dx, dy) + ' m');
});

test('index.html: the contacts section has the address, the phone and the two links as plain HTML', () => {
  const { OFFICE, routeUrl, openUrl } = ContactsMap;
  assert.ok(section.length > 0, 'section#contacts');
  assert.match(section, /<h2 id="contactsTitle">Где мы находимся<\/h2>/);
  assert.match(section, /Офис продаж и производство/);
  assert.match(section, /МО, г\. Ивантеевка,<br>ул\. Толмачева, д\. 80/);
  assert.match(section, /<a class="contacts-phone" href="tel:\+74952155145">\+7 \(495\) 215-51-45<\/a>/);
  const hrefOf = text => {
    const m = section.match(new RegExp('<a [^>]*href="([^"]+)"[^>]*>' + text + '</a>'));
    assert.ok(m, text);
    return unescape(m[1]);
  };
  assert.equal(hrefOf('Построить маршрут'), routeUrl(OFFICE));
  assert.equal(hrefOf('Открыть в картах'), openUrl(OFFICE));
  [...section.matchAll(/<a [^>]*href="https:[^"]+"[^>]*>/g)].forEach(([a]) => {
    assert.match(a, /target="_blank"/);
    assert.match(a, /rel="noopener"/);
  });
  assert.match(section, /id="contactsMap"/);
  assert.match(section, /id="contactsMapFallback" hidden/);
});

// A stand-in for Yandex's ymaps3: records the map options and what is added to the map.
function fakeYmaps() {
  const log = { map: null, children: [], behaviors: null };
  class Node { constructor(...a) { this.args = a; } addChild(c) { log.children.push(c); return this; } }
  class YMap extends Node { constructor(el, options, layers) { super(el, options, layers); log.map = options; } setBehaviors(b) { log.behaviors = b; } }
  const y = { YMap, YMapDefaultSchemeLayer: Node, YMapDefaultFeaturesLayer: Node, YMapControls: Node, YMapMarker: Node,
    import: async () => ({ YMapZoomControl: Node }), ready: Promise.resolve() };
  return { y, log };
}
function fakeEl() {
  const listeners = {};
  const doc = { getElementById: () => null, createElement: () => ({ append() {}, appendChild() {}, addEventListener() {}, setAttribute() {}, set innerHTML(v) {} }) };
  return { ownerDocument: doc, listeners, addEventListener(ev, fn) { listeners[ev] = fn; } };
}

test('mouse: drag to move, wheel off until the map is used; touch: one finger scrolls the page, two move and zoom', async () => {
  const d = fakeYmaps(), el = fakeEl();
  await ContactsMap.mount(el, d.y, { matchMedia: () => ({ matches: false }) });
  assert.ok(d.log.map.behaviors.includes('drag'));
  assert.ok(!d.log.map.behaviors.includes('scrollZoom'), 'the wheel does not zoom a map passed by');
  assert.deepEqual(d.log.map.location.center, [ContactsMap.OFFICE.pin.lon, ContactsMap.OFFICE.pin.lat], 'centred on the marker (lon, lat)');
  el.listeners.pointerdown();
  assert.ok(d.log.behaviors.includes('scrollZoom'), 'the wheel zooms once the map is pressed');
  el.listeners.mouseleave();
  assert.ok(!d.log.behaviors.includes('scrollZoom'));
  const t = fakeYmaps();
  await ContactsMap.mount(fakeEl(), t.y, { matchMedia: () => ({ matches: true }) });
  assert.ok(!t.log.map.behaviors.includes('drag'), 'one finger scrolls the page');
  assert.ok(t.log.map.behaviors.includes('pinchZoom'));
  assert.equal(t.log.children.filter(c => c.args[0] && c.args[0].coordinates).length, 1, 'one marker');
});

test('the map comes from Yandex: its script from api-maps.yandex.ru with the site key, only when the section is near; no Leaflet, no OpenStreetMap', () => {
  assert.match(ContactsMap.API_URL, /^https:\/\/api-maps\.yandex\.ru\/v3\/\?lang=ru_RU&apikey=[0-9a-f-]{36}$/);
  assert.ok(!/api-maps/.test(index), 'index.html does not load it up front');
  assert.ok(!/leaflet/i.test(index) && !fs.existsSync(path.join(site, 'vendor/leaflet')));
  const src = fs.readFileSync(path.join(site, 'js/contacts-map.js'), 'utf8');
  assert.ok(!/openstreetmap|tile\./i.test(src.replace(/\/\/.*$/gm, '')), 'no tiles from abroad');
  assert.match(src, /IntersectionObserver/);
});

test('if the script never loads, the map frame shows the "open in Yandex Maps" fallback, not an empty map', async () => {
  const fallback = { hidden: true };
  const scripts = [];
  const doc = { getElementById: id => (id === 'contactsMapFallback' ? fallback : null), head: { appendChild: s => scripts.push(s) }, createElement: () => ({}) };
  const win = {};
  const failed = ContactsMap.loadApi(doc, win);
  scripts[0].onerror();
  await assert.rejects(failed);
  assert.equal(scripts[0].src, ContactsMap.API_URL);
});

test('the legal address is not shown as a place to visit', () => {
  // Not in «Где мы находимся»; only in the footer, and there labelled as the legal address.
  const contacts = index.slice(index.indexOf('id="contacts"'), index.indexOf('</section>', index.indexOf('id="contacts"')));
  assert.ok(!/Складочная/.test(contacts));
  const footer = index.slice(index.indexOf('<footer'));
  assert.match(footer, /Юридический адрес: 127018, г\. Москва, вн\.тер\.г\. Муниципальный Округ Бутырский, ул Складочная, д\. 3, стр\. 5, помещ\. 1\/1/);
  assert.equal((index.match(/Складочная/g) || []).length, 1);
});
