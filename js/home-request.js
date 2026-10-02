// js/home-request.js
//
// «Получить расчёт» on the home page is a sheet of a project drawing: in its
// field the hero's slab in lines, at its real size, and inside it, dashed,
// the piece to be cut from it -- «Ваше изделие»; the form (js/offer-form.js,
// the same form as on every direction page) is the sheet's title block. This
// script only names the piece: choosing a direction in the form writes it on
// the drawing and draws the piece in a solid line; «Без направления» gives it
// back its dashes. It also writes a short hint into the two empty entry cells
// of the title block («Ваше имя», «+7») -- only a placeholder, for the eye;
// the labels, checks and messages stay the form's own.
(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = factory();
  } else {
    root.HomeRequest = factory();
  }
})(typeof window !== 'undefined' ? window : globalThis, function () {

  const UNNAMED = 'Ваше изделие';
  // The hints in the title block's empty cells, by field name: short and neutral.
  const HINTS = { name: 'Ваше имя', phone: '+7' };

  function hint(form) {
    Object.entries(HINTS).forEach(([name, text]) => {
      const input = form && form.querySelector('input[name="' + name + '"]');
      if (input && !input.getAttribute('placeholder')) input.setAttribute('placeholder', text);
    });
  }

  // The piece's name: the chosen direction's label, or «Ваше изделие» while none is chosen.
  function label(select) {
    const option = select && select.options ? select.options[select.selectedIndex] : null;
    return option && option.value ? option.textContent : UNNAMED;
  }

  function init(doc) {
    const band = doc.querySelector('.home-main .offer-band');
    const note = band && band.querySelector('[data-piece-name]');
    const drawing = band && band.querySelector('.offer-drawing');
    if (!note || !drawing) return null;

    function update(select) {
      const name = label(select);
      note.textContent = name;
      drawing.classList.toggle('is-named', name !== UNNAMED);
    }

    band.addEventListener('change', e => { if (e.target && e.target.name === 'direction') update(e.target); });
    update(band.querySelector('select[name="direction"]'));
    hint(band.querySelector('.offer-form'));
    return { update };
  }

  if (typeof document !== 'undefined') init(document);

  return { UNNAMED, HINTS, label, hint, init };
});
