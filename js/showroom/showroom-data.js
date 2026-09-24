// js/showroom/showroom-data.js
//
// Declarative content of the showroom: the 9 product directions, the zones
// of the house, and the showroom objects (a real piece of stone in the
// house -> the product it can be configured as). No DOM, no Three.js --
// shared by the browser and the Node tests. Anchors are in the house
// model's coordinates (js/showroom/house-model.js): metres, Y up, the
// street side is +Z.
(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = factory();
  } else {
    root.ShowroomData = factory();
  }
})(typeof window !== 'undefined' ? window : globalThis, function () {

  // The site -> configurator contract. Never change its shape here:
  // /calculator/sayanmramor-calculator.html?product=<product-key>&stone=<stone-id>
  const CONFIGURATOR_PATH = '/calculator/sayanmramor-calculator.html';

  // Product keys are the calculator's own public keys (product-types.js);
  // category pages are this site's existing pages.
  const PRODUCTS = [
    { key: 'lestnitsa', label: 'Лестницы', categoryHref: '/sayanmramor-site/categories/lestnitsy.html' },
    { key: 'panno', label: 'Панно', categoryHref: '/sayanmramor-site/categories/panno.html' },
    { key: 'podokonnik', label: 'Подоконники', categoryHref: '/sayanmramor-site/categories/podokonniki.html' },
    { key: 'pol', label: 'Полы', categoryHref: '/sayanmramor-site/categories/poly.html' },
    { key: 'stena', label: 'Стены', categoryHref: '/sayanmramor-site/categories/steny.html' },
    { key: 'fasad', label: 'Фасады', categoryHref: '/sayanmramor-site/categories/fasady.html' },
    { key: 'stoleshnitsa_vannaya', label: 'Столешницы в ванную', categoryHref: '/sayanmramor-site/categories/stoleshnitsy-vannaya.html' },
    { key: 'stoleshnitsa_kuhnya', label: 'Столешницы на кухню', categoryHref: '/sayanmramor-site/categories/stoleshnitsy-kuhnya.html' },
    { key: 'stupeni', label: 'Ступени', categoryHref: '/sayanmramor-site/categories/stupeni.html' },
  ];

  // Zones: where the client is, and how the camera frames it. `view` is the
  // arrival camera (position/target); `orbit` limits how far the client can
  // look around from there, so a cut-away interior is never seen from a side
  // where its walls are still standing. `hide` lists the house-model groups
  // removed to open the room up like a section model.
  const INTERIOR_GF_HIDE = ['roof', 'gf-roof', 'uf-floor', 'uf-south', 'uf-north', 'uf-east', 'uf-west', 'uf-interior', 'bath-south', 'gf-south'];
  const ZONES = [
    {
      id: 'exterior', label: 'Дом', title: 'Дом снаружи',
      caption: 'Фасад из натурального камня, входная группа, терраса и окна второго этажа.',
      view: { position: [15.3, 6.75, 20.4], target: [-0.8, 3.0, 0.8] },
      orbit: { minDistance: 13, maxDistance: 40, minPolar: 0.3, maxPolar: 1.42, azimuthRange: null },
      hide: [],
    },
    {
      id: 'hall', label: 'Холл', title: 'Холл',
      caption: 'Вход, каменный пол и облицованная камнем стена.',
      view: { position: [-0.6, 7.0, 6.2], target: [-1.5, 1.5, -2.8] },
      orbit: { minDistance: 5, maxDistance: 15, minPolar: 0.35, maxPolar: 1.2, azimuthRange: 1.0 },
      hide: INTERIOR_GF_HIDE,
    },
    {
      id: 'living', label: 'Гостиная', title: 'Гостиная',
      caption: 'Каменное панно, пол и широкий подоконник у окна.',
      view: { position: [6.6, 8.2, 11.6], target: [3.9, 1.3, 2.3] },
      orbit: { minDistance: 5, maxDistance: 15, minPolar: 0.35, maxPolar: 1.2, azimuthRange: 0.9 },
      hide: INTERIOR_GF_HIDE,
    },
    {
      id: 'kitchen', label: 'Кухня', title: 'Кухня',
      caption: 'Столешница, остров с барной стойкой и каменный фартук.',
      view: { position: [5.2, 8.6, 6.2], target: [3.9, 1.2, -3.0] },
      orbit: { minDistance: 4.5, maxDistance: 14, minPolar: 0.35, maxPolar: 1.2, azimuthRange: 0.9 },
      hide: INTERIOR_GF_HIDE,
    },
    {
      id: 'staircase', label: 'Лестница', title: 'Лестница',
      caption: 'Лестница на второй этаж: ступени, подступенки и облицовка стены.',
      view: { position: [-1.6, 7.6, 9.6], target: [-5.9, 1.6, 0.4] },
      orbit: { minDistance: 5, maxDistance: 15, minPolar: 0.35, maxPolar: 1.2, azimuthRange: 0.9 },
      hide: INTERIOR_GF_HIDE,
    },
    {
      id: 'bathroom', label: 'Ванная', title: 'Ванная',
      caption: 'Столешница с двумя раковинами, каменные стены, пол и подоконник.',
      view: { position: [7.6, 11.2, 0.6], target: [1.0, 4.2, -3.0] },
      orbit: { minDistance: 4.5, maxDistance: 14, minPolar: 0.35, maxPolar: 1.2, azimuthRange: 0.8 },
      hide: ['roof', 'uf-south', 'uf-east', 'bath-south'],
    },
  ];

  // Showroom objects. `anchor` sits on the object's visible surface (the
  // marker is drawn there); `offset` is the camera position relative to the
  // anchor when the object is focused. `primary` marks the object the
  // «Все изделия» panel flies to for that product.
  const OBJECTS = [
    // Exterior
    { id: 'facade', productKey: 'fasad', zone: 'exterior', primary: true,
      title: 'Облицовка фасада', description: 'Плиты натурального камня на стенах и цоколе первого этажа.',
      anchor: [-5.1, 2.1, 5.02], offset: [3.6, 2.2, 8.5] },
    { id: 'entrance-steps', productKey: 'stupeni', zone: 'exterior', primary: true,
      title: 'Ступени входной группы', description: 'Цельные каменные ступени у входа в дом.',
      anchor: [-1.8, 0.31, 5.52], offset: [3.2, 2.4, 5.6] },
    { id: 'exterior-sills', productKey: 'podokonnik', zone: 'exterior',
      title: 'Подоконники второго этажа', description: 'Каменные подоконники и отливы окон на фасаде.',
      anchor: [-6.0, 4.6, 6.6], offset: [3.4, 1.4, 7.2] },
    { id: 'terrace-floor', productKey: 'pol', zone: 'exterior',
      title: 'Пол террасы', description: 'Мощение открытой террасы у гостиной каменными плитами.',
      anchor: [5.4, 0.47, 6.5], offset: [3.4, 4.2, 6.4] },
    // Hall
    { id: 'hall-floor', productKey: 'pol', zone: 'hall',
      title: 'Пол в холле', description: 'Крупноформатные каменные плиты на полу холла.',
      anchor: [-1.8, 0.48, -1.6], offset: [1.8, 5.0, 5.0] },
    { id: 'hall-wall', productKey: 'stena', zone: 'hall', primary: true,
      title: 'Каменная стена', description: 'Облицовка стены холла натуральным камнем.',
      anchor: [-1.2, 2.1, -4.62], offset: [1.2, 1.6, 6.4] },
    // Living room
    { id: 'living-floor', productKey: 'pol', zone: 'living', primary: true,
      title: 'Пол в гостиной', description: 'Каменный пол единого формата для гостиной и кухни.',
      anchor: [3.4, 0.48, 3.4], offset: [2.2, 5.0, 5.4] },
    { id: 'living-panno', productKey: 'panno', zone: 'living', primary: true,
      title: 'Панно в гостиной', description: 'Декоративное каменное панно — главный акцент гостиной.',
      anchor: [1.13, 1.9, 2.6], offset: [5.4, 1.4, 2.6] },
    { id: 'living-sill', productKey: 'podokonnik', zone: 'living', primary: true,
      title: 'Подоконник', description: 'Широкий каменный подоконник у окна гостиной.',
      anchor: [6.52, 1.31, 2.5], offset: [-3.6, 2.0, 3.4] },
    // Kitchen
    { id: 'kitchen-counter', productKey: 'stoleshnitsa_kuhnya', zone: 'kitchen', primary: true,
      title: 'Столешница на кухню', description: 'Рабочая столешница вдоль стены — с вырезом под мойку и варочную панель.',
      anchor: [4.0, 1.35, -4.35], offset: [0.4, 2.6, 4.6] },
    { id: 'kitchen-backsplash', productKey: 'stoleshnitsa_kuhnya', zone: 'kitchen',
      title: 'Фартук', description: 'Каменный фартук над рабочей зоной — продолжение столешницы.',
      anchor: [5.8, 1.8, -4.66], offset: [-0.6, 1.8, 4.6] },
    { id: 'kitchen-island', productKey: 'stoleshnitsa_kuhnya', zone: 'kitchen',
      title: 'Кухонный остров', description: 'Остров из камня — отдельная рабочая поверхность в центре кухни.',
      anchor: [3.3, 1.35, -2.75], offset: [1.8, 2.8, 4.4] },
    { id: 'kitchen-bar', productKey: 'stoleshnitsa_kuhnya', zone: 'kitchen',
      title: 'Барная стойка', description: 'Приподнятая барная стойка, продолжающая остров.',
      anchor: [4.9, 1.55, -1.95], offset: [2.2, 2.2, 4.0] },
    // Staircase
    { id: 'staircase', productKey: 'lestnitsa', zone: 'staircase', primary: true,
      title: 'Лестница', description: 'Лестница на второй этаж, облицованная камнем: ступени, подступенки, площадка.',
      anchor: [-5.95, 2.29, 0.74], offset: [5.2, 2.8, 4.2] },
    { id: 'staircase-steps', productKey: 'stupeni', zone: 'staircase',
      title: 'Ступени и подступенки', description: 'Отдельные каменные ступени с подступенками — прямые, забежные или радиусные.',
      anchor: [-5.95, 0.82, 2.98], offset: [4.0, 1.8, 3.8] },
    { id: 'staircase-wall', productKey: 'stena', zone: 'staircase',
      title: 'Облицовка стены', description: 'Каменная облицовка стены вдоль лестницы.',
      anchor: [-6.62, 2.5, 2.3], offset: [6.2, 1.2, 1.8] },
    // Bathroom
    { id: 'bath-counter', productKey: 'stoleshnitsa_vannaya', zone: 'bathroom', primary: true,
      title: 'Столешница в ванную', description: 'Подвесная столешница с двумя раковинами.',
      anchor: [1.2, 4.61, -4.4], offset: [2.4, 1.8, 3.4] },
    { id: 'bath-wall', productKey: 'stena', zone: 'bathroom',
      title: 'Стены ванной', description: 'Каменная облицовка стены за столешницей.',
      anchor: [2.75, 5.5, -4.64], offset: [2.4, 1.0, 4.2] },
    { id: 'bath-floor', productKey: 'pol', zone: 'bathroom',
      title: 'Пол в ванной', description: 'Каменный пол ванной комнаты.',
      anchor: [0.3, 3.78, -2.0], offset: [3.2, 3.6, 2.6] },
    { id: 'bath-sill', productKey: 'podokonnik', zone: 'bathroom',
      title: 'Подоконник в ванной', description: 'Каменный подоконник у окна ванной.',
      anchor: [3.05, 4.61, -2.6], offset: [-2.8, 1.6, 2.4] },
  ];

  const PRODUCT_KEYS = PRODUCTS.map(p => p.key);

  function productByKey(key) {
    return PRODUCTS.find(p => p.key === key) || null;
  }

  function zoneById(id) {
    return ZONES.find(z => z.id === id) || null;
  }

  function objectById(id) {
    return OBJECTS.find(o => o.id === id) || null;
  }

  function objectsInZone(zoneId) {
    return OBJECTS.filter(o => o.zone === zoneId);
  }

  function primaryObjectFor(productKey) {
    return OBJECTS.find(o => o.productKey === productKey && o.primary) || OBJECTS.find(o => o.productKey === productKey) || null;
  }

  // Unknown product keys are refused rather than passed through: a typo
  // here would silently open the configurator on its default product.
  function buildConfiguratorUrl(productKey, stoneId) {
    if (!productByKey(productKey)) throw new Error('Unknown product key: ' + productKey);
    let url = CONFIGURATOR_PATH + '?product=' + encodeURIComponent(productKey);
    if (stoneId) url += '&stone=' + encodeURIComponent(stoneId);
    return url;
  }

  // A stone id as the configurator writes it (slabs.json `id`: lowercase
  // latin, digits, hyphens). The showroom has no stone catalog of its own,
  // so it only rejects what cannot be an id at all; the configurator's own
  // URL bootstrap ignores an id it does not know.
  const STONE_ID = /^[a-z0-9][a-z0-9-]{0,99}$/;
  function isStoneId(value) {
    return typeof value === 'string' && STONE_ID.test(value);
  }

  // Camera for a focused object: looking at the anchor from anchor + offset.
  function objectView(object) {
    const a = object.anchor, o = object.offset;
    return { position: [a[0] + o[0], a[1] + o[1], a[2] + o[2]], target: a.slice() };
  }

  return {
    CONFIGURATOR_PATH, PRODUCTS, PRODUCT_KEYS, ZONES, OBJECTS,
    productByKey, zoneById, objectById, objectsInZone, primaryObjectFor, buildConfiguratorUrl, objectView, isStoneId,
  };
});
