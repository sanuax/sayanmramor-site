// js/showroom/showroom-materials.js
//
// Material roles used by house-model.js -> Three.js materials.
//
// The house is one set of stones:
//   - our own light limestone (facades, frames, fence, paving, floors) --
//     procedural, drawn once on a canvas: soft clouds, faint bedding, a few
//     pores and calcite specks, no veins; one large (4 m) non-repeating
//     field that every slab samples at its own random offset, so no two
//     neighbouring slabs show the same patch;
//   - Steel Grey, Viscont White, Calacatta Nova, Majestic -- real Venezia
//     Stone photographs (stone-photos.js): a material's main photo made
//     seamless and repeated at true size, or a region of a real slab.
// Photos load in the background after the first frame; until then the
// stone shows its measured average colour, so nothing flashes. Relief and
// roughness: a shared fine grain, and for Steel Grey's leathered finish the
// photo's own grain as bump. All materials multiply by vertex colour (the
// renderer tints procedural slabs slightly differently). One shared
// material per role (+ photo); objects that can be highlighted get their
// own clone (see forObject) so highlighting one never tints the others.
import * as THREE from '../../vendor/three/three.module.js';

function rng(seed) {
  let s = seed;
  return () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
}

// Tileable value noise on an n x n lattice.
function lattice(n, rand) {
  const g = Float32Array.from({ length: n * n }, rand);
  const smooth = t => t * t * (3 - 2 * t);
  return (x, y) => {
    const x0 = Math.floor(x), y0 = Math.floor(y), tx = smooth(x - x0), ty = smooth(y - y0);
    const at = (a, b) => g[((b % n) + n) % n * n + (((a % n) + n) % n)];
    const top = at(x0, y0) + (at(x0 + 1, y0) - at(x0, y0)) * tx;
    const bottom = at(x0, y0 + 1) + (at(x0 + 1, y0 + 1) - at(x0, y0 + 1)) * tx;
    return top + (bottom - top) * ty;
  };
}

function paint(size, fn) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  const img = ctx.createImageData(size, size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const [r, g, b] = fn(x / size, y / size);
      const k = (y * size + x) * 4;
      img.data[k] = r; img.data[k + 1] = g; img.data[k + 2] = b; img.data[k + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return canvas;
}

// Grain for roughness and bump (grey, two octaves).
function grainCanvas(size, cells) {
  const rand = rng(20240917);
  const lo = lattice(cells, rand), hi = lattice(cells * 4, rand);
  return paint(size, (u, v) => {
    const c = Math.round(170 + 85 * (lo(u * cells, v * cells) * 0.65 + hi(u * cells * 4, v * cells * 4) * 0.35));
    return [c, c, c];
  });
}

const clamp255 = x => Math.max(0, Math.min(255, Math.round(x)));

// Our limestone: a warm, matt, even stone. Broad clouds a few tenths of a
// metre across, a quieter mid-scale mottle, faint horizontal bedding, a
// slight warm/cool drift, sparse darker pores and lighter calcite specks.
// Centred a little under white: the role colour carries the tone.
const LIMESTONE_SIZE = 4;   // metres covered by one image
function limestoneCanvas(size) {
  const rand = rng(90173);
  const cloud = lattice(5, rand), mottle = lattice(22, rand), fine = lattice(110, rand), bed = lattice(7, rand), drift = lattice(3, rand);
  const cells = 640, spots = Float32Array.from({ length: cells * cells }, rand);
  return paint(size, (u, v) => {
    const c = cloud(u * 5, v * 5) - 0.5;
    const m = mottle(u * 22, v * 22) - 0.5;
    const f = fine(u * 110, v * 110) - 0.5;
    const b = bed(u * 7, v * 60) - 0.5;
    const spot = spots[Math.floor(v * cells) * cells + Math.floor(u * cells)];
    const pore = spot > 0.9975 ? -0.1 : 0, calcite = spot < 0.0025 ? 0.06 : 0;
    const d = c * 0.1 + m * 0.055 + f * 0.035 + b * 0.03 + pore + calcite;
    const w = (drift(u * 3, v * 3) - 0.5) * 0.05;   // warm (>0) / cool (<0)
    const L = 234 * (1 + d);
    return [clamp255(L * (1 + w * 0.6)), clamp255(L), clamp255(L * (1 - w))];
  });
}

// Small colour maps for the non-stone roles.
function detailCanvas(kind, size) {
  const rand = rng({ speckle: 41, wood: 53, lawn: 67 }[kind]);
  const n1 = lattice(4, rand), n2 = lattice(16, rand), n3 = lattice(64, rand);
  const fbm = (u, v) => n1(u * 4, v * 4) * 0.55 + n2(u * 16, v * 16) * 0.3 + n3(u * 64, v * 64) * 0.15;
  const tone = (d, warm) => [236 + d * 26, 236 + d * (26 - warm * 4), 236 + d * (26 - warm * 10)].map(clamp255);
  return paint(size, (u, v) => {
    if (kind === 'speckle') return tone((n3(u * 64, v * 64) - 0.5) * 0.5 + (n1(u * 4, v * 4) - 0.5) * 0.2, 0.3);
    if (kind === 'wood') {
      const g = n2(u * 2, v * 40) * 0.6 + n3(u * 4, v * 64) * 0.4;
      return tone((g - 0.5) * 0.55 + Math.sin((v * 90 + n1(u * 4, v * 4) * 6)) * 0.05, 1.4);
    }
    return tone((fbm(u, v) - 0.5) * 0.5 + (n3(u * 64, v * 64) - 0.5) * 0.25, -0.6);
  });
}

// Makes a photo tile seamlessly: in each direction the image is blended,
// near its edges, with a copy of itself shifted by half -- that copy runs
// continuously across the edges, and its own seam sits in the middle,
// where the blend keeps the original. Grain and waves are kept; only the
// outer bands are cross-faded.
function makeSeamless(canvas) {
  const w = canvas.width, h = canvas.height, ctx = canvas.getContext('2d');
  let src = ctx.getImageData(0, 0, w, h).data;
  const pass = (horizontal) => {
    const out = new Uint8ClampedArray(src.length);
    const n = horizontal ? w : h, half = Math.floor(n / 2), band = 0.3;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const t = horizontal ? x : y;
        const d = Math.min(t, n - 1 - t) / half;              // 0 at the edge, 1 in the middle
        let m = Math.max(0, 1 - d / band); m = m * m * (3 - 2 * m);
        const xs = horizontal ? (x + half) % w : x, ys = horizontal ? y : (y + half) % h;
        const k = (y * w + x) * 4, ks = (ys * w + xs) * 4;
        for (let c = 0; c < 3; c++) out[k + c] = src[k + c] * (1 - m) + src[ks + c] * m;
        out[k + 3] = 255;
      }
    }
    src = out;
  };
  pass(true);
  pass(false);
  ctx.putImageData(new ImageData(src, w, h), 0, 0);
  return canvas;
}

// [colour, roughness, extra]. `detail` names the colour map family,
// `stone` adds the roughness/relief grain, `tint` is how much neighbouring
// slabs/blocks of this role may differ in tone (see the renderer). `photo`
// roles take their map from stone-photos.js: `tile` names the main photo
// used when a surface has no slab of its own; `bump` uses the photo's
// grain as relief.
const ROLES = {
  limestone:          ['#dcd0b9', 0.84, { stone: true, limestone: true, tint: 0.05 }],
  'limestone-light':  ['#e7dfcf', 0.62, { stone: true, limestone: true, tint: 0.03 }],
  'limestone-floor':  ['#e2d8c6', 0.5, { stone: true, limestone: true, tint: 0.035 }],
  paving:             ['#d0c4ad', 0.9, { stone: true, limestone: true, tint: 0.05 }],
  'steel-grey':       ['#404443', 0.82, { photo: true, tile: 'steel-grey-00933', bump: 1.2, tint: 0.035 }],
  'steel-grey-honed': ['#404443', 0.48, { photo: true, tile: 'steel-grey-00933', bump: 0.3, clearcoat: 0.12, tint: 0.025 }],
  'viscont-white':    ['#a8aca6', 0.22, { photo: true, tile: 'viscont-white-01050', clearcoat: 0.25 }],
  'calacatta-nova':   ['#d6d5cf', 0.28, { photo: true, tile: 'calacatta-nova-01940', clearcoat: 0.18 }],
  majestic:           ['#d9d7cf', 0.18, { photo: true, clearcoat: 0.3 }],
  graphite:           ['#36332f', 0.8, {}],
  poche:              ['#2b2825', 0.9, {}],
  grout:              ['#3a3530', 0.95, {}],
  plaster:            ['#ebe6dd', 0.95, {}],
  soil:               ['#4a4035', 1, {}],
  wood:               ['#9a7453', 0.58, { detail: 'wood', tint: 0.04 }],
  'wood-dark':        ['#5d4332', 0.55, { detail: 'wood', tint: 0.03 }],
  cabinet:            ['#3c3935', 0.62, {}],
  fabric:             ['#9d9487', 0.97, {}],
  'fabric-light':     ['#cdc4b5', 0.97, {}],
  rug:                ['#7c7468', 1, {}],
  shade:              ['#f1e8d8', 0.9, { emissive: '#ffcf9a', emissiveIntensity: 0.6 }],
  metal:              ['#2c2b29', 0.38, { metalness: 0.75 }],
  'metal-dark':       ['#2f3031', 0.32, { metalness: 0.7 }],
  'glass-black':      ['#0d0d0e', 0.08, { clearcoat: 1 }],
  ceramic:            ['#f2efe9', 0.18, { clearcoat: 0.5 }],
  basin:              ['#8f8a83', 0.3, {}],
  mirror:             ['#b9c1c6', 0.1, { metalness: 0.9 }],
  lamp:               ['#000000', 1, { emissive: '#ffd9a6', emissiveIntensity: 2.4 }],
  foliage:            ['#56613f', 0.92, { detail: 'lawn', leafy: true, tint: 0.06 }],
  grass:              ['#8b8762', 0.95, { detail: 'lawn', leafy: true }],
  bark:               ['#4f4337', 0.9, { detail: 'wood' }],
  lawn:               ['#6c7654', 0.96, { detail: 'lawn' }],
  meadow:             ['#626d4e', 0.98, { detail: 'lawn' }],
  gravel:             ['#b0a898', 0.95, { stone: true, detail: 'speckle' }],
};

// How many metres one tile of each detail map covers.
const DETAIL_SIZE = { speckle: 0.5, wood: 1.2, lawn: 2.5 };

export function roleTint(role) {
  const def = ROLES[role];
  return def ? def[2].tint || 0 : 0;
}

// The texture size a photo is brought to on the GPU: sharp at arm's length
// on a desktop, lighter on phones and low-memory devices.
function photoMaxSize(photo) {
  const small = Math.min(screen.width, screen.height) < 820 || (navigator.deviceMemory && navigator.deviceMemory <= 4);
  if (photo.kind === 'tile') return small ? 1024 : 2048;
  if (photo.stone === 'calacatta-nova') return 2048;
  return small ? 2048 : 3072;
}

export function createMaterials({ Photos, anisotropy = 4, onChange } = {}) {
  const grain = new THREE.CanvasTexture(grainCanvas(256, 24));
  grain.wrapS = grain.wrapT = THREE.RepeatWrapping;
  grain.repeat.set(1.25, 1.25);
  // Leaf-scale relief for foliage masses (the same grain, much finer).
  const leaf = grain.clone();
  leaf.repeat.set(9, 5);
  const limestone = new THREE.CanvasTexture(limestoneCanvas(1024));
  limestone.colorSpace = THREE.SRGBColorSpace;
  limestone.wrapS = limestone.wrapT = THREE.RepeatWrapping;
  limestone.repeat.set(1 / LIMESTONE_SIZE, 1 / LIMESTONE_SIZE);
  limestone.anisotropy = anisotropy;
  const details = new Map();
  const detail = kind => {
    if (!details.has(kind)) {
      const t = new THREE.CanvasTexture(detailCanvas(kind, 256));
      t.colorSpace = THREE.SRGBColorSpace;
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.repeat.set(1 / DETAIL_SIZE[kind], 1 / DETAIL_SIZE[kind]);
      t.anisotropy = 4;
      details.set(kind, t);
    }
    return details.get(kind);
  };
  const cache = new Map();
  const clones = new Map();

  // ---- photos ---------------------------------------------------------------
  const photoTextures = new Map();   // key -> THREE.Texture, once ready
  const photoLoads = new Map();      // key -> Promise
  const photoUsers = new Map();      // key -> Set of materials waiting for / using it
  let photosStarted = false;

  function textureFromImage(key, img) {
    const photo = Photos.PHOTOS[key];
    const { rect } = Photos.crop(key);
    const sx = rect[0] * img.naturalWidth, sy = rect[1] * img.naturalHeight;
    const sw = (rect[2] - rect[0]) * img.naturalWidth, sh = (rect[3] - rect[1]) * img.naturalHeight;
    const k = Math.min(1, photoMaxSize(photo) / Math.max(sw, sh));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(sw * k); canvas.height = Math.round(sh * k);
    canvas.getContext('2d').drawImage(img, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
    if (photo.kind === 'tile') makeSeamless(canvas);
    const t = new THREE.CanvasTexture(canvas);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = anisotropy;
    if (photo.kind === 'tile') {
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.repeat.set(1 / photo.tile[0], 1 / photo.tile[1]);
    } else {
      t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
    }
    return t;
  }

  function applyPhoto(material, key) {
    const t = photoTextures.get(key);
    if (!t) return;
    const extra = material.userData.roleExtra;
    material.map = t;
    if (extra.bump) { material.bumpMap = t; material.bumpScale = extra.bump; }
    const g = Photos.gain(key);
    material.color.setRGB(g[0], g[1], g[2]);   // linear gain over the photo
    material.needsUpdate = true;
  }

  function loadPhoto(key) {
    if (!photoLoads.has(key)) {
      photoLoads.set(key, new Promise(resolve => {
        const img = new Image();
        img.decoding = 'async';
        img.onload = () => {
          try {
            photoTextures.set(key, textureFromImage(key, img));
            (photoUsers.get(key) || []).forEach(m => applyPhoto(m, key));
            if (onChange) onChange();
          } catch (e) { /* keep the flat stone colour */ }
          resolve();
        };
        img.onerror = () => resolve();   // the stone keeps its average colour
        img.src = Photos.url(key);
      }));
    }
    return photoLoads.get(key);
  }

  function usePhoto(material, key) {
    material.userData.photoKey = key;
    if (!photoUsers.has(key)) photoUsers.set(key, new Set());
    photoUsers.get(key).add(material);
    if (photoTextures.has(key)) applyPhoto(material, key);
    else if (photosStarted) loadPhoto(key);
  }

  // Start fetching every photo in use (called once the first frame is up,
  // so the house appears before the stone photographs arrive).
  function loadPhotos() {
    photosStarted = true;
    return Promise.all(Array.from(photoUsers.keys()).map(loadPhoto));
  }

  function build(role, photoKey) {
    if (role === 'glass') {
      // Smoky glazing: a dark grey-green tint that mostly reflects the sky.
      return new THREE.MeshPhysicalMaterial({
        color: '#6d777a', roughness: 0.04, metalness: 0, transparent: true, opacity: 0.4,
        envMapIntensity: 1.5, depthWrite: false, side: THREE.DoubleSide, vertexColors: true,
      });
    }
    if (role === 'glass-smoke') {
      // Balustrade glass: a little darker and denser than the windows, so it
      // reads as a guard, still clear enough to see the facade through.
      return new THREE.MeshPhysicalMaterial({
        color: '#57615f', roughness: 0.05, metalness: 0, transparent: true, opacity: 0.5,
        envMapIntensity: 1.4, depthWrite: false, side: THREE.DoubleSide, vertexColors: true,
      });
    }
    const def = ROLES[role] || ROLES.plaster;
    const [color, roughness, extra] = def;
    const params = { color, roughness, metalness: extra.metalness || 0, vertexColors: true };
    if (extra.clearcoat) { params.clearcoat = extra.clearcoat; params.clearcoatRoughness = 0.2; }
    if (extra.stone) { params.roughnessMap = grain; params.bumpMap = grain; params.bumpScale = 0.18; }
    if (extra.photo) { params.roughnessMap = grain; }
    if (extra.leafy) { params.bumpMap = leaf; params.bumpScale = 2.5; }
    if (extra.limestone) params.map = limestone;
    if (extra.detail) params.map = detail(extra.detail);
    if (extra.emissive) { params.emissive = extra.emissive; params.emissiveIntensity = extra.emissiveIntensity; }
    const material = new THREE.MeshPhysicalMaterial(params);
    material.userData.roleExtra = extra;
    const key = photoKey || extra.tile;
    if (extra.photo && key && Photos && Photos.PHOTOS[key]) {
      // Until the photo is in, the stone shows its balanced average colour.
      const target = Photos.PHOTOS[key].target;
      material.color.setRGB(target[0] / 255, target[1] / 255, target[2] / 255, THREE.SRGBColorSpace);
      usePhoto(material, key);
    }
    return material;
  }

  // role, or role + the slab photo a surface is cut from.
  function get(role, photoKey) {
    const key = photoKey ? role + '@' + photoKey : role;
    if (!cache.has(key)) cache.set(key, build(role, photoKey));
    return cache.get(key);
  }

  // A private copy for a showroom object's own meshes, so its highlight is
  // independent of every other surface made of the same stone.
  function forObject(role, objectId, photoKey) {
    const key = (photoKey ? role + '@' + photoKey : role) + '|' + objectId;
    if (!clones.has(key)) {
      const base = get(role, photoKey);
      const clone = base.clone();
      clone.userData = Object.assign({}, base.userData);
      if (base.userData.photoKey) usePhoto(clone, base.userData.photoKey);
      clones.set(key, clone);
    }
    return clones.get(key);
  }

  function objectMaterials(objectId) {
    return Array.from(clones.entries()).filter(([k]) => k.endsWith('|' + objectId)).map(([, m]) => m);
  }

  const joints = {
    dark: new THREE.LineBasicMaterial({ color: '#000000', transparent: true, opacity: 0.22 }),
    light: new THREE.LineBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.12 }),
  };

  function dispose() {
    cache.forEach(m => m.dispose());
    clones.forEach(m => m.dispose());
    Object.values(joints).forEach(m => m.dispose());
    details.forEach(t => t.dispose());
    photoTextures.forEach(t => t.dispose());
    grain.dispose();
    leaf.dispose();
    limestone.dispose();
  }

  return { get, forObject, objectMaterials, joints, loadPhotos, dispose };
}

export { LIMESTONE_SIZE };
