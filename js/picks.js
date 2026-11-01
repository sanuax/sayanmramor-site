// js/picks.js
//
// «Моя подборка»: stones and ready pieces marked with a heart, with no account and no server.
// The list lives in this browser's localStorage, and a link carries it to someone else
// (podborka.html?s=<stone ids>&p=<piece ids>). The site and the configurator are one address,
// so they share the list; the configurator loads this very file from /sayanmramor-site/.
// Only ids are kept: names, photos and prices are always read fresh from the catalogues.
// Storage may be missing or throw (a private window, Telegram's browser): then the hearts
// still work until the page is left.
(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = factory();
  } else {
    root.Picks = factory();
  }
})(typeof window !== 'undefined' ? window : globalThis, function () {

  const KEY = 'sayan-picks';
  const PAGE = '/sayanmramor-site/podborka.html';
  const STONES = 'stones';
  const PIECES = 'pieces';
  const HEART = '<svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true"><path d="M19 14c1.490-1.460 3-3.210 3-5.500A5.500 5.500 0 0 0 16.500 3c-1.760 0-3 .5-4.500 2-1.500-1.500-2.740-2-4.500-2A5.500 5.500 0 0 0 2 8.500c0 2.300 1.500 4.050 3 5.500l7 7Z"/></svg>';

  const empty = () => ({ [STONES]: [], [PIECES]: [] });
  const ids = list => (Array.isArray(list) ? [...new Set(list.filter(id => typeof id === 'string' && id))] : []);
  let held = null;   // this page's list, only while the browser's storage does not hold it

  function storage(win) {
    try { return win.localStorage || null; } catch (e) { return null; }
  }
  function read(store) {
    if (held) return { [STONES]: [...held[STONES]], [PIECES]: [...held[PIECES]] };
    try {
      const saved = store ? JSON.parse(store.getItem(KEY)) : null;
      return { [STONES]: ids(saved && saved[STONES]), [PIECES]: ids(saved && saved[PIECES]) };
    } catch (e) {
      return empty();
    }
  }
  function write(store, picks) {
    try {
      store.setItem(KEY, JSON.stringify(picks));
      held = null;
    } catch (e) {
      held = picks;
    }
  }

  const has = (picks, kind, id) => picks[kind].includes(id);
  const total = picks => picks[STONES].length + picks[PIECES].length;

  // Marks or unmarks one; says whether it is marked now.
  function toggle(store, kind, id) {
    const picks = read(store);
    const on = !has(picks, kind, id);
    picks[kind] = on ? picks[kind].concat(id) : picks[kind].filter(x => x !== id);
    write(store, picks);
    return on;
  }
  // Someone's list into this browser's: nothing already here is lost or moved.
  function merge(store, other) {
    const picks = read(store);
    write(store, { [STONES]: ids(picks[STONES].concat(other[STONES])), [PIECES]: ids(picks[PIECES].concat(other[PIECES])) });
  }
  function removeMissing(store, kind, known) {
    const picks = read(store);
    picks[kind] = picks[kind].filter(id => known.includes(id));
    write(store, picks);
  }

  // The list as an address, and back. An address with neither list is not a shared list.
  function sharePath(picks) {
    const part = (name, list) => (list.length ? name + '=' + list.map(encodeURIComponent).join(',') : '');
    const query = [part('s', picks[STONES]), part('p', picks[PIECES])].filter(Boolean).join('&');
    return PAGE + (query ? '?' + query : '');
  }
  function readShared(search) {
    const params = new URLSearchParams(search || '');
    const list = name => ids((params.get(name) || '').split(','));
    const picks = { [STONES]: list('s'), [PIECES]: list('p') };
    return total(picks) ? picks : null;
  }

  // «3 камня», «1 изделие», «3 камня, 1 изделие».
  function word(n, one, few, many) {
    const tens = n % 100, ones = n % 10;
    return n + ' ' + (ones === 1 && tens !== 11 ? one : ones >= 2 && ones <= 4 && (tens < 10 || tens >= 20) ? few : many);
  }
  function label(picks) {
    return [
      picks[STONES].length ? word(picks[STONES].length, 'камень', 'камня', 'камней') : '',
      picks[PIECES].length ? word(picks[PIECES].length, 'изделие', 'изделия', 'изделий') : '',
    ].filter(Boolean).join(', ');
  }

  // What a request carries: the list on the screen if this is someone's shared one, else this
  // browser's; null when there is nothing to carry.
  function forRequest(location, store) {
    const shared = location && location.pathname === PAGE ? readShared(location.search) : null;
    const picks = shared || read(store);
    return total(picks) ? picks : null;
  }
  function requestText(summary, link) {
    return (summary ? 'Заявка: ' + summary + '\n' : '') + 'Подборка: ' + link;
  }
  const telegramUrl = (base, text) => base + '?text=' + encodeURIComponent(text);

  // The heart: a button of its own, so it never presses the card it lies on.
  function heart(doc, kind, id, name) {
    const button = doc.createElement('button');
    button.type = 'button';
    button.className = 'pick-heart';
    button.dataset.kind = kind;
    button.dataset.id = id;
    button.dataset.name = name || '';
    button.innerHTML = HEART;
    button.addEventListener('animationend', e => { if (e.target === button) button.classList.remove('just-marked'); });
    paintHeart(button, read(storage(doc.defaultView)));
    button.addEventListener('click', e => {
      e.preventDefault();
      e.stopPropagation();
      // The little jump answers the press only: a heart that is simply marked stands still.
      button.classList.toggle('just-marked', toggle(storage(doc.defaultView), kind, id));
      sync(doc);
    });
    return button;
  }
  function paintHeart(button, picks) {
    const on = has(picks, button.dataset.kind, button.dataset.id);
    button.setAttribute('aria-pressed', String(on));
    button.setAttribute('aria-label', (on ? 'Убрать из подборки: ' : 'В подборку: ') + button.dataset.name);
    button.title = on ? 'Убрать из подборки' : 'В подборку';
  }
  // The way to the list: always there while stones are being chosen, with the count once there is
  // one. `kind` counts only that part of the list. `button`: a button for the caller to act on, for
  // a place that must not be left, such as the calculator with a piece half built in it.
  function link(doc, options) {
    const { kind, button } = options || {};
    const a = doc.createElement(button ? 'button' : 'a');
    a.className = 'pick-link';
    if (button) a.type = 'button';
    else a.href = PAGE;
    if (kind) a.dataset.kind = kind;
    a.innerHTML = HEART + '<span class="pick-link-words">Моя подборка</span><b class="pick-link-count"></b>';
    paintLink(a, read(storage(doc.defaultView)));
    return a;
  }
  function paintLink(a, picks) {
    const n = a.dataset.kind ? picks[a.dataset.kind].length : total(picks);
    const count = a.lastChild;
    if (count.textContent !== String(n || '')) {
      a.classList.remove('just-counted');
      if (a.isConnected && n) { void a.offsetWidth; a.classList.add('just-counted'); }
    }
    count.textContent = n || '';
    count.hidden = !n;
    a.classList.toggle('has-picks', n > 0);
    const shown = a.dataset.kind ? { [STONES]: [], [PIECES]: [], [a.dataset.kind]: picks[a.dataset.kind] } : picks;
    a.setAttribute('aria-label', n ? 'Моя подборка: ' + label(shown) : 'Моя подборка');
  }
  // Everything on the page after a change, here or in another tab, or on the way back to this page.
  function sync(doc) {
    const picks = read(storage(doc.defaultView));
    doc.querySelectorAll('.pick-heart').forEach(b => paintHeart(b, picks));
    doc.querySelectorAll('.pick-link').forEach(a => paintLink(a, picks));
    doc.dispatchEvent(new CustomEvent('picks-change'));
  }
  if (typeof document !== 'undefined' && typeof window !== 'undefined') {
    window.addEventListener('storage', e => { if (e.key === KEY) sync(document); });
    window.addEventListener('pageshow', e => { if (e.persisted) sync(document); });
  }

  return {
    PAGE, STONES, PIECES, storage, read, has, total, toggle, merge, removeMissing, sharePath, readShared, label,
    forRequest, requestText, telegramUrl, heart, link, sync,
  };
});
