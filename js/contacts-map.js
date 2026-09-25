// Contacts map: the company's one physical point on a real map (Leaflet over
// OpenStreetMap tiles, toned to the site palette in site.css), with the
// route and "open in maps" hand-off to Yandex Maps. OFFICE is the only place
// the point lives; index.html repeats the address and the two links as plain
// HTML, so they work before the map loads, without JavaScript, and if the
// tiles never arrive.
(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = factory();
  } else {
    root.ContactsMap = factory();
  }
})(typeof window !== 'undefined' ? window : globalThis, function () {

  // Name, purpose, address and phone as on sayanmramor.ru. The legal address
  // (Москва, Складочная) is not a place to visit, so it is not on the map.
  // Coordinates: the Yandex Maps address point of «улица Толмачёва, 80,
  // Ивантеевка» -- the point the route is built to. (OSM has this address on
  // the buildings of the same complex, the nearest one ~130 m to the south.)
  const OFFICE = {
    name: 'Саянмрамор',
    purpose: 'Офис продаж и производство',
    addressLines: ['МО, г. Ивантеевка,', 'ул. Толмачева, д. 80'],
    lat: 55.960447,
    lon: 37.923215,
  };

  // Yandex Maps URL parameters: rtext = "from~to" as lat,lon, where an empty
  // "from" is the visitor's own location; rtt = the route type.
  // whatshere[point] (lon,lat) opens the address card for that point.
  function routeUrl(p) {
    return 'https://yandex.ru/maps/?rtext=~' + p.lat + ',' + p.lon + '&rtt=auto';
  }
  function openUrl(p) {
    return 'https://yandex.ru/maps/?whatshere%5Bpoint%5D=' + p.lon + ',' + p.lat + '&whatshere%5Bzoom%5D=17';
  }

  const TILES = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
  const ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';
  const PIN = '<svg viewBox="0 0 34 44" width="34" height="44" aria-hidden="true">' +
    '<path d="M17 1.5C8.4 1.5 1.5 8.3 1.5 16.8c0 11 13.3 24.6 14.5 25.8a1.4 1.4 0 0 0 2 0' +
    'C19.2 41.4 32.5 27.8 32.5 16.8 32.5 8.3 25.6 1.5 17 1.5z"/><circle cx="17" cy="16.5" r="5.5"/></svg>';

  function popupContent(doc, p) {
    const box = doc.createElement('div');
    [['strong', p.name], ['span', p.purpose]].concat(p.addressLines.map(line => ['span', line])).forEach(([tag, text]) => {
      const el = doc.createElement(tag);
      el.textContent = text;
      box.appendChild(el);
    });
    return box;
  }

  function showFallback(doc) {
    const fallback = doc.getElementById('contactsMapFallback');
    if (fallback) fallback.hidden = false;
  }

  function mount(el, L, win) {
    const doc = el.ownerDocument;
    // On a touch screen one finger scrolls the page past the map (no scroll
    // trap); two fingers move and zoom it, and the +/- buttons still work.
    const coarse = !!(win.matchMedia && win.matchMedia('(pointer: coarse)').matches);
    const map = L.map(el, {
      center: [OFFICE.lat, OFFICE.lon], zoom: 16, minZoom: 9, maxZoom: 18,
      zoomControl: false, scrollWheelZoom: false, dragging: !coarse,
    });
    map.attributionControl.setPrefix('<a href="https://leafletjs.com">Leaflet</a>');
    L.control.zoom({ position: 'topright', zoomInTitle: 'Приблизить', zoomOutTitle: 'Отдалить' }).addTo(map);

    const tiles = L.tileLayer(TILES, { maxZoom: 19, attribution: ATTRIBUTION }).addTo(map);
    let loaded = 0, failed = 0;
    tiles.on('tileload', () => { loaded++; });
    tiles.on('tileerror', () => { failed++; if (!loaded && failed >= 4) showFallback(doc); });

    L.marker([OFFICE.lat, OFFICE.lon], {
      title: OFFICE.name + ' — ' + OFFICE.purpose,
      icon: L.divIcon({ className: 'map-pin', html: PIN, iconSize: [34, 44], iconAnchor: [17, 43], popupAnchor: [0, -40] }),
    }).addTo(map).bindPopup(popupContent(doc, OFFICE), {
      className: 'map-popup', minWidth: 180, maxWidth: 240, autoPanPadding: [24, 24],
    });

    // The wheel zooms only once the visitor is using the map, so scrolling
    // the page past it never zooms it by accident.
    map.on('click focus', () => map.scrollWheelZoom.enable());
    map.on('mouseout blur', () => map.scrollWheelZoom.disable());

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

  // Build the map when the section comes near the screen: no tiles are
  // requested for a visitor who never scrolls to it.
  if (typeof document !== 'undefined') {
    const el = document.getElementById('contactsMap');
    if (el) {
      const start = () => {
        if (!window.L) { showFallback(document); return; }
        try { mount(el, window.L, window); } catch (e) { showFallback(document); }
      };
      if ('IntersectionObserver' in window) {
        const io = new IntersectionObserver(entries => {
          if (entries.some(e => e.isIntersecting)) { io.disconnect(); start(); }
        }, { rootMargin: '300px 0px' });
        io.observe(el);
      } else {
        start();
      }
    }
  }

  return { OFFICE, routeUrl, openUrl, mount };
});
