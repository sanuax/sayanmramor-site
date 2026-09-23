// js/showroom/showroom-materials.js
//
// Material roles used by house-model.js -> Three.js materials. No external
// textures: stone gets a small, deterministic procedural grain (roughness +
// bump) so light breaks up across it like on a real honed/polished surface.
// One shared material per role; objects that can be highlighted get their
// own clone (see forObject) so highlighting one never tints the others.
import * as THREE from '../../vendor/three/three.module.js';

function grainCanvas(size, cells) {
  let seed = 20240917;
  const rand = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  const grids = [cells, cells * 4].map(n => ({ n, g: Float32Array.from({ length: n * n }, rand) }));
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  const img = ctx.createImageData(size, size);
  const smooth = t => t * t * (3 - 2 * t);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let v = 0;
      grids.forEach(({ n, g }, i) => {
        const fx = (x / size) * n, fy = (y / size) * n;
        const x0 = Math.floor(fx), y0 = Math.floor(fy);
        const tx = smooth(fx - x0), ty = smooth(fy - y0);
        const at = (a, b) => g[((b % n) + n) % n * n + (((a % n) + n) % n)];
        const top = at(x0, y0) + (at(x0 + 1, y0) - at(x0, y0)) * tx;
        const bottom = at(x0, y0 + 1) + (at(x0 + 1, y0 + 1) - at(x0, y0 + 1)) * tx;
        v += (top + (bottom - top) * ty) * (i === 0 ? 0.65 : 0.35);
      });
      const c = Math.round(170 + 85 * v);
      const k = (y * size + x) * 4;
      img.data[k] = img.data[k + 1] = img.data[k + 2] = c;
      img.data[k + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return canvas;
}

// A decorative bookmatched onyx for the living-room panno: warm honey
// ground with darker flowing veins, mirrored down the middle like a
// bookmatched pair of slabs. Procedural (fBm-distorted bands), no asset.
function onyxCanvas(width, height) {
  let seed = 7771;
  const rand = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  const n = 8, grid = Float32Array.from({ length: n * n }, rand);
  const smooth = t => t * t * (3 - 2 * t);
  const noise = (x, y) => {
    const x0 = Math.floor(x), y0 = Math.floor(y), tx = smooth(x - x0), ty = smooth(y - y0);
    const at = (a, b) => grid[((b % n) + n) % n * n + (((a % n) + n) % n)];
    const top = at(x0, y0) + (at(x0 + 1, y0) - at(x0, y0)) * tx;
    const bottom = at(x0, y0 + 1) + (at(x0 + 1, y0 + 1) - at(x0, y0 + 1)) * tx;
    return top + (bottom - top) * ty;
  };
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

// [color, roughness, extra] -- stone roles get the grain.
const ROLES = {
  limestone:        ['#d8cebb', 0.82, { stone: true }],
  'limestone-light': ['#e3dbcb', 0.5, { stone: true, clearcoat: 0.12 }],
  travertine:       ['#cfbfa2', 0.62, { stone: true }],
  paving:           ['#c7bca7', 0.88, { stone: true }],
  basalt:           ['#2e2b28', 0.72, { stone: true }],
  'stone-graphite': ['#433d37', 0.42, { stone: true, clearcoat: 0.35 }],
  onyx:             ['#ffffff', 0.2, { stone: true, clearcoat: 0.8, veined: true }],
  'granite-black':  ['#1f1d1b', 0.26, { stone: true, clearcoat: 0.65 }],
  'marble-light':   ['#ede8e0', 0.22, { stone: true, clearcoat: 0.55 }],
  'marble-warm':    ['#e0d2bd', 0.3, { stone: true, clearcoat: 0.4 }],
  concrete:         ['#8d877e', 0.92, { stone: true }],
  graphite:         ['#34312d', 0.78, {}],
  poche:            ['#2b2825', 0.9, {}],
  plaster:          ['#e6e0d6', 0.95, {}],
  wood:             ['#7a5a42', 0.62, {}],
  'wood-dark':      ['#4b3627', 0.6, {}],
  cabinet:          ['#3a3631', 0.7, {}],
  fabric:           ['#8c8479', 0.97, {}],
  metal:            ['#2e2d2b', 0.38, { metalness: 0.75 }],
  'metal-dark':     ['#45474a', 0.3, { metalness: 0.7 }],
  'glass-black':    ['#0d0d0e', 0.08, { clearcoat: 1 }],
  ceramic:          ['#f2efe9', 0.18, { clearcoat: 0.5 }],
  basin:            ['#bcb8b1', 0.3, {}],
  mirror:           ['#c8ccd0', 0.04, { metalness: 1 }],
  foliage:          ['#4d5a43', 0.92, {}],
  bark:             ['#4a3d31', 0.9, {}],
  lawn:             ['#56604a', 0.96, {}],
  gravel:           ['#a39c8e', 0.95, { stone: true }],
};

export function createMaterials() {
  const grain = new THREE.CanvasTexture(grainCanvas(256, 24));
  grain.wrapS = grain.wrapT = THREE.RepeatWrapping;
  grain.repeat.set(0.8, 0.8);
  const onyx = new THREE.CanvasTexture(onyxCanvas(512, 384));
  onyx.colorSpace = THREE.SRGBColorSpace;
  const cache = new Map();
  const clones = new Map();

  function build(role) {
    if (role === 'glass') {
      return new THREE.MeshPhysicalMaterial({
        color: '#8a959b', roughness: 0.04, metalness: 0, transparent: true, opacity: 0.32,
        envMapIntensity: 1.4, depthWrite: false, side: THREE.DoubleSide,
      });
    }
    const def = ROLES[role] || ROLES.plaster;
    const [color, roughness, extra] = def;
    const params = { color, roughness, metalness: extra.metalness || 0 };
    if (extra.clearcoat) { params.clearcoat = extra.clearcoat; params.clearcoatRoughness = 0.18; }
    if (extra.stone) { params.roughnessMap = grain; params.bumpMap = grain; params.bumpScale = 0.25; }
    if (extra.veined) params.map = onyx;
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
    grain.dispose();
    onyx.dispose();
  }

  return { get, forObject, objectMaterials, joints, dispose };
}
