// js/consent.js
//
// The cookie notice: on the very first visit a small card at the foot of the screen says
// that the site keeps cookies and settings in this browser and links the privacy policy;
// «Принять» puts it away for good (the owner, 2026-11-08). It waits for the first-visit
// intro (js/intro.js, <html class="si-on">) to leave, so the two never stand together.
// The answer lives in localStorage (one address for the site, the showroom and the
// configurator, so one «Принять» covers them all). VERSION goes up when the policy changes
// enough to ask again. No storage (a private window, Telegram's browser): the answer holds
// for this tab only.
// Styles: css/consent.css (linked by every page, the showroom and the configurator).
(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = factory();
  } else {
    root.Consent = factory();
  }
})(typeof window !== 'undefined' ? window : globalThis, function () {

  const KEY = 'sayan-consent';
  const VERSION = '1';
  const POLICY = '/sayanmramor-site/privacy.html';
  const TEXT_BEFORE = 'Сайт использует файлы cookie. Оставаясь на сайте, вы соглашаетесь с их использованием и с ';
  const LINK_TEXT = 'политикой конфиденциальности';
  const BUTTON = 'Принять';

  function stores(win) {
    const out = [];
    ['localStorage', 'sessionStorage'].forEach(name => {
      try { if (win[name]) out.push(win[name]); } catch (e) { /* blocked */ }
    });
    return out;
  }

  // Was the notice accepted (this version) in this browser?
  function accepted(win) {
    return stores(win).some(store => {
      try {
        const saved = JSON.parse(store.getItem(KEY) || 'null');
        return !!saved && saved.v === VERSION;
      } catch (e) { return false; }
    });
  }

  function remember(win, now) {
    const value = JSON.stringify({ v: VERSION, at: new Date(now || Date.now()).toISOString() });
    for (const store of stores(win)) {
      try { store.setItem(KEY, value); return true; } catch (e) { /* full or blocked: try the next */ }
    }
    return false;
  }

  function build(doc) {
    const box = doc.createElement('section');
    box.className = 'cookie-note';
    box.setAttribute('role', 'region');
    box.setAttribute('aria-label', 'Файлы cookie');
    const text = doc.createElement('p');
    text.className = 'cookie-note-text';
    const link = doc.createElement('a');
    link.href = POLICY;
    link.textContent = LINK_TEXT;
    text.append(doc.createTextNode(TEXT_BEFORE), link, doc.createTextNode('.'));
    const ok = doc.createElement('button');
    ok.type = 'button';
    ok.className = 'cookie-note-ok';
    ok.textContent = BUTTON;
    box.append(text, ok);
    return { box, ok };
  }

  function show(doc, win) {
    if (doc.querySelector('.cookie-note')) return;
    const { box, ok } = build(doc);
    doc.body.appendChild(box);
    // one frame in the page first, so the entrance runs from its start
    win.requestAnimationFrame(() => win.requestAnimationFrame(() => box.classList.add('is-shown')));
    ok.addEventListener('click', () => {
      remember(win);
      box.classList.remove('is-shown');
      box.classList.add('is-leaving');
      let gone = false;
      const remove = () => { if (!gone) { gone = true; box.remove(); } };
      box.addEventListener('transitionend', e => { if (e.target === box) remove(); });
      win.setTimeout(remove, 600);
    });
  }

  // Show once the intro has left (or at once when there is none).
  function whenIntroGone(doc, win, then) {
    const html = doc.documentElement;
    if (!html.classList.contains('si-on')) { then(); return; }
    const watch = new win.MutationObserver(() => {
      if (html.classList.contains('si-on')) return;
      watch.disconnect();
      win.setTimeout(then, 400);
    });
    watch.observe(html, { attributes: true, attributeFilter: ['class'] });
  }

  function start(doc, win) {
    if (accepted(win)) return;
    const go = () => whenIntroGone(doc, win, () => show(doc, win));
    if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', go, { once: true });
    else go();
  }

  if (typeof document !== 'undefined' && typeof window !== 'undefined') start(document, window);

  return { KEY, VERSION, POLICY, accepted, remember, build, start };
});
