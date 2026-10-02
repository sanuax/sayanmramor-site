// js/home-stack.js
//
// «Что можно заказать» on the home page: the stack of 13 directions. One row
// is open at a time (the first, until another is chosen): pointing at a row
// or focusing it opens its cut and quietly closes the one before -- it stays
// open when the pointer leaves, so the stack never stands with every slab
// shut. The rows are plain links; on a phone (no hover) a tap simply opens
// the direction. Without this script the first row stays open and CSS opens
// the row under the pointer.
(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = factory();
  } else {
    root.HomeStack = factory();
  }
})(typeof window !== 'undefined' ? window : globalThis, function () {

  // The row to open next: the one pointed at or focused, if it is a row.
  function choose(rows, current, target) {
    return rows.includes(target) ? target : current;
  }

  function init(doc) {
    const stack = doc.querySelector('[data-stack]');
    if (!stack) return null;
    const rows = [...stack.querySelectorAll('.stack-row')];
    let open = rows.find(r => r.classList.contains('is-open')) || rows[0] || null;

    function set(row) {
      const next = choose(rows, open, row);
      if (next === open) return;
      if (open) open.classList.remove('is-open');
      next.classList.add('is-open');
      open = next;
    }

    rows.forEach(row => {
      // A mouse or a pen points; a touch is a tap that opens the page, nothing to show first.
      row.addEventListener('pointerenter', e => { if (e.pointerType !== 'touch') set(row); });
      row.addEventListener('focus', () => set(row));
    });
    return { rows, set, get open() { return open; } };
  }

  if (typeof document !== 'undefined' && typeof window !== 'undefined') init(document);

  return { choose, init };
});
