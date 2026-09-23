// js/showroom/showroom-ui.js
//
// The DOM around the 3D stage, rendered from ShowroomState.describe():
// zone bar, "where am I" caption, «← На улицу», the object card and the
// «Все изделия» panel. Sends intents back as reducer actions -- no product
// logic lives in these handlers.
export function createUI(doc, { Data, dispatch }) {
  const $ = id => doc.getElementById(id);
  const el = {
    zones: $('srZones'), back: $('srBack'),
    captionZone: $('srCaptionZone'), captionTitle: $('srCaptionTitle'), captionText: $('srCaptionText'), chips: $('srChips'),
    card: $('srCard'), cardProduct: $('srCardProduct'), cardTitle: $('srCardTitle'), cardText: $('srCardText'),
    cardContext: $('srCardContext'), cardCta: $('srCardCta'), cardExamples: $('srCardExamples'), cardClose: $('srCardClose'),
    panel: $('srPanel'), panelBtn: $('srPanelBtn'), panelClose: $('srPanelClose'), panelList: $('srPanelList'),
    hint: $('srHint'),
  };

  // Zone bar.
  const zoneButtons = Data.ZONES.map(zone => {
    const b = doc.createElement('button');
    b.type = 'button';
    b.className = 'sr-zone';
    b.textContent = zone.label;
    b.addEventListener('click', () => dispatch({ type: 'goToZone', zone: zone.id }));
    el.zones.appendChild(b);
    return { b, zone };
  });

  // «Все изделия»: every direction, and where it lives in the house.
  Data.PRODUCTS.forEach(product => {
    const object = Data.primaryObjectFor(product.key);
    const li = doc.createElement('li');
    const b = doc.createElement('button');
    b.type = 'button';
    b.className = 'sr-panel-item';
    const name = doc.createElement('span');
    name.className = 'sr-panel-name';
    name.textContent = product.label;
    const where = doc.createElement('span');
    where.className = 'sr-panel-where';
    where.textContent = Data.zoneById(object.zone).label;
    const arrow = doc.createElement('span');
    arrow.className = 'sr-panel-arrow';
    arrow.setAttribute('aria-hidden', 'true');
    arrow.textContent = '→';
    b.append(name, where, arrow);
    b.addEventListener('click', () => dispatch({ type: 'chooseProduct', productKey: product.key }));
    li.appendChild(b);
    el.panelList.appendChild(li);
  });

  el.back.addEventListener('click', () => dispatch({ type: 'goOutside' }));
  el.cardClose.addEventListener('click', () => dispatch({ type: 'closeCard' }));
  el.panelBtn.addEventListener('click', () => dispatch({ type: el.panel.hidden ? 'openPanel' : 'closePanel' }));
  el.panelClose.addEventListener('click', () => dispatch({ type: 'closePanel' }));

  let lastCardId = null;
  let lastPanelOpen = false;

  function render(view) {
    zoneButtons.forEach(({ b, zone }) => b.setAttribute('aria-current', zone.id === view.zone.id ? 'true' : 'false'));
    el.back.hidden = !view.backVisible;
    doc.body.classList.toggle('is-interior', view.backVisible);

    el.captionZone.textContent = view.zone.label;
    el.captionTitle.textContent = view.zone.title;
    el.captionText.textContent = view.zone.caption;
    el.chips.replaceChildren(...view.productsHere.map(product => {
      const chip = doc.createElement('button');
      chip.type = 'button';
      chip.className = 'sr-chip';
      chip.textContent = product.label;
      const here = view.markers.find(m => Data.objectById(m.id).productKey === product.key);
      chip.addEventListener('click', () => dispatch({ type: 'selectObject', id: here.id }));
      return chip;
    }));

    const card = view.card;
    el.card.hidden = !card;
    if (card) {
      el.cardProduct.textContent = card.productLabel;
      el.cardTitle.textContent = card.title;
      el.cardText.textContent = card.description;
      el.cardContext.textContent = card.context;
      el.cardCta.textContent = card.ctaLabel;
      el.cardCta.href = card.ctaHref;
      el.cardExamples.href = card.categoryHref;
      if (card.objectId !== lastCardId) el.cardCta.focus({ preventScroll: true });
    }
    lastCardId = card ? card.objectId : null;

    el.panel.hidden = !view.panelOpen;
    doc.body.classList.toggle('has-sheet', !!card || view.panelOpen);
    el.panelBtn.setAttribute('aria-expanded', view.panelOpen ? 'true' : 'false');
    if (view.panelOpen && !lastPanelOpen) el.panelList.querySelector('button').focus({ preventScroll: true });
    if (!view.panelOpen && lastPanelOpen && !card) el.panelBtn.focus({ preventScroll: true });
    lastPanelOpen = view.panelOpen;
  }

  // First-visit hint; fades after the first real interaction.
  let hintTimer = null;
  function showHint() {
    el.hint.hidden = false;
    hintTimer = setTimeout(hideHint, 6000);
  }
  function hideHint() {
    if (el.hint.hidden || el.hint.classList.contains('is-fading')) return;
    clearTimeout(hintTimer);
    el.hint.classList.add('is-fading');
    setTimeout(() => { el.hint.hidden = true; }, 700);
  }

  return { render, showHint, hideHint };
}
