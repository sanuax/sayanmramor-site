// tests/contacts-map.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ContactsMap = require('../js/contacts-map.js');

const site = path.join(__dirname, '..');
const index = fs.readFileSync(path.join(site, 'index.html'), 'utf8');
const unescape = s => s.replace(/&amp;/g, '&');
const section = index.slice(index.indexOf('id="contacts"'), index.indexOf('class="home-showroom"'));

test('the one point is the sales office and production in Ivanteevka, at the Yandex address point', () => {
  const { OFFICE } = ContactsMap;
  assert.equal(OFFICE.purpose, 'Офис продаж и производство');
  assert.equal(OFFICE.addressLines.join(' '), 'МО, г. Ивантеевка, ул. Толмачева, д. 80');
  assert.equal(OFFICE.lat, 55.960447);
  assert.equal(OFFICE.lon, 37.923215);
});

test('route and "open in maps" go to Yandex Maps at that point', () => {
  const { OFFICE, routeUrl, openUrl } = ContactsMap;
  // rtext: from~to as lat,lon; an empty "from" is the visitor's location.
  assert.equal(routeUrl(OFFICE), 'https://yandex.ru/maps/?rtext=~55.960447,37.923215&rtt=auto');
  // whatshere[point]: lon,lat.
  assert.equal(openUrl(OFFICE), 'https://yandex.ru/maps/?whatshere%5Bpoint%5D=37.923215,55.960447&whatshere%5Bzoom%5D=17');
});

test('index.html: the contacts section has the address, the phone and the two links as plain HTML', () => {
  const { OFFICE, routeUrl, openUrl } = ContactsMap;
  assert.ok(section.length > 0, 'section#contacts before the showroom band');
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

// A stand-in for Leaflet: records the map options and the tile layer events.
function mountWithFakeLeaflet(coarse) {
  const handlers = {};
  const fallback = { hidden: true };
  let mapOptions = null;
  const doc = {
    getElementById: id => (id === 'contactsMapFallback' ? fallback : null),
    createElement: () => ({ appendChild() {}, textContent: '' }),
  };
  const layer = { addTo() { return this; }, on(ev, fn) { handlers[ev] = fn; return this; }, bindPopup() { return this; } };
  const L = {
    map: (el, options) => { mapOptions = options; return { attributionControl: { setPrefix() {} }, on() {}, scrollWheelZoom: {} }; },
    control: { zoom: () => layer }, tileLayer: () => layer, marker: () => layer, divIcon: o => o,
  };
  ContactsMap.mount({ ownerDocument: doc, addEventListener() {} }, L, { matchMedia: () => ({ matches: coarse }) });
  return { handlers, fallback, mapOptions };
}

test('if no tile loads, the map frame shows the "open in Yandex Maps" fallback, not an empty map', () => {
  const { handlers, fallback } = mountWithFakeLeaflet(false);
  for (let i = 0; i < 3; i++) handlers.tileerror();
  assert.equal(fallback.hidden, true, 'a few failed tiles are not yet a failure');
  handlers.tileerror();
  assert.equal(fallback.hidden, false);

  const partial = mountWithFakeLeaflet(false);
  partial.handlers.tileload();
  for (let i = 0; i < 10; i++) partial.handlers.tileerror();
  assert.equal(partial.fallback.hidden, true, 'a map that loaded is kept');
});

test('mouse: drag to move, wheel off until the map is used; touch: one finger scrolls the page', () => {
  const desktop = mountWithFakeLeaflet(false).mapOptions;
  assert.equal(desktop.dragging, true);
  assert.equal(desktop.scrollWheelZoom, false);
  assert.deepEqual(desktop.center, [ContactsMap.OFFICE.lat, ContactsMap.OFFICE.lon]);
  assert.equal(mountWithFakeLeaflet(true).mapOptions.dragging, false);
});

test('the legal address is not shown as a place to visit', () => {
  assert.ok(!/Складочная/.test(index));
});

test('Leaflet is vendored and loads before the map script', () => {
  ['leaflet.js', 'leaflet.css', 'LICENSE', 'VERSION.txt'].forEach(f =>
    assert.ok(fs.existsSync(path.join(site, 'vendor/leaflet', f)), f));
  const leaflet = index.indexOf('/sayanmramor-site/vendor/leaflet/leaflet.js');
  const map = index.indexOf('/sayanmramor-site/js/contacts-map.js');
  assert.ok(leaflet > 0 && map > leaflet);
  assert.ok(index.indexOf('vendor/leaflet/leaflet.css') < index.indexOf('css/site.css'), 'site.css overrides leaflet.css');
  assert.ok(!/sourceMappingURL/.test(fs.readFileSync(path.join(site, 'vendor/leaflet/leaflet.js'), 'utf8')), 'no request for a .map that is not vendored');
});
