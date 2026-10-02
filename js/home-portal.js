// js/home-portal.js
//
// The way into the 3D showroom from the home page: the house, «Открыть
// шоурум» and the rooms are plain links to showroom.html (they work without
// this script). The script only makes the step a quiet one -- the page fades
// into the showroom's own graphite, and the showroom opens on that same dark
// ground. No zoom, nothing moves. With «reduce motion» the link simply opens.
(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = factory();
  } else {
    root.HomePortal = factory();
  }
})(typeof window !== 'undefined' ? window : globalThis, function () {

  const FADE_MS = 260;

  // Only a plain left click is taken over: a new tab, a modifier key or a
  // middle click keeps the browser's own behaviour.
  function isPlainClick(e) {
    return e.button === 0 && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey;
  }

  function init(doc, win) {
    const links = [...doc.querySelectorAll('[data-portal]')];
    if (!links.length) return null;
    const reduce = win.matchMedia && win.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) return { links, reduce };
    let veil = null;
    function enter(href) {
      if (!veil) {
        veil = doc.createElement('div');
        veil.className = 'portal-veil';
        veil.setAttribute('aria-hidden', 'true');
        doc.body.appendChild(veil);
      }
      // The veil's opacity 0 is computed first (the read below), so adding
      // the class fades it in rather than switching it on.
      void veil.offsetWidth;
      veil.classList.add('is-on');
      win.setTimeout(() => { win.location.href = href; }, FADE_MS);
    }
    links.forEach(link => link.addEventListener('click', e => {
      if (!isPlainClick(e)) return;
      e.preventDefault();
      enter(link.href);
    }));
    // Back from the showroom (the page may come from the back-forward cache): no veil.
    win.addEventListener('pageshow', () => { if (veil) veil.classList.remove('is-on'); });
    return { links, reduce, enter };
  }

  if (typeof document !== 'undefined' && typeof window !== 'undefined') init(document, window);

  return { FADE_MS, isPlainClick, init };
});
