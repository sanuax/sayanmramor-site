// js/home-hero.js
//
// The home page's hero: from the slab to the object. While the scene is held
// (CSS sticky), scrolling moves one number from 0 to 1 and the scene follows
// it: the great name rises into the masthead, the words step back, the slab
// lifts from the floor, its dimensions are drawn, and as it stands up a cut
// opens in it and widens to its edges: through it, the finished staircase, the closing action appears. The number follows the
// scroll with a little damping, so a mouse wheel's steps become one calm
// movement; nothing runs once it has arrived. Only CSS custom properties are
// written (transform and opacity do the rest).
// Phones, «reduce motion» and no JavaScript get the scene standing still
// (data-mode="static", the CSS default); there the masthead's own name
// appears once the great one has scrolled away.
(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = factory();
  } else {
    root.HomeHero = factory();
  }
})(typeof window !== 'undefined' ? window : globalThis, function () {

  const MIN_WIDTH = 768;      // narrower: the still scene
  const MIN_HEIGHT = 560;
  const DAMPING = 0.14;       // share of the remaining way covered each frame
  const TILT = 62;            // degrees: the slab lying on the floor
  const SCALE = 0.82;
  const TURN = -6;          // degrees: the slab lies at a slight angle on the floor, not square to you
  const LIT_MS = 3000;      // the slab is shown by then whatever its photograph does

  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const smooth = v => { v = clamp(v); return v * v * (3 - 2 * v); };
  const span = (p, a, b) => smooth((p - a) / (b - a));

  // Everything the scene shows at progress p (0..1). rise: px the slab lies
  // below its place at p = 0; mark: { dy, s } the great name's way into the masthead.
  function stage(p, rise, mark) {
    const k = span(p, 0, 0.9);                   // the slab's one movement
    const dock = span(p, 0, 0.16);
    const t = TILT * (1 - k);
    return {
      t,
      r: TURN * (1 - k),
      shade: 1 - span(p, 0.5, 0.86),
      y: rise * (1 - k),
      s: SCALE - (SCALE - 1) * k,
      d: span(p, 0.27, 0.48),                     // dimensions drawn
      dd: 1 - span(p, 0.5, 0.58),                 // ...and put away before the slab opens
      cut: span(p, 0.56, 0.9),                    // the cut through which the object is seen
      edge: span(p, 0.56, 0.6) * (1 - span(p, 0.84, 0.9)),
      copy: 1 - span(p, 0.03, 0.16),
      cap: span(p, 0.15, 0.22),
      fin: span(p, 0.86, 0.95),
      // The name grows smaller first and rises after, so it never crosses the ovals.
      mkY: mark.dy * dock * dock,
      mkS: 1 - (1 - mark.s) * (1 - (1 - dock) * (1 - dock)),
      mkO: 1 - span(dock, 0.86, 1),
      logo: span(dock, 0.86, 1),
      step: p < 0.27 ? 1 : p < 0.56 ? 2 : 3,
    };
  }

  function init(doc, win) {
    const section = doc.querySelector('[data-hero]');
    if (!section) return null;
    const header = doc.querySelector('[data-mast]');
    const word = section.querySelector('.hero-mark-word');
    const slab = section.querySelector('.hero-slab');
    const logo = header && header.querySelector('.mast-logo');
    const mq = win.matchMedia ? win.matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };
    let mode = '';
    let geo = null, target = 0, current = 0, frame = 0, observer = null;

    function setLogo(v) { if (header) header.style.setProperty('--logo', String(v)); }

    function wantScrub() {
      return !mq.matches && win.innerWidth >= MIN_WIDTH && win.innerHeight >= MIN_HEIGHT;
    }

    function measure() {
      const stageEl = section.querySelector('.hero-stage');
      // The scene is held from the moment its top reaches the masthead's lower edge.
      const top = section.getBoundingClientRect().top + win.scrollY - (header ? header.offsetHeight : 0);
      const travel = Math.max(1, section.offsetHeight - stageEl.offsetHeight);
      const h = stageEl.offsetHeight;
      // The slab at p = 0: its middle at 63 % of the stage, lying (its turned near edge clear of the stage's foot).
      const rise = h * 0.63 - (slab.offsetTop + slab.offsetHeight / 2);
      // The great name, to the masthead's name: same centre, same top.
      const lr = logo ? logo.getBoundingClientRect() : null;
      const markTop = word.parentNode.getBoundingClientRect().top + word.offsetTop;
      const mark = lr ? { dy: lr.top - markTop, s: logo.offsetWidth / word.offsetWidth } : { dy: 0, s: 1 };
      geo = { top, travel, rise, mark };
    }

    function apply(p) {
      const v = stage(p, geo.rise, geo.mark);
      const st = section.style;
      st.setProperty('--t', v.t.toFixed(3) + 'deg');
      st.setProperty('--r', v.r.toFixed(3) + 'deg');
      st.setProperty('--shade', v.shade.toFixed(4));
      st.setProperty('--y', v.y.toFixed(1) + 'px');
      st.setProperty('--s', v.s.toFixed(4));
      st.setProperty('--d', v.d.toFixed(4));
      st.setProperty('--dd', v.dd.toFixed(4));
      st.setProperty('--cut', v.cut.toFixed(4));
      st.setProperty('--edge', v.edge.toFixed(4));
      st.setProperty('--copy', v.copy.toFixed(4));
      st.setProperty('--cap', v.cap.toFixed(4));
      st.setProperty('--fin', v.fin.toFixed(4));
      st.setProperty('--mk-y', v.mkY.toFixed(2) + 'px');
      st.setProperty('--mk-s', v.mkS.toFixed(5));
      st.setProperty('--mk-o', v.mkO.toFixed(4));
      setLogo(v.logo.toFixed(4));
      if (section.dataset.step !== String(v.step)) section.dataset.step = String(v.step);
      section.classList.toggle('copy-gone', v.copy < 0.02);
      section.classList.toggle('is-told', v.cap > 0.02);
      section.classList.toggle('is-made', v.cut > 0.9);
      section.classList.toggle('is-final', v.fin > 0.5);
    }

    function tick() {
      frame = 0;
      const diff = target - current;
      current = Math.abs(diff) < 0.0004 ? target : current + diff * DAMPING;
      apply(current);
      if (current !== target) frame = win.requestAnimationFrame(tick);
    }

    function onScroll() {
      target = clamp((win.scrollY - geo.top) / geo.travel);
      if (!frame) frame = win.requestAnimationFrame(tick);
    }

    function setMode() {
      const next = wantScrub() ? 'scrub' : 'static';
      if (next === mode) { if (mode === 'scrub') { measure(); onScroll(); } return; }
      mode = next;
      section.dataset.mode = mode;
      win.removeEventListener('scroll', onScroll);
      if (observer) { observer.disconnect(); observer = null; }
      if (mode === 'scrub') {
        measure();
        target = current = clamp((win.scrollY - geo.top) / geo.travel);
        apply(current);
        win.addEventListener('scroll', onScroll, { passive: true });
      } else {
        ['--t', '--r', '--shade', '--y', '--s', '--d', '--dd', '--cut', '--edge', '--copy', '--cap', '--fin', '--mk-y', '--mk-s', '--mk-o'].forEach(n => section.style.removeProperty(n));
        delete section.dataset.step;
        // The still scene: the masthead's name appears once the great one is out of sight.
        if (win.IntersectionObserver) {
          const h = header ? header.offsetHeight : 0;
          observer = new win.IntersectionObserver(([en]) => setLogo(en.isIntersecting ? 0 : 1), { rootMargin: `-${h}px 0px 0px 0px` });
          observer.observe(word);
        } else {
          setLogo(1);
        }
      }
    }

    let resizeFrame = 0;
    win.addEventListener('resize', () => {
      if (resizeFrame) return;
      resizeFrame = win.requestAnimationFrame(() => { resizeFrame = 0; setMode(); });
    });
    if (mq.addEventListener) mq.addEventListener('change', setMode);
    // Fonts and the first layout may still move the name; measure again once everything has loaded.
    win.addEventListener('load', () => { if (mode === 'scrub') { measure(); onScroll(); } });
    // The slab is shown once its photograph is decoded (a large image in a 3D
    // layer would otherwise be painted late); never later than LIT_MS.
    const stone = section.querySelector('.hero-stone');
    const lit = () => section.classList.add('is-lit');
    win.setTimeout(lit, LIT_MS);
    if (stone && stone.decode) stone.decode().then(lit, lit); else lit();
    setMode();
    return { section, get mode() { return mode; } };
  }

  if (typeof document !== 'undefined' && typeof window !== 'undefined') init(document, window);

  return { MIN_WIDTH, MIN_HEIGHT, TILT, SCALE, TURN, clamp, smooth, stage, init };
});
