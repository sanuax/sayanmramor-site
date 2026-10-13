// scripts/design-audit.js -- dev only. Load into a page served by scripts/dev_server.py:
//   const s = document.createElement('script'); s.src = '/sayanmramor-site/scripts/design-audit.js';
//   document.head.append(s); await new Promise(r => s.onload = r);
// metrics(): the spec's numbers for one page; snapshot()/diff(): proof that a refactor changed nothing.
(function () {
  const visible = (el, win) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 && win.getComputedStyle(el).visibility !== 'hidden'; };
  const path = el => { const p = []; for (let e = el; e && e.nodeType === 1 && e !== e.ownerDocument.body; e = e.parentElement) { const i = Array.prototype.indexOf.call(e.parentElement.children, e); p.unshift(e.tagName.toLowerCase() + (e.className && typeof e.className === 'string' ? '.' + e.className.trim().split(/\s+/)[0] : '') + ':' + i); } return p.join('>'); };
  const PROPS = ['borderTopLeftRadius', 'borderBottomRightRadius', 'boxShadow', 'fontSize', 'fontWeight', 'letterSpacing', 'textTransform', 'color', 'backgroundColor', 'backdropFilter', 'paddingTop', 'paddingLeft', 'marginTop', 'width', 'height'];
  function metrics(doc, win) {
    const els = [...doc.body.querySelectorAll('*')].filter(e => visible(e, win));
    const radii = {}, shadows = new Set(), sizes = new Set(), glass = new Set(), caps = new Set(), buttons = new Set(); let hairlines = 0;
    for (const e of els) {
      const cs = win.getComputedStyle(e);
      const boxed = cs.backgroundColor !== 'rgba(0, 0, 0, 0)' || cs.borderTopWidth !== '0px' || cs.boxShadow !== 'none';
      if (boxed && cs.borderTopLeftRadius !== '0px') radii[cs.borderTopLeftRadius] = (radii[cs.borderTopLeftRadius] || 0) + 1;
      if (cs.boxShadow !== 'none') shadows.add(cs.boxShadow);
      if (cs.backdropFilter && cs.backdropFilter !== 'none') glass.add(String(e.className).split(' ')[0]);
      const text = [...e.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent.trim()).join('');
      if (text) { sizes.add(cs.fontSize); if (cs.textTransform === 'uppercase' && !e.closest('.site-logo')) caps.add(text.slice(0, 30)); }
      if (cs.borderTopWidth === '1px' || cs.borderBottomWidth === '1px') hairlines++;
      if (e.matches('a.btn, button.btn, .btn')) buttons.add([cs.borderTopLeftRadius, cs.height, cs.backgroundColor, cs.borderTopColor].join('/'));
    }
    return { radii, fontSizes: sizes.size, shadowKinds: shadows.size, buttonKinds: buttons.size, glass: [...glass], capsLabels: [...caps], hairlines, overflowX: doc.documentElement.scrollWidth > doc.documentElement.clientWidth };
  }
  function snapshot(doc, win) {
    const out = {};
    for (const e of doc.body.querySelectorAll('*')) { if (!visible(e, win)) continue; const cs = win.getComputedStyle(e); out[path(e)] = PROPS.map(p => cs[p]).join('|'); }
    return out;
  }
  function diff(a, b) { const keys = new Set([...Object.keys(a), ...Object.keys(b)]); return [...keys].filter(k => a[k] !== b[k]); }
  window.DesignAudit = { metrics, snapshot, diff };
})();
