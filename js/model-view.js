// js/model-view.js -- a finished piece in 3D and in the room (2026-11-23, the owner).
//
// The catalogue's «3D» chip opens a light window over the page: the piece in its stone,
// turned by a finger or the mouse, its name and real size above, and «Поставить у себя»
// below. The model is the piece's own file (scripts/build_product_models.py): model.glb for
// this view and Android, model.usdz for the iPhone; it is fetched only when the window opens,
// and three.js only then too.
//
// AR goes to the phone's own viewer, always at the real size:
//   iPhone, iPad: AR Quick Look, <a rel="ar"> around an image, scaling locked;
//   Android: Google Scene Viewer by an intent link, resizable=false;
//   anything else: a QR code that opens this piece's window on a phone.
//
// This file is a small module; the page loads it with the catalogue. Pure parts
// (modelSize, arLinks, parseGlb) are exported for the tests.

const THREE_URL = new URL('../vendor/three/three.module.js', import.meta.url).href;
const ORBIT_URL = new URL('../vendor/three/OrbitControls.js', import.meta.url).href;
const QR_URL = new URL('../vendor/qrcode/qrcode.js', import.meta.url).href;

// «1670 × 815 × 550 мм»: width × depth × height, never broken over two lines.
export function modelSize(product) {
  const s = product && product.model && product.model.size_mm;
  if (!Array.isArray(s) || s.length !== 3 || !s.every(n => typeof n === 'number' && n > 0)) return '';
  return s.map(n => String(Math.round(n))).join(' × ') + ' мм';
}

// Where «Поставить у себя» goes on this device.
export function arLinks(product, pageUrl, ua, quickLook) {
  const m = product.model;
  const page = new URL(pageUrl);
  const ios = quickLook !== undefined ? quickLook : /iPhone|iPad|iPod/.test(ua);
  if (ios) return { kind: 'ios', href: new URL(m.usdz, page).href + '#allowsContentScaling=0' };
  if (/Android/i.test(ua)) {
    const file = new URL(m.glb, page).href;
    const back = page.origin + page.pathname + '?3d=' + encodeURIComponent(product.id);
    return {
      kind: 'android',
      href: 'intent://arvr.google.com/scene-viewer/1.0?file=' + encodeURIComponent(file)
        + '&mode=ar_preferred&resizable=false&title=' + encodeURIComponent(product.name || '')
        + '#Intent;scheme=https;package=com.google.ar.core;action=android.intent.action.VIEW;'
        + 'S.browser_fallback_url=' + encodeURIComponent(back) + ';end;',
    };
  }
  return { kind: 'qr', href: page.origin + page.pathname + '?3d=' + encodeURIComponent(product.id) };
}

// The piece's own GLB (one mesh, one stone texture): its arrays, the JPEG and the roughness.
export function parseGlb(buffer) {
  const dv = new DataView(buffer);
  if (dv.getUint32(0, true) !== 0x46546c67) throw new Error('not a glb');
  const jsonLen = dv.getUint32(12, true);
  const json = JSON.parse(new TextDecoder().decode(new Uint8Array(buffer, 20, jsonLen)));
  const binStart = 20 + jsonLen + 8;
  const view = i => json.bufferViews[i];
  const read = i => {
    const a = json.accessors[i], v = view(a.bufferView);
    const n = a.count * { SCALAR: 1, VEC2: 2, VEC3: 3 }[a.type];
    const T = { 5126: Float32Array, 5123: Uint16Array, 5125: Uint32Array }[a.componentType];
    return new T(buffer.slice(binStart + (v.byteOffset || 0), binStart + (v.byteOffset || 0) + n * T.BYTES_PER_ELEMENT));
  };
  const prim = json.meshes[0].primitives[0];
  const img = json.images[0], iv = view(img.bufferView);
  const mat = json.materials[prim.material].pbrMetallicRoughness;
  return {
    positions: read(prim.attributes.POSITION),
    normals: read(prim.attributes.NORMAL),
    uvs: read(prim.attributes.TEXCOORD_0),
    indices: read(prim.indices),
    image: new Blob([new Uint8Array(buffer, binStart + (iv.byteOffset || 0), iv.byteLength)], { type: img.mimeType }),
    roughness: mat.roughnessFactor,
  };
}

// ---- the window ---------------------------------------------------------------------------

const ICONS = {
  close: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>',
  ar: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 20 7.5v9L12 21l-8-4.5v-9z"/><path d="M4 7.5 12 12l8-4.5M12 12v9"/></svg>',
};
// Quick Look wants an image as the link's first child.
const AR_IMG = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3 20 7.5v9L12 21l-8-4.5v-9z"/><path d="M4 7.5 12 12l8-4.5M12 12v9"/></svg>');

let box = null, shown = null;

function el(tag, cls, text) {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text !== undefined) n.textContent = text;
  return n;
}

function hasWebgl() {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch (e) { return false; }
}

function quickLook() {
  const a = document.createElement('a');
  return !!(a.relList && a.relList.supports && a.relList.supports('ar'));
}

function build() {
  box = el('div', 'model-view');
  box.hidden = true;
  box.setAttribute('role', 'dialog');
  box.setAttribute('aria-modal', 'true');
  box.tabIndex = -1;
  box.innerHTML = '<div class="model-view-veil"></div>'
    + '<div class="model-view-top"><div class="model-view-said"><p class="model-view-name"></p><p class="model-view-size"></p></div>'
    + '<button class="model-view-btn" type="button" aria-label="Закрыть">' + ICONS.close + '</button></div>'
    + '<div class="model-view-stage"><p class="model-view-note" aria-live="polite"></p></div>'
    + '<div class="model-view-foot"><p class="model-view-hint">Поворачивайте пальцем или мышью</p><div class="model-view-ar"></div></div>'
    + '<div class="model-view-qr" hidden><div class="model-view-qr-card"><canvas></canvas>'
    + '<p>Наведите камеру телефона на код: изделие откроется на телефоне, там нажмите «Поставить у себя».</p>'
    + '<button class="model-view-qr-close" type="button">Понятно</button></div></div>';
  box.querySelector('.model-view-btn').addEventListener('click', close);
  box.querySelector('.model-view-qr-close').addEventListener('click', () => { box.querySelector('.model-view-qr').hidden = true; });
  box.addEventListener('keydown', e => {
    if (e.key !== 'Escape') return;
    const qr = box.querySelector('.model-view-qr');
    if (!qr.hidden) qr.hidden = true; else close();
  });
  document.body.appendChild(box);
}

function arButton(product) {
  const where = arLinks(product, location.href, navigator.userAgent, quickLook());
  const slot = box.querySelector('.model-view-ar');
  slot.replaceChildren();
  if (where.kind === 'qr') {
    const b = el('button', 'model-view-arbtn');
    b.type = 'button';
    b.innerHTML = ICONS.ar + '<span>Поставить у себя</span>';
    b.addEventListener('click', () => showQr(where.href));
    slot.appendChild(b);
    return;
  }
  const a = el('a', 'model-view-arbtn');
  a.href = where.href;
  if (where.kind === 'ios') a.rel = 'ar';
  const img = el('img');
  img.src = AR_IMG;
  img.alt = '';
  img.width = 20;
  img.height = 20;
  a.appendChild(img);
  a.appendChild(el('span', '', 'Поставить у себя'));
  slot.appendChild(a);
}

function loadScript(src) {
  return new Promise((ok, fail) => {
    const s = document.createElement('script');
    s.src = src;
    s.onload = ok;
    s.onerror = fail;
    document.head.appendChild(s);
  });
}

async function showQr(href) {
  const qr = box.querySelector('.model-view-qr');
  qr.hidden = false;
  if (!window.qrcode) await loadScript(QR_URL);
  const code = window.qrcode(0, 'M');
  code.addData(href);
  code.make();
  const n = code.getModuleCount(), cell = 6, pad = 4 * cell;
  const c = qr.querySelector('canvas');
  c.width = c.height = n * cell + pad * 2;
  const g = c.getContext('2d');
  g.fillStyle = '#fff';
  g.fillRect(0, 0, c.width, c.height);
  g.fillStyle = '#1c1d1b';
  for (let r = 0; r < n; r++) for (let q = 0; q < n; q++) if (code.isDark(r, q)) g.fillRect(pad + q * cell, pad + r * cell, cell, cell);
  qr.querySelector('.model-view-qr-close').focus();
}

// The scene: the piece on a light floor with its soft shadow, a studio for the polish.
async function draw(product, stage, note, signal) {
  const THREE = await import(THREE_URL);
  const { OrbitControls } = await import(ORBIT_URL);
  const res = await fetch(product.model.glb, { signal });
  if (!res.ok) throw new Error('model ' + res.status);
  const glb = parseGlb(await res.arrayBuffer());
  if (signal.aborted) return null;

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const canvas = renderer.domElement;
  canvas.className = 'model-view-canvas';
  stage.appendChild(canvas);

  const scene = new THREE.Scene();
  scene.environment = studio(THREE, renderer);

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(glb.positions, 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(glb.normals, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(glb.uvs, 2));
  geo.setIndex(new THREE.BufferAttribute(glb.indices, 1));
  geo.computeBoundingSphere();
  geo.computeBoundingBox();
  const bitmap = await createImageBitmap(glb.image);
  const map = new THREE.Texture(bitmap);
  map.flipY = false;
  map.colorSpace = THREE.SRGBColorSpace;
  map.anisotropy = renderer.capabilities.getMaxAnisotropy();
  map.needsUpdate = true;
  const stone = new THREE.MeshPhysicalMaterial({
    map, roughness: glb.roughness, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.06, side: THREE.DoubleSide,
  });
  const piece = new THREE.Mesh(geo, stone);
  piece.castShadow = true;
  piece.receiveShadow = true;
  scene.add(piece);

  const size = geo.boundingBox.getSize(new THREE.Vector3());
  const r = geo.boundingSphere.radius;
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(r * 8, r * 8), new THREE.ShadowMaterial({ opacity: 0.16 }));
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);

  const sun = new THREE.DirectionalLight(0xffffff, 1.4);
  sun.position.set(r * 0.5, r * 5, r * 0.9);   // high: the shadow lies under the piece
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.radius = 6;
  sun.shadow.bias = -0.0004;
  const s = sun.shadow.camera;
  s.left = s.bottom = -r * 1.6; s.right = s.top = r * 1.6; s.near = r * 0.5; s.far = r * 9;
  scene.add(sun);

  const camera = new THREE.PerspectiveCamera(30, 1, r / 100, r * 40);
  const target = new THREE.Vector3(0, size.y * 0.5, 0);
  // far enough that the whole height fits (a tall statue) and the piece fills the window
  const dist = Math.max(r / Math.sin(THREE.MathUtils.degToRad(15)) * 0.9,
    size.y * 0.5 / Math.tan(THREE.MathUtils.degToRad(15)) * 1.12 + Math.hypot(size.x, size.z) / 4);
  const from = new THREE.Spherical(dist, THREE.MathUtils.degToRad(68), THREE.MathUtils.degToRad(32));
  camera.position.setFromSpherical(from).add(target);
  camera.lookAt(target);

  const controls = new OrbitControls(camera, canvas);
  controls.target.copy(target);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.enablePan = false;
  controls.minDistance = r * 1.3;
  controls.maxDistance = dist * 2.2;
  controls.maxPolarAngle = THREE.MathUtils.degToRad(88);
  controls.autoRotate = !matchMedia('(prefers-reduced-motion: reduce)').matches;
  controls.autoRotateSpeed = 0.7;
  controls.addEventListener('start', () => { controls.autoRotate = false; });

  // A narrow window (a phone held upright): far enough back that the piece, turning, keeps
  // within the width; no farther.
  const across = Math.hypot(size.x, size.z) / 2;
  const away = () => {
    const half = Math.atan(Math.tan(THREE.MathUtils.degToRad(15)) * camera.aspect);
    return Math.max(dist, across / Math.tan(half) * 1.08 + across * 0.3);
  };
  const fit = () => {
    const w = stage.clientWidth, h = stage.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    controls.maxDistance = away() * 2;
    camera.updateProjectionMatrix();
  };
  fit();
  camera.position.sub(target).setLength(away()).add(target);
  const ro = new ResizeObserver(fit);
  ro.observe(stage);
  renderer.setAnimationLoop(() => { controls.update(); renderer.render(scene, camera); });
  note.textContent = '';

  return () => {
    renderer.setAnimationLoop(null);
    ro.disconnect();
    controls.dispose();
    geo.dispose();
    map.dispose();
    bitmap.close && bitmap.close();
    stone.dispose();
    floor.geometry.dispose();
    floor.material.dispose();
    scene.environment.dispose();
    renderer.dispose();
    canvas.remove();
  };
}

// Light all around, a broad soft panel above and one at the side: the polish shows as a sheen.
function studio(THREE, renderer) {
  const pmrem = new THREE.PMREMGenerator(renderer);
  const env = new THREE.Scene();
  env.add(new THREE.Mesh(new THREE.SphereGeometry(20, 32, 16), new THREE.MeshBasicMaterial({ color: 0x8d8b86, side: THREE.BackSide })));
  const panel = (w, h, c, x, y, z, rx, ry) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: c, side: THREE.DoubleSide }));
    m.position.set(x, y, z);
    m.rotation.set(rx, ry, 0);
    env.add(m);
  };
  panel(16, 10, 0xffffff, 0, 14, 2, Math.PI / 2, 0);
  panel(8, 12, 0xdedad2, -15, 4, 4, 0, Math.PI / 2);
  panel(6, 10, 0xc9c5bd, 14, 3, -6, 0, -Math.PI / 2);
  const tex = pmrem.fromScene(env, 0.04).texture;
  env.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); });
  pmrem.dispose();
  return tex;
}

let stop = null, ctrl = null, opener = null;

export function open(product, from) {
  if (!product || !product.model) return;
  if (!box) build();
  close(true);
  shown = product;
  opener = from || null;
  box.querySelector('.model-view-name').textContent = product.name || '';
  box.querySelector('.model-view-size').textContent = modelSize(product);
  box.querySelector('.model-view-qr').hidden = true;
  const stage = box.querySelector('.model-view-stage');
  const note = box.querySelector('.model-view-note');
  arButton(product);
  box.hidden = false;
  document.documentElement.classList.add('viewer-open');
  requestAnimationFrame(() => box.classList.add('is-open'));
  box.focus({ preventScroll: true });
  if (!hasWebgl()) {
    note.textContent = '3D не поддерживается этим браузером';
    return;
  }
  note.textContent = 'Загружаю модель…';
  ctrl = new AbortController();
  const mine = ctrl;
  draw(product, stage, note, mine.signal).then(dispose => {
    if (mine.signal.aborted || shown !== product) { if (dispose) dispose(); return; }
    stop = dispose;
  }).catch(() => {
    if (!mine.signal.aborted) note.textContent = 'Не удалось загрузить модель';
  });
}

export function close(quiet) {
  if (ctrl) { ctrl.abort(); ctrl = null; }
  if (stop) { stop(); stop = null; }
  if (!box || box.hidden) return;
  shown = null;
  if (quiet === true) return;
  box.classList.remove('is-open');
  box.hidden = true;
  document.documentElement.classList.remove('viewer-open');
  if (opener && opener.focus) opener.focus({ preventScroll: true });
  opener = null;
}

if (typeof window !== 'undefined' && typeof document !== 'undefined') {
  window.ModelView = { open, close, modelSize };
  window.dispatchEvent(new Event('modelview-ready'));
}
