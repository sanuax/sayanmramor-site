// js/showroom/showroom-materials.js
//
// Material roles used by house-model.js -> Three.js materials. No external
// textures or images: every stone family gets a small deterministic
// procedural detail map, drawn once on a canvas -- soft clouding for
// limestone, horizontal bedding and pores for travertine, faint veins for
// marble, a fine speckle for the dark stones, grain for timber -- plus a
// shared grain for roughness and relief, so light breaks up across stone
// the way it does on a honed or polished surface. UVs are in metres (see
// showroom-geometry.js), so each map repeats at its real size. All
// materials multiply by vertex colour: the renderer tints each slab a
// little differently. One shared material per role; objects that can be
// highlighted get their own clone (see forObject) so highlighting one never
// tints the others.
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

// Colour detail maps, centred a little under white (the base colour carries
// the tone; the map only modulates it). `warm` shifts the modulation toward
// ochre where it darkens, as natural stone does.
function detailCanvas(kind, size) {
  const rand = rng({ soft: 11, travertine: 23, veined: 37, speckle: 41, wood: 53, lawn: 67 }[kind]);
  const n1 = lattice(4, rand), n2 = lattice(16, rand), n3 = lattice(64, rand);
  const fbm = (u, v) => n1(u * 4, v * 4) * 0.55 + n2(u * 16, v * 16) * 0.3 + n3(u * 64, v * 64) * 0.15;
  const pores = Float32Array.from({ length: 64 * 64 }, rand);
  const tone = (d, warm) => [236 + d * 26, 236 + d * (26 - warm * 4), 236 + d * (26 - warm * 10)].map(x => Math.max(0, Math.min(255, Math.round(x))));
  return paint(size, (u, v) => {
    if (kind === 'soft') {
      // Limestone: broad soft clouds, a scatter of tiny darker pores.
      const cell = pores[Math.floor(v * 64) * 64 + Math.floor(u * 64)];
      const pore = cell > 0.985 ? -0.22 : 0;
      return tone((fbm(u, v) - 0.5) * 0.3 + pore, 1);
    }
    if (kind === 'travertine') {
      // Travertine: horizontal bedding bands and elongated voids.
      const band = n1(u * 2, v * 4) * 0.5 + n2(u * 3, v * 22) * 0.5;
      const streak = n3(u * 10, v * 64);
      const pore = streak > 0.8 ? -(streak - 0.8) * 2.2 : 0;
      return tone((band - 0.5) * 0.5 + pore, 1);
    }
    if (kind === 'veined') {
      // Marble: quiet clouding and a few thin, meandering veins.
      const w = fbm(u * 0.8 + 3, v * 0.8) * 3.2;
      const vein = Math.pow(1 - Math.abs(Math.sin((u * 1.3 + v * 0.7 + w) * Math.PI)), 34);
      return tone((fbm(u, v) - 0.5) * 0.16 - vein * 0.55, 0.6);
    }
    if (kind === 'speckle') {
      // Granite / basalt / graphite limestone: fine speckle, faint clouds.
      const s = n3(u * 64, v * 64), cell = pores[Math.floor(v * 64) * 64 + Math.floor(u * 64)];
      return tone((s - 0.5) * 0.5 + (n1(u * 4, v * 4) - 0.5) * 0.2 + (cell > 0.97 ? 0.35 : 0), 0.3);
    }
    if (kind === 'wood') {
      // Timber: long grain along u.
      const g = n2(u * 2, v * 40) * 0.6 + n3(u * 4, v * 64) * 0.4;
      return tone((g - 0.5) * 0.55 + Math.sin((v * 90 + n1(u * 4, v * 4) * 6)) * 0.05, 1.4);
    }
    // Lawn / foliage: close mottling.
    return tone((fbm(u, v) - 0.5) * 0.5 + (n3(u * 64, v * 64) - 0.5) * 0.25, -0.6);
  });
}

// A decorative bookmatched onyx for the living-room panno: warm honey
// ground with darker flowing veins, mirrored down the middle like a
// bookmatched pair of slabs. Procedural (fBm-distorted bands), no asset.
function onyxCanvas(width, height) {
  const noise = lattice(8, rng(7771));
  const fbm = (x, y) => noise(x, y) * 0.55 + noise(x * 2.1, y * 2.1) * 0.3 + noise(x * 4.3, y * 4.3) * 0.15;
  const canvas = document.createElement('canvas');
  canvas.width = width; canvas.height = height;
  const ctx = canvas.getContext('2d');
  const img = ctx.createImageData(width, height);
  const half = width / 2;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const mx = x < half ? x : width - 1 - x; // bookmatch mirror
      const u = mx / half, v = y / height;
      const warp = fbm(u * 1.3, v * 1.7) * 2.6;
      const band = Math.abs(Math.sin((u * 0.7 + v * 1.25 + warp) * Math.PI));
      const vein = Math.pow(1 - band, 26) + 0.35 * Math.pow(1 - band, 6);
      const cloud = fbm(u * 1.1 + 3, v * 1.5);
      const r = 178 + 46 * cloud - 58 * vein, g = 136 + 40 * cloud - 50 * vein, b = 92 + 30 * cloud - 38 * vein;
      const k = (y * width + x) * 4;
      img.data[k] = r; img.data[k + 1] = g; img.data[k + 2] = b; img.data[k + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return canvas;
}

// [colour, roughness, extra]. `detail` names the colour map family,
// `stone` adds the roughness/relief grain, `tint` is how much neighbouring
// slabs/blocks of this role may differ in tone (see the renderer).
const ROLES = {
  limestone:         ['#dbcfb8', 0.8, { stone: true, detail: 'soft', tint: 0.07 }],
  'limestone-light': ['#e6dece', 0.5, { stone: true, detail: 'soft', clearcoat: 0.1, tint: 0.035 }],
  travertine:        ['#d8c6a6', 0.62, { stone: true, detail: 'travertine', tint: 0.06 }],
  paving:            ['#cec3ad', 0.86, { stone: true, detail: 'soft', tint: 0.06 }],
  basalt:            ['#302d2a', 0.72, { stone: true, detail: 'speckle', tint: 0.05 }],
  'stone-graphite':  ['#4d4945', 0.46, { stone: true, detail: 'speckle', clearcoat: 0.22, tint: 0.05 }],
  onyx:              ['#ffffff', 0.2, { stone: true, clearcoat: 0.8, veined: true }],
  'granite-black':   ['#252321', 0.26, { stone: true, detail: 'speckle', clearcoat: 0.65, tint: 0.03 }],
  'marble-light':    ['#f1ece3', 0.22, { stone: true, detail: 'veined', clearcoat: 0.55, tint: 0.02 }],
  'marble-warm':     ['#e7d9c3', 0.3, { stone: true, detail: 'veined', clearcoat: 0.4, tint: 0.035 }],
  concrete:          ['#8d877e', 0.92, { stone: true }],
  graphite:          ['#36332f', 0.8, {}],
  poche:             ['#2b2825', 0.9, {}],
  grout:             ['#3a3530', 0.95, {}],
  plaster:           ['#ebe6dd', 0.95, {}],
  soil:              ['#4a4035', 1, {}],
  wood:              ['#9a7453', 0.58, { detail: 'wood', tint: 0.04 }],
  'wood-dark':       ['#5d4332', 0.55, { detail: 'wood', tint: 0.03 }],
  cabinet:           ['#3c3935', 0.62, {}],
  fabric:            ['#9d9487', 0.97, {}],
  'fabric-light':    ['#cdc4b5', 0.97, {}],
  rug:               ['#7c7468', 1, {}],
  shade:             ['#f1e8d8', 0.9, { emissive: '#ffcf9a', emissiveIntensity: 0.6 }],
  metal:             ['#2c2b29', 0.38, { metalness: 0.75 }],
  'metal-dark':      ['#2f3031', 0.32, { metalness: 0.7 }],
  'glass-black':     ['#0d0d0e', 0.08, { clearcoat: 1 }],
  ceramic:           ['#f2efe9', 0.18, { clearcoat: 0.5 }],
  basin:             ['#8f8a83', 0.3, {}],
  mirror:            ['#b9c1c6', 0.1, { metalness: 0.9 }],
  lamp:              ['#000000', 1, { emissive: '#ffd9a6', emissiveIntensity: 2.4 }],
  foliage:           ['#56613f', 0.92, { detail: 'lawn', leafy: true, tint: 0.06 }],
  grass:             ['#8b8762', 0.95, { detail: 'lawn', leafy: true }],
  bark:              ['#4f4337', 0.9, { detail: 'wood' }],
  lawn:              ['#6c7654', 0.96, { detail: 'lawn' }],
  meadow:            ['#626d4e', 0.98, { detail: 'lawn' }],
  gravel:            ['#b0a898', 0.95, { stone: true, detail: 'speckle' }],
};

// How many metres one tile of each detail map covers.
const DETAIL_SIZE = { soft: 1.8, travertine: 1.4, veined: 1.6, speckle: 0.5, wood: 1.2, lawn: 2.5 };

export function roleTint(role) {
  const def = ROLES[role];
  return def ? def[2].tint || 0 : 0;
}

export function createMaterials() {
  const grain = new THREE.CanvasTexture(grainCanvas(256, 24));
  grain.wrapS = grain.wrapT = THREE.RepeatWrapping;
  grain.repeat.set(1.25, 1.25);
  // Leaf-scale relief for foliage masses (the same grain, much finer).
  const leaf = grain.clone();
  leaf.repeat.set(9, 5);
  const onyx = new THREE.CanvasTexture(onyxCanvas(512, 384));
  onyx.colorSpace = THREE.SRGBColorSpace;
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

  function build(role) {
    if (role === 'glass') {
      // Smoky glazing: a dark grey-green tint that mostly reflects the sky.
      return new THREE.MeshPhysicalMaterial({
        color: '#6d777a', roughness: 0.04, metalness: 0, transparent: true, opacity: 0.4,
        envMapIntensity: 1.5, depthWrite: false, side: THREE.DoubleSide, vertexColors: true,
      });
    }
    const def = ROLES[role] || ROLES.plaster;
    const [color, roughness, extra] = def;
    const params = { color, roughness, metalness: extra.metalness || 0, vertexColors: true };
    if (extra.clearcoat) { params.clearcoat = extra.clearcoat; params.clearcoatRoughness = 0.18; }
    if (extra.stone) { params.roughnessMap = grain; params.bumpMap = grain; params.bumpScale = 0.18; }
    if (extra.leafy) { params.bumpMap = leaf; params.bumpScale = 2.5; }
    if (extra.detail) params.map = detail(extra.detail);
    if (extra.veined) params.map = onyx;
    if (extra.emissive) { params.emissive = extra.emissive; params.emissiveIntensity = extra.emissiveIntensity; }
    return new THREE.MeshPhysicalMaterial(params);
  }

  function get(role) {
    if (!cache.has(role)) cache.set(role, build(role));
    return cache.get(role);
  }

  // A private copy for a showroom object's own meshes, so its highlight is
  // independent of every other surface made of the same stone.
  function forObject(role, objectId) {
    const key = role + '|' + objectId;
    if (!clones.has(key)) clones.set(key, get(role).clone());
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
    grain.dispose();
    leaf.dispose();
    onyx.dispose();
  }

  return { get, forObject, objectMaterials, joints, dispose };
}
