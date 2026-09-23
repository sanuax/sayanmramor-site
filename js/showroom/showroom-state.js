// js/showroom/showroom-state.js
//
// The showroom's UI state as a pure reducer: which zone the client is in,
// which object's card is open, whether «Все изделия» is open. The renderer
// and the DOM only read describe(state) -- no business rules live in click
// handlers. Also: the layout mode for a viewport width and WebGL detection
// (fallback decision), both pure/injectable for tests.
(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = factory(require('./showroom-data.js'));
  } else {
    root.ShowroomState = factory(root.ShowroomData);
  }
})(typeof window !== 'undefined' ? window : globalThis, function (Data) {

  const INITIAL = Object.freeze({ zone: 'exterior', selectedObjectId: null, panelOpen: false });

  function initialState(zoneId) {
    return Object.assign({}, INITIAL, Data.zoneById(zoneId) ? { zone: zoneId } : {});
  }

  function reduce(state, action) {
    switch (action.type) {
      case 'goToZone': {
        if (!Data.zoneById(action.zone)) return state;
        return Object.assign({}, state, { zone: action.zone, selectedObjectId: null, panelOpen: false });
      }
      case 'goOutside':
        return Object.assign({}, state, { zone: 'exterior', selectedObjectId: null, panelOpen: false });
      case 'selectObject': {
        const object = Data.objectById(action.id);
        if (!object) return state;
        // Selecting an object always takes the client to where it is.
        return Object.assign({}, state, { zone: object.zone, selectedObjectId: object.id, panelOpen: false });
      }
      case 'closeCard':
        return Object.assign({}, state, { selectedObjectId: null });
      case 'openPanel':
        return Object.assign({}, state, { panelOpen: true, selectedObjectId: null });
      case 'closePanel':
        return Object.assign({}, state, { panelOpen: false });
      case 'chooseProduct': {
        const object = Data.primaryObjectFor(action.productKey);
        if (!object) return state;
        return Object.assign({}, state, { zone: object.zone, selectedObjectId: object.id, panelOpen: false });
      }
      default:
        return state;
    }
  }

  // Everything the UI needs, derived -- the answer to "Где я? Что я вижу?
  // Что здесь можно создать?".
  function describe(state) {
    const zone = Data.zoneById(state.zone);
    const objects = Data.objectsInZone(zone.id);
    const products = [];
    objects.forEach(o => {
      const p = Data.productByKey(o.productKey);
      if (!products.includes(p)) products.push(p);
    });
    const object = state.selectedObjectId ? Data.objectById(state.selectedObjectId) : null;
    let card = null;
    if (object) {
      const product = Data.productByKey(object.productKey);
      card = {
        objectId: object.id,
        title: object.title,
        description: object.description,
        productLabel: product.label,
        context: 'Натуральный камень · ' + zone.title,
        ctaLabel: 'Создать изделие →',
        ctaHref: Data.buildConfiguratorUrl(object.productKey),
        categoryHref: product.categoryHref,
      };
    }
    return {
      zone,
      markers: objects.map(o => ({ id: o.id, title: o.title, productLabel: Data.productByKey(o.productKey).label, anchor: o.anchor, selected: o.id === state.selectedObjectId })),
      productsHere: products,
      card,
      panelOpen: state.panelOpen,
      backVisible: zone.id !== 'exterior',
      cameraView: object ? Data.objectView(object) : zone.view,
    };
  }

  // Below 768 px wide: phone layout (bottom sheets, bottom zone bar, larger
  // touch targets). Everything else: floating card / side panel.
  const COMPACT_MAX_WIDTH = 767;
  function layoutMode(width) {
    return width <= COMPACT_MAX_WIDTH ? 'compact' : 'wide';
  }

  // Screen area covered by UI -- the renderer shifts the view so the house
  // (or the focused object) sits in the part of the canvas still visible.
  // On a phone the caption and zone bar always cover the bottom, and an
  // open card/panel sheet covers about half the screen.
  // On wide screens the zone caption always sits top-left (~350 px).
  const CAPTION_WIDTH = 350;
  function viewInsets(mode, { cardOpen, panelOpen }, size) {
    if (mode === 'compact') return { left: 0, right: 0, bottom: Math.round(size.height * (cardOpen || panelOpen ? 0.5 : 0.24)) };
    return { left: CAPTION_WIDTH, right: panelOpen ? 380 : cardOpen ? 400 : 0, bottom: 0 };
  }

  // Views are composed for a landscape screen (aspect ~1.5, 38deg). On a
  // narrower screen the camera moves back along its own line of sight until
  // the horizontal coverage is close to the composed one -- capped, so on a
  // phone the house stays large enough to read (a slight side crop is fine,
  // the client can orbit).
  const BASE_ASPECT = 1.5;
  const BASE_FOV = 38;
  function distanceScale(aspect, fovDeg) {
    const halfH = (fov, a) => Math.atan(Math.tan((fov * Math.PI) / 360) * a);
    const want = halfH(BASE_FOV, BASE_ASPECT), have = halfH(fovDeg, aspect);
    const scale = (Math.tan(want) / Math.tan(have)) * 0.78;
    return Math.min(2.2, Math.max(1, scale));
  }

  function scaleView(view, factor) {
    if (factor === 1) return view;
    return {
      position: view.position.map((p, i) => view.target[i] + (p - view.target[i]) * factor),
      target: view.target.slice(),
    };
  }

  // Deep link: showroom.html#kitchen opens straight in that zone.
  function zoneFromHash(hash) {
    const id = String(hash || '').replace(/^#/, '');
    return Data.zoneById(id) ? id : null;
  }

  function canUseWebGL(doc) {
    try {
      const canvas = doc.createElement('canvas');
      return !!(canvas.getContext('webgl2') || canvas.getContext('webgl'));
    } catch (e) {
      return false;
    }
  }

  return { INITIAL, initialState, reduce, describe, layoutMode, viewInsets, zoneFromHash, canUseWebGL, distanceScale, scaleView, COMPACT_MAX_WIDTH };
});
