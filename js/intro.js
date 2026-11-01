// js/intro.js
//
// The first moment on the site (2026-11-03, the owner: fonts and the home page did not come at once).
// A slab of black marble fills the screen. A white vein runs across it and is the ridge of the
// Sayan mountains; finer veins leave it; «САЯНМРАМОР» rises under it. When the fonts and the
// first photo are ready, the slab parts along the ridge and the name settles into the header.
//
// In <head>, without defer, so the slab is there before the first paint. Everything it needs is
// in this file: the letters are outlines (the logo's Unbounded, weight 800), so no font has to
// load for them, and the styles do not wait for a stylesheet. Once a session in a tab: not on a
// way in from a page of this address, not back or on reload, not to an anchor, not with reduced
// motion. A press, a key or the wheel ends it at once, and it never stays past MAX_MS.
(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = factory();
  } else {
    root.SiteIntro = factory();
  }
})(typeof window !== 'undefined' ? window : globalThis, function () {

  const KEY = 'sayan-intro-seen';
  const NAME = 'САЯНМРАМОР';
  // Outlines in 1/1000 em, y down, the top of the capitals at 0; [path, advance].
  const GLYPHS = {
    'А': ['M227 615V429H741V615ZM642 0 978 750H729L457 101H520L247 750H-1L334 0Z', 977],
    'М': ['M1191 0V750H969V86L1015 91L744 750H512L240 93L286 87V750H65V0H424L671 627H586L831 0Z', 1255],
    'Н': ['M65 0H298V750H65ZM649 0H882V750H649ZM196 265H743V471H196Z', 947],
    'О': ['M485 767Q350 767 249 718Q147 669 91 581Q34 493 34 375Q34 257 91 169Q147 81 249 32Q350 -17 485 -17Q620 -17 722 32Q823 81 880 169Q936 257 936 375Q936 493 880 581Q823 669 722 718Q620 767 485 767ZM485 560Q552 560 601 537Q649 515 675 474Q701 432 701 375Q701 318 675 276Q649 235 601 213Q552 190 485 190Q418 190 370 213Q321 235 295 276Q269 318 269 375Q269 432 295 474Q321 515 370 537Q418 560 485 560Z', 970],
    'Р': ['M494 0Q592 0 662 33Q733 66 770 125Q807 185 807 266Q807 346 770 406Q733 466 662 499Q592 532 494 532H173V348H479Q523 348 548 326Q572 304 572 266Q572 226 548 205Q523 184 479 184H193L298 78V750H65V0Z', 825],
    'С': ['M913 431Q901 531 843 607Q786 683 691 725Q597 767 475 767Q343 767 244 718Q145 669 90 581Q35 493 35 375Q35 257 90 169Q145 81 244 32Q343 -17 475 -17Q597 -17 691 25Q786 67 843 143Q901 218 913 319H679Q669 276 643 246Q616 215 574 199Q532 182 475 182Q411 182 365 205Q319 228 294 272Q269 315 269 375Q269 435 294 478Q319 521 365 544Q411 568 475 568Q532 568 574 552Q616 537 643 506Q669 475 679 431Z', 942],
    'Я': ['M646 327V490H338L337 485Q249 485 183 456Q117 426 81 372Q44 318 44 246Q44 172 81 117Q117 62 183 31Q249 0 337 0H807V750H574V60L679 165H372Q328 165 303 186Q278 207 278 246Q278 285 303 306Q328 327 372 327ZM536 399 290 750H23L278 399Z', 872],
  };
  const TRACKING = 120;           // the logo's letter-spacing, 0.12em
  const CAP = 750;
  // The ridge, as parts of the screen's width and height.
  const PEAKS = [[0, 0.56], [0.08, 0.5], [0.14, 0.53], [0.22, 0.43], [0.29, 0.48], [0.36, 0.38], [0.42, 0.43], [0.5, 0.29], [0.56, 0.36], [0.62, 0.31], [0.69, 0.41], [0.76, 0.37], [0.84, 0.47], [0.92, 0.43], [1, 0.52]];
  const EASE_DRAW = 'cubic-bezier(0.65, 0, 0.35, 1)';
  const EASE_OUT = 'cubic-bezier(0.23, 1, 0.32, 1)';
  const EASE_OPEN = 'cubic-bezier(0.76, 0, 0.24, 1)';
  const MIN_MS = 1750;            // the drawing has finished by then
  const CAP_MS = 3400;            // the slab opens by then, ready or not
  const OPEN_MS = 950;
  const MAX_MS = 6000;

  function shouldPlay({ reduced, canAnimate, hash, navigationType, seen, fromThisAddress }) {
    return !reduced && !!canAnimate && !hash && navigationType !== 'back_forward' && navigationType !== 'reload' && !seen && !fromThisAddress;
  }

  // The same «random» every time: the same mountains, the same veins.
  function random(seed) {
    let a = seed >>> 0;
    return () => {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // The peaks broken twice between each other, as a real ridge is: x always grows, from edge to edge.
  function ridgePoints(w, h) {
    const rnd = random(7);
    let points = PEAKS.map(([x, y]) => [x * w, y * h]);
    [0.16, 0.1].forEach(rough => {
      const next = [points[0]];
      for (let i = 1; i < points.length; i++) {
        const [x0, y0] = points[i - 1], [x1, y1] = points[i];
        next.push([x0 + (x1 - x0) * (0.38 + rnd() * 0.24), (y0 + y1) / 2 + (rnd() - 0.5) * Math.hypot(x1 - x0, y1 - y0) * rough * 2], points[i]);
      }
      points = next;
    });
    return points.map(([x, y]) => [Math.round(x * 10) / 10, Math.round(y * 10) / 10]);
  }

  const line = points => points.map(([x, y]) => x + 'px ' + y + 'px').join(',');
  // The slab's two halves: their common edge is the ridge.
  const upperClip = points => 'polygon(0 0,100% 0,' + line(points.slice().reverse()) + ')';
  const lowerClip = points => 'polygon(' + line(points) + ',100% 100%,0 100%)';

  // A vein leaves the ridge and wanders off, thinner and fainter the shorter it is.
  function vein(rnd, from, reach, direction, drift) {
    const out = [from];
    let [x, y] = from;
    const steps = 5 + Math.floor(rnd() * 5);
    for (let i = 0; i < steps; i++) {
      x += drift * reach / steps + (rnd() - 0.5) * reach * 0.09;
      y += direction * (reach / steps) * (0.55 + rnd() * 0.5);
      out.push([Math.round(x), Math.round(y)]);
    }
    return out;
  }
  function veins(w, h, points) {
    const rnd = random(23);
    const pick = t => points[Math.floor(t * (points.length - 1))];
    const reach = Math.max(w, h);
    const list = [];
    [[0.07, 0.5], [0.2, -0.35], [0.31, 0.7], [0.44, -0.55], [0.58, 0.5], [0.71, -0.4], [0.83, 0.55], [0.95, -0.7]].forEach(([t, drift], i) => {
      list.push({ part: 'down', points: vein(rnd, pick(t), reach * (0.5 + rnd() * 0.5), 1, drift), width: i % 3 === 0 ? 1.3 : 0.8, alpha: i % 3 === 0 ? 0.62 : 0.34, gold: i % 4 === 2 });
    });
    [[0.14, 0.6], [0.5, -0.5], [0.76, 0.45]].forEach(([t, drift]) => {
      list.push({ part: 'up', points: vein(rnd, pick(t), reach * 0.45, -1, drift), width: 0.7, alpha: 0.24, gold: false });
    });
    return list;
  }

  const STYLE = `
    html.si-on .site-logo { visibility: hidden; }
    #site-intro { position: fixed; inset: 0; z-index: 2147483000; overflow: hidden; cursor: default; -webkit-user-select: none; user-select: none; }
    #site-intro .si-part { position: absolute; left: 0; top: 0; width: 100%; height: 100lvh; will-change: transform;
      background: radial-gradient(120% 90% at 50% 38%, #232826 0%, #151917 52%, #0d100e 100%); }
    #site-intro svg { display: block; overflow: visible; }
    #site-intro .si-lines { position: absolute; left: 0; top: 0; }
    #site-intro .si-lines path { fill: none; stroke-linejoin: round; stroke-linecap: round; }
    #site-intro .si-name { position: absolute; left: 0; top: 0; transform-origin: 0 0; fill: #f3f1eb; overflow: hidden; will-change: transform; }
  `;

  const SVG = 'http://www.w3.org/2000/svg';
  function svgEl(doc, tag, attrs) {
    const node = doc.createElementNS(SVG, tag);
    Object.keys(attrs || {}).forEach(k => node.setAttribute(k, attrs[k]));
    return node;
  }
  const pathOf = points => 'M' + points.map(p => p.join(' ')).join('L');

  function play(doc, win) {
    const root = doc.documentElement;
    const w = win.innerWidth, h = win.innerHeight;
    const ridge = ridgePoints(w, h);

    const style = doc.createElement('style');
    style.textContent = STYLE;
    doc.head.appendChild(style);

    const box = doc.createElement('div');
    box.id = 'site-intro';
    box.setAttribute('aria-hidden', 'true');
    const part = clip => {
      const div = doc.createElement('div');
      div.className = 'si-part';
      div.style.clipPath = clip;
      const lines = svgEl(doc, 'svg', { class: 'si-lines', width: w, height: h, viewBox: '0 0 ' + w + ' ' + h });
      div.appendChild(lines);
      box.appendChild(div);
      return { div, lines };
    };
    const up = part(upperClip(ridge));
    const down = part(lowerClip(ridge));

    const drawn = [];
    const addLine = (host, points, stroke, width) => {
      const node = svgEl(doc, 'path', { d: pathOf(points), stroke, 'stroke-width': width });
      host.appendChild(node);
      drawn.push(node);
      return node;
    };
    const fine = veins(w, h, ridge).map(v => ({
      v, node: addLine(v.part === 'up' ? up.lines : down.lines, v.points, v.gold ? '#c9a86a' : '#ece8df', v.width),
    }));
    const crest = addLine(down.lines, ridge, '#f6f4ee', 1.8);

    // The name: letter by letter, each rising from behind the frame's lower edge.
    const fontSize = Math.max(21, Math.min(58, w * 0.052));
    const scale = fontSize / 1000;
    const name = svgEl(doc, 'svg', { class: 'si-name' });
    const letters = [];
    let x = 0;
    NAME.split('').forEach(ch => {
      const g = svgEl(doc, 'g');
      g.appendChild(svgEl(doc, 'path', { d: GLYPHS[ch][0], transform: 'translate(' + x + ' 0)' }));
      name.appendChild(g);
      letters.push(g);
      x += GLYPHS[ch][1] + TRACKING;
    });
    const nameUnits = x - TRACKING;
    const nameW = nameUnits * scale;
    name.setAttribute('viewBox', '-5 -20 ' + (nameUnits + 10) + ' ' + (CAP + 40));
    name.setAttribute('width', (nameUnits + 10) * scale);
    name.setAttribute('height', (CAP + 40) * scale);
    const nameX = (w - nameW) / 2 - 5 * scale;
    const nameY = Math.round(h * 0.62) - 20 * scale;
    name.style.transform = 'translate(' + nameX + 'px,' + nameY + 'px)';
    box.appendChild(name);

    root.classList.add('si-on');
    root.appendChild(box);

    // ---- the drawing
    const anim = (node, keyframes, options) => node.animate(keyframes, Object.assign({ fill: 'both' }, options));
    const draw = (node, delay, duration, opacity) => {
      const length = node.getTotalLength();
      node.style.strokeDasharray = length + ' ' + (length + 1);
      anim(node, [{ strokeDashoffset: length, opacity }, { strokeDashoffset: 0, opacity }], { delay, duration, easing: EASE_DRAW });
    };
    draw(crest, 0, 1100, 1);
    fine.forEach(({ v, node }, i) => draw(node, 420 + i * 65, 800, v.alpha));
    letters.forEach((g, i) => anim(g, [{ transform: 'translateY(' + (CAP + 60) + 'px)' }, { transform: 'translateY(0)' }], { delay: 640 + i * 42, duration: 620, easing: EASE_OUT }));

    // ---- the end
    let ended = false;
    let startWidth = w;
    const timers = [];
    const listeners = ['pointerdown', 'keydown', 'wheel', 'touchstart', 'pagehide'];
    const remove = () => {
      box.remove();
      style.remove();
      root.classList.remove('si-on');
    };
    const end = () => {
      if (ended) return;
      ended = true;
      timers.forEach(t => win.clearTimeout(t));
      listeners.forEach(type => win.removeEventListener(type, cut, true));
      win.removeEventListener('resize', onResize);
    };
    // Cut short: it steps aside at once. The press that did it does not reach what lay under the slab.
    function cut() {
      if (ended) return;
      end();
      box.style.pointerEvents = 'none';
      box.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 180, easing: 'ease-out', fill: 'both' }).onfinish = remove;
    }
    function onResize() { if (Math.abs(win.innerWidth - startWidth) > 2) cut(); }
    listeners.forEach(type => win.addEventListener(type, cut, { capture: true, passive: true }));
    win.addEventListener('resize', onResize);

    let opened = false;
    function open() {
      if (opened || ended) return;
      opened = true;
      box.style.pointerEvents = 'none';
      anim(up.div, [{ transform: 'translateY(0)' }, { transform: 'translateY(-100%)' }], { duration: OPEN_MS, easing: EASE_OPEN });
      anim(down.div, [{ transform: 'translateY(0)' }, { transform: 'translateY(100%)' }], { duration: OPEN_MS, easing: EASE_OPEN });
      // The name lands on the header's: same letters, same size, same line.
      const logo = doc.querySelector('.site-logo');
      const range = logo && doc.createRange();
      if (range) range.selectNodeContents(logo);
      const rect = range && range.getBoundingClientRect();
      const from = 'translate(' + nameX + 'px,' + nameY + 'px)';
      let flight;
      if (rect && rect.width) {
        const css = win.getComputedStyle(logo);
        const size = parseFloat(css.fontSize);
        const s = size / fontSize;
        // The real baseline of the header's line, whatever font metrics this browser goes by.
        const probe = doc.createElement('span');
        probe.style.cssText = 'display:inline-block;width:0;height:0';
        logo.appendChild(probe);
        const baseline = probe.getBoundingClientRect().bottom;
        probe.remove();
        // Its width too: the browser kerns the real letters a touch closer than these advances.
        const sx = (rect.width - parseFloat(css.letterSpacing || 0)) / nameW;
        const toX = rect.left - 5 * scale * sx;
        const toY = baseline - size * CAP / 1000 - 20 * scale * s;
        flight = anim(name, [
          { transform: from + ' scale(1)', fill: '#f3f1eb' },
          { transform: 'translate(' + toX + 'px,' + toY + 'px) scale(' + sx + ',' + s + ')', fill: css.color },
        ], { duration: OPEN_MS, easing: EASE_OPEN });
      } else {
        flight = anim(name, [{ opacity: 1 }, { opacity: 0 }], { duration: OPEN_MS * 0.6, easing: 'ease-out' });
      }
      timers.push(win.setTimeout(() => { end(); remove(); }, OPEN_MS + 30));
      return flight;
    }

    timers.push(win.setTimeout(cut, MAX_MS));
    timers.push(win.setTimeout(open, CAP_MS));
    const dom = doc.readyState === 'loading' ? new Promise(resolve => doc.addEventListener('DOMContentLoaded', resolve, { once: true })) : Promise.resolve();
    const ready = dom.then(() => {
      const wait = [];
      if (doc.fonts && doc.fonts.load) {
        wait.push(doc.fonts.load('800 16px Unbounded', 'САЯН'), doc.fonts.load('700 16px Unbounded', 'Изделия'), doc.fonts.load('400 16px Montserrat', 'Изделия'));
      }
      const hero = doc.querySelector('.home-hero-picture img');
      if (hero && hero.decode) wait.push(hero.decode());
      return Promise.all(wait.map(p => p.catch(() => null)));
    });
    const least = new Promise(resolve => timers.push(win.setTimeout(resolve, MIN_MS)));
    Promise.all([ready, least]).then(open);
  }

  function start(doc, win) {
    let seen = false;
    try {
      seen = !!win.sessionStorage.getItem(KEY);
      win.sessionStorage.setItem(KEY, '1');
    } catch (e) { /* no storage: the way in from this address still stops it repeating */ }
    const navigation = win.performance && win.performance.getEntriesByType ? win.performance.getEntriesByType('navigation')[0] : null;
    if (!shouldPlay({
      reduced: win.matchMedia('(prefers-reduced-motion: reduce)').matches,
      canAnimate: typeof win.Element !== 'undefined' && !!win.Element.prototype.animate,
      hash: win.location.hash,
      navigationType: navigation && navigation.type,
      seen,
      fromThisAddress: doc.referrer.indexOf(win.location.origin + '/') === 0,
    })) return;
    try {
      play(doc, win);
    } catch (e) {
      const left = doc.getElementById('site-intro');
      if (left) left.remove();
      doc.documentElement.classList.remove('si-on');
    }
  }
  if (typeof document !== 'undefined' && typeof window !== 'undefined') start(document, window);

  return { GLYPHS, NAME, shouldPlay, ridgePoints, upperClip, lowerClip, veins };
});
