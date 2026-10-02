// js/home-wall.js
//
// «Что можно заказать» on the home page: a wall of thirteen stone slabs, one
// for each direction, in the five groups of the masthead's «Изделия +». On a
// desktop with a real pointer one slab stands open -- its photograph whole,
// 2:3, drawn a little out of the wall -- and the others stay in the wall as
// narrow slabs. Moving the pointer over a slab, or focusing it, opens it and
// closes the one before; it stays open when the pointer leaves, so the wall is never
// without its open slab. Every slab is a plain link to its direction's page;
// a touch is a tap that opens the page, nothing to open first. Without this
// script CSS opens the slab under the pointer or the focus (the first one
// otherwise) and every link works.
(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = factory();
  } else {
    root.HomeWall = factory();
  }
})(typeof window !== 'undefined' ? window : globalThis, function () {

  // The slab to open next: the one pointed at or focused, if it is a slab of the wall.
  function choose(slabs, current, target) {
    return slabs.includes(target) ? target : current;
  }

  function init(doc) {
    const wall = doc.querySelector('[data-wall]');
    if (!wall) return null;
    const slabs = [...wall.querySelectorAll('.wall-slab')];
    let open = slabs.find(s => s.classList.contains('is-open')) || slabs[0] || null;

    function set(slab) {
      const next = choose(slabs, open, slab);
      if (next === open) return;
      // The slab that just closed is marked, so only its name comes back into the wall (CSS).
      slabs.forEach(s => s.classList.remove('was-open'));
      if (open) open.classList.replace('is-open', 'was-open');
      next.classList.add('is-open');
      open = next;
    }

    slabs.forEach(slab => {
      // A mouse or a pen points; a touch is a tap that opens the page. Only a
      // pointer that moves opens a slab: a wall scrolled under a resting
      // pointer stays as it is (pointerenter would fire there too).
      slab.addEventListener('pointermove', e => { if (e.pointerType !== 'touch') set(slab); });
      slab.addEventListener('focus', () => set(slab));
    });
    return { slabs, set, get open() { return open; } };
  }

  if (typeof document !== 'undefined' && typeof window !== 'undefined') init(document);

  return { choose, init };
});
