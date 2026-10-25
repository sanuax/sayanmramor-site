// js/offer-handoff.js
//
// «Получить расчёт» and the two places a request can step out to (2026-10-26, the owner):
// the configurator, to build the piece, and «Готовые изделия», to pick one -- and the way
// back into the same request with the piece in it
// (docs/superpowers/specs/2026-10-26-offer-calculator-link-design.md). This file is the one
// owner of that contract: the site's request (js/offer-form.js), the catalogue
// (js/catalog.js) and the configurator (it loads this very file from /sayanmramor-site/,
// as it loads js/header.js) all go through it.
//
// The site and the configurator are one address (GitHub Pages, and scripts/dev_server.py
// locally), so they share the browser's storage:
//  - the request's answers live in sessionStorage (this tab), with the page it was started on;
//  - the configurator leaves its piece in localStorage, once, for the request to take;
//  - the passport, its preview and an attached file live in IndexedDB.
// Any of these may be missing or throw (a private window, Telegram's browser): then the
// request simply goes on as before. Nothing here sends anything anywhere.
(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = factory();
  } else {
    root.OfferHandoff = factory();
  }
})(typeof window !== 'undefined' ? window : globalThis, function () {

  const HOME = '/sayanmramor-site/index.html';
  const KATALOG = '/sayanmramor-site/katalog.html';
  const CALCULATOR = '/sayanmramor-calculator/sayanmramor-calculator.html';
  const KATALOG_KEY = 'gotovye-izdeliya';
  const TALK_KEY = 'sayan-offer-talk';
  const PIECE_KEY = 'sayan-offer-piece';

  // The site's directions the configurator builds, and its product for each. The other
  // four (spa, hammams, pools, ready pieces) are ordered without it -- by design.
  const CALC_PRODUCT = {
    lestnitsy: 'lestnitsa', panno: 'panno', podokonniki: 'podokonnik', poly: 'pol', steny: 'stena',
    fasady: 'fasad', vannaya: 'stoleshnitsa_vannaya', kuhnya: 'stoleshnitsa_kuhnya', stupeni: 'stupeni', kaminy: 'kaminy',
  };
  // The configurator's own names of them (its product-types.js).
  const CALC_LABEL = {
    lestnitsa: 'Лестницы', panno: 'Панно', podokonnik: 'Подоконники', pol: 'Полы', stena: 'Стены', fasad: 'Фасады',
    stoleshnitsa_vannaya: 'Столешницы в ванную', stoleshnitsa_kuhnya: 'Столешницы на кухню', stupeni: 'Ступени', kaminy: 'Камины',
  };

  function branchOf(siteKey) {
    if (CALC_PRODUCT[siteKey]) return 'calc';
    return siteKey === KATALOG_KEY ? 'katalog' : 'plain';
  }
  const calcUrl = siteKey => CALCULATOR + '?product=' + CALC_PRODUCT[siteKey];
  const editUrl = query => CALCULATOR + '?' + query;

  // As the catalogue writes a price: «37 000 ₽», the sign on the line of its number.
  function formatRub(n) {
    if (typeof n !== 'number' || !Number.isFinite(n)) return 'Цена по запросу';
    return Math.round(n).toLocaleString('ru-RU') + ' ₽';
  }

  function readJson(store, key) {
    try {
      const raw = store && store.getItem(key);
      return raw ? JSON.parse(raw) : null;
    } catch (e) { return null; }
  }
  function writeJson(store, key, value) {
    try { if (store) store.setItem(key, JSON.stringify(value)); } catch (e) { /* the request goes on without it */ }
  }
  function remove(store, key) {
    try { if (store) store.removeItem(key); } catch (e) { /* nothing to clean */ }
  }

  // The request's answers: { page, direction, name, nameSkipped, phone, current, piece, attachmentName }.
  const saveTalk = (store, state) => writeJson(store, TALK_KEY, state);
  function loadTalk(store) {
    const state = readJson(store, TALK_KEY);
    return state && typeof state === 'object' ? state : null;
  }

  // Back to the page the request was started on (the home page or a direction's), at its block.
  function returnUrl(store, query) {
    const state = loadTalk(store);
    const page = state && typeof state.page === 'string' && state.page ? state.page : HOME;
    return page + (query ? '?' + query : '') + '#offer';
  }

  // What the address brings: ?piece=<id> from the catalogue, a passport link (pv) from the configurator.
  function readArrival(search) {
    const params = new URLSearchParams(search || '');
    if (params.get('piece')) return { kind: 'katalog', id: params.get('piece') };
    if (params.has('pv')) return { kind: 'calc', query: String(search).replace(/^\?/, '') };
    return null;
  }

  // The configurator's piece, left for the request: taken once, and only by its own passport
  // link -- an older or another configuration is dropped, never shown.
  const putCalcPiece = (store, piece) => writeJson(store, PIECE_KEY, piece);
  function takeCalcPiece(store, query) {
    const piece = readJson(store, PIECE_KEY);
    remove(store, PIECE_KEY);
    return piece && piece.query === query ? piece : null;
  }

  function catalogPiece(products, id) {
    const p = (products || []).find(x => x && x.id === id);
    if (!p || p.available === false) return null;
    return { kind: 'katalog', id: p.id, name: p.name || '', price: typeof p.price_rub === 'number' ? p.price_rub : null, photo: (p.photos || [])[0] || '' };
  }

  // When the configurator's record is not there: what the address alone says (the stone
  // from the configurator's light index, as the direction pages read it), no sizes, no price.
  function calcPieceFromIndex(query, stones) {
    const params = new URLSearchParams(query);
    const stone = (stones || []).find(s => s && s.id === params.get('stone'));
    return {
      kind: 'calc', query, product: CALC_LABEL[params.get('product')] || '',
      stone: stone ? stone.name : '', stoneImage: stone && stone.image ? '/sayanmramor-calculator/data/' + stone.image : '',
      sizes: '', price: '', priced: false,
    };
  }

  // Files in IndexedDB: 'passport', 'passport-preview', 'attachment'. Every failure is a null.
  const blobs = (function () {
    let opening = null;
    function db() {
      if (!opening) {
        opening = new Promise(resolve => {
          try {
            const req = indexedDB.open('sayan-offer', 1);
            req.onupgradeneeded = () => req.result.createObjectStore('files');
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => resolve(null);
          } catch (e) { resolve(null); }
        });
      }
      return opening;
    }
    function run(mode, act) {
      return db().then(d => new Promise(resolve => {
        if (!d) return resolve(null);
        try {
          const tx = d.transaction('files', mode);
          const req = act(tx.objectStore('files'));
          tx.oncomplete = () => resolve(req.result === undefined ? null : req.result);
          tx.onerror = tx.onabort = () => resolve(null);
        } catch (e) { resolve(null); }
      }));
    }
    return {
      put: (name, blob) => run('readwrite', s => s.put(blob, name)).then(() => undefined),
      get: name => run('readonly', s => s.get(name)),
      remove: name => run('readwrite', s => s.delete(name)).then(() => undefined),
    };
  })();

  // The share sheet with the file where there is one («Сохранить в Файлы», messengers), a
  // download otherwise -- as the configurator saves its passport.
  function saveFile(file) {
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      navigator.share({ files: [file], title: file.name.replace(/\.pdf$/, '') })
        .catch(err => { if (!err || err.name !== 'AbortError') download(file); });
      return;
    }
    download(file);
  }
  function download(file) {
    const url = URL.createObjectURL(file);
    const a = document.createElement('a');
    a.href = url;
    a.download = file.name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  }

  return {
    HOME, KATALOG, CALCULATOR, KATALOG_KEY, CALC_PRODUCT, CALC_LABEL,
    branchOf, calcUrl, editUrl, formatRub, saveTalk, loadTalk, returnUrl, readArrival,
    putCalcPiece, takeCalcPiece, catalogPiece, calcPieceFromIndex, blobs, saveFile,
  };
});
