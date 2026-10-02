// js/masthead.js
//
// The home page's masthead: the name in the middle, the ovals on the right.
// An oval with «+» is a native <details> (it opens without this script, at
// once); the script makes the opening a gesture -- the oval turns into a
// plane of stone that grows out of its own outline (CSS: clip-path from the
// oval's rectangle, on a soft spring), and closes the same way back. One
// plane open at a time; Esc, a click outside, the focus leaving and a link
// inside close it (Esc returns the focus to the oval). The phone's «Меню»
// plane takes the screen and holds the page still behind it. Over a light
// section the masthead turns light. With «reduce motion» the plane simply
// appears.
(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = factory();
  } else {
    root.Masthead = factory();
  }
})(typeof window !== 'undefined' ? window : globalThis, function () {

  const CLOSE_MS = 260;

  // Relative luminance of a computed colour ('rgb(r, g, b)' / 'rgba(...)').
  function luminance(color) {
    const m = String(color).match(/rgba?\(([^)]+)\)/);
    if (!m) return null;
    const [r, g, b, a] = m[1].split(',').map(Number);
    if (a === 0) return null;                       // transparent: look further down
    const lin = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
    return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  }

  // The masthead's tone over a section: light over a light ground.
  function toneOf(color, fallback) {
    const l = luminance(color);
    const lum = l === null ? luminance(fallback) : l;
    return lum !== null && lum > 0.4 ? 'light' : 'dark';
  }

  function init(doc, win) {
    const header = doc.querySelector('[data-mast]');
    if (!header) return null;
    const drops = [...header.querySelectorAll('details.mast-drop')];
    const reduce = win.matchMedia && win.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const timers = new Map();

    drops.forEach(d => d.classList.add('is-ready'));

    function isMenu(d) { return d.classList.contains('mast-menu'); }
    function lock(on) { doc.documentElement.classList.toggle('menu-lock', on); }

    function open(d) {
      drops.forEach(o => { if (o !== d && o.open) close(o, false); });
      clearTimeout(timers.get(d));
      const pill = d.querySelector('summary').getBoundingClientRect();
      d.style.setProperty('--pill-w', pill.width.toFixed(1) + 'px');
      d.open = true;
      void d.offsetWidth;                            // the closed outline is laid out first
      d.classList.add('is-open');
      header.classList.add('has-open');
      if (isMenu(d)) lock(true);
    }

    function close(d, returnFocus) {
      if (!d.open) return;
      d.classList.remove('is-open');
      if (isMenu(d)) lock(false);
      clearTimeout(timers.get(d));
      timers.set(d, win.setTimeout(() => {
        if (d.classList.contains('is-open')) return;
        d.open = false;
        if (!openOne()) header.classList.remove('has-open');
      }, reduce ? 0 : CLOSE_MS));
      if (returnFocus) d.querySelector('summary').focus();
    }

    function openOne() { return drops.find(d => d.classList.contains('is-open')); }

    drops.forEach(d => {
      d.querySelector('summary').addEventListener('click', e => {
        e.preventDefault();
        if (d.classList.contains('is-open')) close(d, false); else open(d);
      });
      d.addEventListener('focusout', e => {
        if (d.classList.contains('is-open') && e.relatedTarget && !d.contains(e.relatedTarget)) close(d, false);
      });
      d.querySelectorAll('.mast-sheet a').forEach(a => a.addEventListener('click', () => close(d, false)));
    });
    doc.addEventListener('keydown', e => {
      const d = openOne();
      if (e.key === 'Escape' && d) close(d, true);
    });
    doc.addEventListener('click', e => {
      const d = openOne();
      if (d && !d.contains(e.target)) close(d, false);
    });
    win.addEventListener('resize', () => { const d = openOne(); if (d) close(d, false); });

    // The tone: what lies under the masthead's lower edge.
    const body = doc.body;
    const sections = [...doc.querySelectorAll('main > section, footer')];
    // A one-pixel line along the masthead's lower edge; drawn again when the window changes.
    let io = null;
    function watchTone() {
      if (!win.IntersectionObserver || !sections.length) return;
      if (io) io.disconnect();
      const h = header.offsetHeight || 64;
      const seen = new Map();
      io = new win.IntersectionObserver(entries => {
        entries.forEach(en => seen.set(en.target, en.isIntersecting));
        const under = sections.find(s => seen.get(s));
        if (!under) return;
        const tone = toneOf(win.getComputedStyle(under).backgroundColor, win.getComputedStyle(body).backgroundColor);
        header.classList.toggle('is-light', tone === 'light');
      }, { rootMargin: `-${h}px 0px -${Math.max(0, win.innerHeight - h - 1)}px 0px` });
      sections.forEach(s => io.observe(s));
    }
    watchTone();
    let toneFrame = 0;
    win.addEventListener('resize', () => {
      if (toneFrame) return;
      toneFrame = win.requestAnimationFrame(() => { toneFrame = 0; watchTone(); });
    });

    return { header, drops, open, close };
  }

  if (typeof document !== 'undefined' && typeof window !== 'undefined') init(document, window);

  return { CLOSE_MS, luminance, toneOf, init };
});
