// Contacts map: the company's one physical point on Yandex Maps (JavaScript API 3.0,
// toned to the site palette in site.css), with the route and "open in maps" hand-off
// to Yandex Maps. Yandex's script is requested only when the section comes near the
// screen, so a visitor who never scrolls there sends nothing to Yandex (the owner,
// 2026-11-08: no map from abroad, the policy says there is no cross-border transfer).
// OFFICE is the only place the point lives; index.html repeats the address and the
// two links as plain HTML, so they work before the map loads, without JavaScript,
// and if the map never arrives.
(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = factory();
  } else {
    root.ContactsMap = factory();
  }
})(typeof window !== 'undefined' ? window : globalThis, function () {

  // Name, purpose, address and phone as on sayanmramor.ru. The legal address
  // (Москва, Складочная) is not a place to visit, so it is not on the map.
  // Coordinates: lat/lon -- the Yandex Maps address point of «улица
  // Толмачёва, 80, Ивантеевка» (the whole complex). `pin` -- the company's own
  // building in that complex, the centre of OSM way 134908625 (~170 m east,
  // ~96 m south of the address point), as the company marked it on the map:
  // the marker stands there.
  // `yandex` -- the company's own card in Yandex Maps (organisation 195958427090,
  // «Саянмрамор», in that building) and the point Yandex routes to for it: the
  // route and "open in maps" links go to the card, not to the complex's address
  // point (a route there ended at the wrong end of the complex).
  const OFFICE = {
    name: 'Саянмрамор',
    purpose: 'Офис продаж и производство',
    addressLines: ['МО, г. Ивантеевка,', 'ул. Толмачева, д. 80'],
    lat: 55.960447,
    lon: 37.923215,
    pin: { lat: 55.959584, lon: 37.925953 },
    yandex: { oid: '195958427090', slug: 'sayanmramor', lat: 55.959646, lon: 37.92594 },
  };

  // Yandex Maps URL parameters, as Yandex itself builds them from the card's
  // «Маршрут»: rtext = "from~to" as lat,lon, where an empty "from" is the
  // visitor's own location; rtt = the route type; ruri = "from~to" as the
  // places' ids, so the end of the route is the organisation, named.
  function routeUrl(p) {
    const y = p.yandex;
    return 'https://yandex.ru/maps/?rtext=~' + y.lat.toFixed(6) + ',' + y.lon.toFixed(6) + '&rtt=auto&ruri=~' +
      encodeURIComponent('ymapsbm1://org?oid=' + y.oid);
  }
  function openUrl(p) {
    return 'https://yandex.ru/maps/org/' + p.yandex.slug + '/' + p.yandex.oid + '/';
  }

  // The site's own key of the Yandex JavaScript API (developer.tech.yandex.ru, the owner's
  // account), limited there to the site's addresses. A key is not a secret: it is in the
  // page's code anyway.
  const API_KEY = '78b949dc-7f0c-41e0-abb0-d0166aec3734';
  const API_URL = 'https://api-maps.yandex.ru/v3/?lang=ru_RU&apikey=' + API_KEY;
  const WAIT_MS = 12000;   // no map by then: the plain links stand in
  const PIN = '<svg viewBox="0 0 34 44" width="34" height="44" aria-hidden="true">' +
    '<path d="M17 1.5C8.4 1.5 1.5 8.3 1.5 16.8c0 11 13.3 24.6 14.5 25.8a1.4 1.4 0 0 0 2 0' +
    'C19.2 41.4 32.5 27.8 32.5 16.8 32.5 8.3 25.6 1.5 17 1.5z"/><circle cx="17" cy="16.5" r="5.5"/></svg>';

  // The sheet of words over the pin: opens on a press, closes on a second one.
  function pinContent(doc, p) {
    const box = doc.createElement('div');
    box.className = 'map-marker';
    const button = doc.createElement('button');
    button.type = 'button';
    button.className = 'map-pin';
    button.setAttribute('aria-label', p.name + ' - ' + p.purpose);
    button.setAttribute('aria-expanded', 'false');
    button.innerHTML = PIN;
    const popup = doc.createElement('div');
    popup.className = 'map-popup';
    popup.hidden = true;
    [['strong', p.name], ['span', p.purpose]].concat(p.addressLines.map(line => ['span', line])).forEach(([tag, text]) => {
      const el = doc.createElement(tag);
      el.textContent = text;
      popup.appendChild(el);
    });
    button.addEventListener('click', () => {
      popup.hidden = !popup.hidden;
      button.setAttribute('aria-expanded', String(!popup.hidden));
    });
    box.append(popup, button);
    return box;
  }

  function showFallback(doc) {
    const fallback = doc.getElementById('contactsMapFallback');
    if (fallback) fallback.hidden = false;
  }

  // Load Yandex's script once; resolves with ymaps3 when it is ready.
  function loadApi(doc, win) {
    if (win.ymaps3) return win.ymaps3.ready.then(() => win.ymaps3);
    return new Promise((resolve, reject) => {
      const script = doc.createElement('script');
      script.src = API_URL;
      script.async = true;
      script.onload = () => (win.ymaps3 ? win.ymaps3.ready.then(() => resolve(win.ymaps3), reject) : reject(new Error('no ymaps3')));
      script.onerror = () => reject(new Error('script'));
      doc.head.appendChild(script);
    });
  }

  async function mount(el, y, win) {
    const doc = el.ownerDocument;
    // On a touch screen one finger scrolls the page past the map (no scroll
    // trap); two fingers move and zoom it, and the +/- buttons still work.
    const coarse = !!(win.matchMedia && win.matchMedia('(pointer: coarse)').matches);
    const behaviors = coarse ? ['pinchZoom', 'dblClick'] : ['drag', 'dblClick'];
    const map = new y.YMap(el, { location: { center: [OFFICE.pin.lon, OFFICE.pin.lat], zoom: 16 }, behaviors, zoomRange: { min: 9, max: 18 } }, [
      new y.YMapDefaultSchemeLayer({}),
      new y.YMapDefaultFeaturesLayer({}),
    ]);
    const controls = await y.import('@yandex/ymaps3-controls@0.0.1');
    map.addChild(new y.YMapControls({ position: 'right' }).addChild(new controls.YMapZoomControl({})));
    map.addChild(new y.YMapMarker({ coordinates: [OFFICE.pin.lon, OFFICE.pin.lat] }, pinContent(doc, OFFICE)));

    // The wheel zooms only once the visitor is using the map, so scrolling
    // the page past it never zooms it by accident.
    if (!coarse) {
      let wheel = false;
      const set = on => {
        if (on === wheel) return;
        wheel = on;
        map.setBehaviors(on ? ['drag', 'dblClick', 'scrollZoom'] : ['drag', 'dblClick']);
      };
      el.addEventListener('pointerdown', () => set(true));
      el.addEventListener('mouseleave', () => set(false));
    }

    const hint = doc.getElementById('contactsMapHint');
    if (coarse && hint) {
      let timer = 0;
      el.addEventListener('touchstart', e => {
        clearTimeout(timer);
        hint.hidden = e.touches.length !== 1;
        if (!hint.hidden) timer = setTimeout(() => { hint.hidden = true; }, 1600);
      }, { passive: true });
    }
    return map;
  }

  async function start(el, doc, win) {
    const timer = win.setTimeout(() => showFallback(doc), WAIT_MS);
    try {
      const y = await loadApi(doc, win);
      await mount(el, y, win);
      win.clearTimeout(timer);
    } catch (e) {
      win.clearTimeout(timer);
      showFallback(doc);
    }
  }

  // Build the map when the section comes near the screen: nothing is requested
  // from Yandex for a visitor who never scrolls to it.
  if (typeof document !== 'undefined') {
    const el = document.getElementById('contactsMap');
    if (el) {
      if ('IntersectionObserver' in window) {
        const io = new IntersectionObserver(entries => {
          if (entries.some(e => e.isIntersecting)) { io.disconnect(); start(el, document, window); }
        }, { rootMargin: '300px 0px' });
        io.observe(el);
      } else {
        start(el, document, window);
      }
    }
  }

  return { OFFICE, API_URL, routeUrl, openUrl, mount, loadApi };
});
