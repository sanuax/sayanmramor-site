// js/showroom/showroom-materials.js
//
// Material roles used by house-model.js -> Three.js materials.
//
// The house is one set of stones:
//   - our own light limestone (facades, frames, fence, paving) --
//     procedural, drawn once on a canvas: soft clouds, faint bedding, a few
//     pores and calcite specks, no veins; one large (4 m) non-repeating
//     field that every slab samples at its own random offset, so no two
//     neighbouring slabs show the same patch;
//   - Steel Grey, Viscont White, Calacatta Nova, Majestic -- real Venezia
//     Stone photographs (stone-photos.js): a material's main photo made
//     seamless and repeated at true size, or a region of a real slab.
// Floors are warm oak boards (procedural too); the bathroom's is stone.
// The procedural images are painted in Web Workers (the same code, so the
// same pixels) while the page builds the scene; `ready` says when they are
// in. Photos load in the background after the first frame, one at a time,
// the zone in view first (loadPhotos); until then the stone shows its
// measured average colour, so nothing flashes. Relief and roughness: a
// shared fine grain, and for Steel Grey's leathered finish the photo's own
// grain as bump. All materials multiply by vertex colour (the renderer
// tints procedural slabs slightly differently). One shared material per
// role (+ photo); objects that can be highlighted get their own clone (see
// forObject) so highlighting one never tints the others.
import * as THREE from '../../vendor/three/three.module.js';

// ---- painters ----------------------------------------------------------------
// Plain functions that use nothing but each other: the page runs them, or
// sends their source to a Web Worker (createPainters) -- the pixels are the
// same either way.

function rng(seed) {
  let s = seed;
  return () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
}

// n random values in [0, 1), in order.
function randoms(n, rand) {
  const g = new Float32Array(n);
  for (let i = 0; i < n; i++) g[i] = rand();
  return g;
}

// Tileable value noise on an n x n lattice.
function lattice(n, rand) {
  const g = randoms(n * n, rand);
  const smooth = t => t * t * (3 - 2 * t);
  return (x, y) => {
    const x0 = Math.floor(x), y0 = Math.floor(y), tx = smooth(x - x0), ty = smooth(y - y0);
    const at = (a, b) => g[((b % n) + n) % n * n + (((a % n) + n) % n)];
    const top = at(x0, y0) + (at(x0 + 1, y0) - at(x0, y0)) * tx;
    const bottom = at(x0, y0 + 1) + (at(x0 + 1, y0 + 1) - at(x0, y0 + 1)) * tx;
    return top + (bottom - top) * ty;
  };
}

function clamp255(x) {
  return Math.max(0, Math.min(255, Math.round(x)));
}

// RGBA bytes of rows y0..y1 of a size x size image; fn(u, v) -> [r, g, b].
function paintPixels(size, fn, y0 = 0, y1 = size) {
  const data = new Uint8ClampedArray(size * (y1 - y0) * 4);
  for (let y = y0; y < y1; y++) {
    for (let x = 0; x < size; x++) {
      const [r, g, b] = fn(x / size, y / size);
      const k = ((y - y0) * size + x) * 4;
      data[k] = r; data[k + 1] = g; data[k + 2] = b; data[k + 3] = 255;
    }
  }
  return data;
}

// Grain for roughness and bump (grey, two octaves).
function grainPixels(size, cells) {
  const rand = rng(20240917);
  const lo = lattice(cells, rand), hi = lattice(cells * 4, rand);
  return paintPixels(size, (u, v) => {
    const c = Math.round(170 + 85 * (lo(u * cells, v * cells) * 0.65 + hi(u * cells * 4, v * cells * 4) * 0.35));
    return [c, c, c];
  });
}

// Our limestone: a warm, light, matt stone with a visible fine-grained
// body. Broad clouds a few tenths of a metre across, a mid-scale mottle,
// a sandy grain you see up close, faint horizontal bedding, a slight
// warm/cool drift, small darker pores and lighter calcite / shell specks.
// No veins. Centred a little under white: the role colour carries the tone.
function limestonePixels(size, y0, y1) {
  const rand = rng(90173);
  const cloud = lattice(6, rand), mottle = lattice(26, rand), fine = lattice(140, rand), sand = lattice(420, rand), bed = lattice(7, rand), drift = lattice(3, rand);
  const cells = 700, spots = randoms(cells * cells, rand);
  return paintPixels(size, (u, v) => {
    const c = cloud(u * 6, v * 6) - 0.5;
    const m = mottle(u * 26, v * 26) - 0.5;
    const f = fine(u * 140, v * 140) - 0.5;
    const g = sand(u * 420, v * 420) - 0.5;
    const b = bed(u * 7, v * 70) - 0.5;
    const spot = spots[Math.floor(v * cells) * cells + Math.floor(u * cells)];
    const pore = spot > 0.994 ? -0.16 : 0, shell = spot < 0.004 ? 0.07 : 0;
    const d = c * 0.16 + m * 0.085 + f * 0.06 + g * 0.07 + b * 0.04 + pore + shell;
    const w = (drift(u * 3, v * 3) - 0.5) * 0.07;   // warm (>0) / cool (<0)
    const L = 230 * (1 + d);
    return [clamp255(L * (1 + w * 0.6)), clamp255(L), clamp255(L * (1 - w))];
  }, y0, y1);
}

// Oak boards: long fine grain along u, soft cathedral figure, open pores,
// a little tone drift -- calm, no knots. Covers 4 m along the grain and 1 m
// across; every board takes its own random stretch of it.
function oakPixels(w, h, y0 = 0, y1 = h) {
  const rand = rng(51277);
  const streak = lattice(512, rand), figure = lattice(9, rand), bend = lattice(5, rand), pores = lattice(900, rand), drift = lattice(4, rand);
  const data = new Uint8ClampedArray(w * (y1 - y0) * 4);
  for (let y = y0; y < y1; y++) {
    for (let x = 0; x < w; x++) {
      const u = x / w, v = y / h;
      const wob = (bend(u * 5, v * 5) - 0.5) * 0.06;
      const gy = (v + wob) * 512;
      const grain = streak(u * 6, gy) - 0.5;                                    // long fine lines
      const ring = Math.sin((v + wob * 3 + (figure(u * 9, v * 2) - 0.5) * 0.2) * Math.PI * 38);
      const cathedral = Math.pow(Math.abs(ring), 8) * 0.5;                      // soft figure
      const pore = pores(u * 60, gy * 1.75) > 0.86 ? -0.07 : 0;
      const d = grain * 0.1 - cathedral * 0.07 + pore + (drift(u * 4, v * 4) - 0.5) * 0.06;
      const L = 228 * (1 + d);
      const k = ((y - y0) * w + x) * 4;
      data[k] = clamp255(L * 1.02); data[k + 1] = clamp255(L * 0.99); data[k + 2] = clamp255(L * 0.94); data[k + 3] = 255;
    }
  }
  return data;
}

// Small colour maps for the non-stone roles.
function detailPixels(kind, size) {
  const rand = rng({ speckle: 41, wood: 53, lawn: 67 }[kind]);
  const n1 = lattice(4, rand), n2 = lattice(16, rand), n3 = lattice(64, rand);
  const fbm = (u, v) => n1(u * 4, v * 4) * 0.55 + n2(u * 16, v * 16) * 0.3 + n3(u * 64, v * 64) * 0.15;
  const tone = (d, warm) => [236 + d * 26, 236 + d * (26 - warm * 4), 236 + d * (26 - warm * 10)].map(clamp255);
  return paintPixels(size, (u, v) => {
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
// outer bands are cross-faded. RGBA bytes in, new RGBA bytes out.
function seamlessPixels(data, w, h) {
  let src = data;
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
  return src;
}

const PAINTERS = [rng, randoms, lattice, clamp255, paintPixels, grainPixels, limestonePixels, oakPixels, detailPixels, seamlessPixels];
const JOBS = { grain: grainPixels, limestone: limestonePixels, oak: oakPixels, detail: detailPixels, seamless: seamlessPixels };

// A few workers running the painters off the main thread. A job goes to
// the least loaded one (`cost`: a rough weight); wherever workers are not
// available or fail, the job runs on the page instead -- same pixels.
function createPainters(count) {
  const workers = [];
  const pending = new Map();
  let nextId = 0;
  const local = (job, args) => Promise.resolve().then(() => JOBS[job](...args));
  try {
    if (typeof Worker !== 'undefined' && typeof Blob !== 'undefined' && URL.createObjectURL) {
      const source = PAINTERS.map(String).join('\n') +
        '\nconst JOBS = { grain: grainPixels, limestone: limestonePixels, oak: oakPixels, detail: detailPixels, seamless: seamlessPixels };' +
        '\nonmessage = e => { const { id, job, args } = e.data; const data = JOBS[job](...args); postMessage({ id, data }, [data.buffer]); };';
      const url = URL.createObjectURL(new Blob([source], { type: 'text/javascript' }));
      for (let i = 0; i < count; i++) {
        const worker = { thread: new Worker(url), load: 0, alive: true };
        worker.thread.onmessage = e => {
          const job = pending.get(e.data.id);
          if (!job) return;
          pending.delete(e.data.id);
          worker.load -= job.cost;
          job.resolve(e.data.data);
        };
        worker.thread.onerror = e => {
          if (e.preventDefault) e.preventDefault();
          worker.alive = false;
          pending.forEach((job, id) => {
            if (job.worker !== worker) return;
            pending.delete(id);
            local(job.job, job.args).then(job.resolve);
          });
        };
        workers.push(worker);
      }
    }
  } catch (e) { /* no workers: everything runs on the page */ }

  function run(job, args, cost = 1) {
    const alive = workers.filter(w => w.alive);
    if (!alive.length) return local(job, args);
    const worker = alive.reduce((a, b) => (b.load < a.load ? b : a));
    return new Promise(resolve => {
      const id = nextId++;
      pending.set(id, { worker, job, args, cost, resolve });
      worker.load += cost;
      try {
        worker.thread.postMessage({ id, job, args });
      } catch (e) {
        pending.delete(id);
        worker.load -= cost;
        local(job, args).then(resolve);
      }
    });
  }

  function dispose() {
    workers.forEach(w => w.thread.terminate());
    workers.length = 0;
  }

  return { run, dispose };
}

function canvasFor(w, h) {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  return canvas;
}

// Up to the next frame and past it: the next step of a background job
// runs in a task of its own, after the browser has had a chance to paint.
function nextFrame() {
  return new Promise(resolve => requestAnimationFrame(() => setTimeout(resolve, 0)));
}

// [colour, roughness, extra]. `detail` names the colour map family,
// `stone` adds the roughness/relief grain, `tint` is how much neighbouring
// slabs/blocks of this role may differ in tone (see the renderer). `photo`
// roles take their map from stone-photos.js: `tile` names the main photo
// used when a surface has no slab of its own; `bump` uses the photo's
// grain as relief.
const ROLES = {
  limestone:          ['#e0d2b8', 0.86, { limestone: true, tint: 0.07 }],
  'limestone-light':  ['#e8ddc8', 0.7, { limestone: true, tint: 0.04 }],
  paving:             ['#d4c6ac', 0.9, { limestone: true, tint: 0.06 }],
  'wood-floor':       ['#cbad8b', 0.58, { oak: true, tint: 0.06 }],
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
  rug:                ['#857c70', 1, { detail: 'speckle' }],
  shade:              ['#f1e8d8', 0.9, { emissive: '#ffcf9a', emissiveIntensity: 0.6 }],
  metal:              ['#2c2b29', 0.38, { metalness: 0.75 }],
  steel:              ['#c4c4c1', 0.3, { metalness: 0.95 }],
  'hob-ring':         ['#46464a', 0.45, {}],
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
const LIMESTONE_SIZE = 4;   // metres covered by one limestone image
const OAK_SIZE = [4, 1];    // metres covered by one oak image (along, across the grain)

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

// upload(texture): puts a texture on the GPU now (the renderer's
// initTexture), so a photo's upload gets a frame of its own.
export function createMaterials({ Photos, anisotropy = 4, onChange, upload } = {}) {
  const painters = createPainters(Math.max(1, Math.min(4, (navigator.hardwareConcurrency || 2) - 1)));

  // Procedural textures: their canvases exist (at their final size) from
  // the start, so every material and shader is set up at once; the pixels
  // arrive from the painters before the first frame (`ready`). The two big
  // images are painted in horizontal bands, one job each, so the workers
  // share them.
  const paintJobs = [];
  const painted = (w, h, job, args, { bands = 1, cost = 1 } = {}) => {
    const canvas = canvasFor(w, h);
    for (let i = 0; i < bands; i++) {
      const y0 = Math.round(h * i / bands), y1 = Math.round(h * (i + 1) / bands);
      const bandArgs = bands > 1 ? args.concat([y0, y1]) : args;
      paintJobs.push(painters.run(job, bandArgs, cost).then(data => {
        canvas.getContext('2d').putImageData(new ImageData(data, w, y1 - y0), 0, y0);
      }));
    }
    return canvas;
  };
  const limestoneImage = painted(1024, 1024, 'limestone', [1024], { bands: 4, cost: 4 });
  const oakImage = painted(2048, 512, 'oak', [2048, 512], { bands: 4, cost: 4 });
  const grainImage = painted(256, 256, 'grain', [256, 24]);
  const detailImages = {};
  Object.keys(DETAIL_SIZE).forEach(kind => { detailImages[kind] = painted(256, 256, 'detail', [kind, 256]); });

  const grain = new THREE.CanvasTexture(grainImage);
  grain.wrapS = grain.wrapT = THREE.RepeatWrapping;
  grain.repeat.set(1.25, 1.25);
  // Leaf-scale relief for foliage masses (the same grain, much finer).
  const leaf = grain.clone();
  leaf.repeat.set(9, 5);
  const limestone = new THREE.CanvasTexture(limestoneImage);
  limestone.colorSpace = THREE.SRGBColorSpace;
  limestone.wrapS = limestone.wrapT = THREE.RepeatWrapping;
  limestone.repeat.set(1 / LIMESTONE_SIZE, 1 / LIMESTONE_SIZE);
  limestone.anisotropy = anisotropy;
  // The limestone's own body as its relief (grain, pores), much finer
  // than a generic noise: the facade reads as stone, not render.
  // Its own Source (the same canvas): three.js tracks re-uploads per
  // source, and this linear copy must follow the painted pixels too.
  const limestoneRelief = limestone.clone();
  limestoneRelief.source = new THREE.Source(limestoneImage);
  limestoneRelief.colorSpace = THREE.NoColorSpace;
  const oak = new THREE.CanvasTexture(oakImage);
  oak.colorSpace = THREE.SRGBColorSpace;
  oak.wrapS = oak.wrapT = THREE.RepeatWrapping;
  oak.repeat.set(1 / OAK_SIZE[0], 1 / OAK_SIZE[1]);
  oak.anisotropy = anisotropy;
  const details = new Map();
  Object.keys(DETAIL_SIZE).forEach(kind => {
    const t = new THREE.CanvasTexture(detailImages[kind]);
    t.colorSpace = THREE.SRGBColorSpace;
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(1 / DETAIL_SIZE[kind], 1 / DETAIL_SIZE[kind]);
    t.anisotropy = 4;
    details.set(kind, t);
  });
  const detail = kind => details.get(kind);
  const procedural = [grain, leaf, limestone, limestoneRelief, oak, ...details.values()];
  const ready = Promise.all(paintJobs).then(() => { procedural.forEach(t => { t.needsUpdate = true; }); });

  const cache = new Map();
  const clones = new Map();

  // ---- photos ---------------------------------------------------------------
  // One photo at a time, in the order the showroom asks (the zone in view
  // first), never all at once. Each goes through small steps with a frame
  // in between -- decode off the main thread, crop, make a tile seamless in
  // a worker, upload to the GPU, show -- so no frame carries a whole photo.
  // A photo material is built for its photo from the start (a white 1 x 1
  // stand-in map, which changes nothing on screen), so the photo arriving
  // swaps a texture instead of compiling a new shader.
  const blank = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1);
  blank.colorSpace = THREE.SRGBColorSpace;
  blank.needsUpdate = true;
  const photoTextures = new Map();   // key -> THREE.Texture, once on the GPU
  const photoUsers = new Map();      // key -> Set of materials showing it
  const photoDone = new Map();       // key -> { promise, resolve }
  const queue = [];                  // keys waiting their turn
  let current = null;                // key in progress

  function done(key) {
    if (!photoDone.has(key)) {
      let resolve;
      const promise = new Promise(r => { resolve = r; });
      photoDone.set(key, { promise, resolve });
    }
    return photoDone.get(key);
  }

  function photoTexture(key, img) {
    const photo = Photos.PHOTOS[key];
    const { rect } = Photos.crop(key);
    const iw = img.naturalWidth || img.width, ih = img.naturalHeight || img.height;
    const sx = rect[0] * iw, sy = rect[1] * ih;
    const sw = (rect[2] - rect[0]) * iw, sh = (rect[3] - rect[1]) * ih;
    const k = Math.min(1, photoMaxSize(photo) / Math.max(sw, sh));
    const canvas = canvasFor(Math.round(sw * k), Math.round(sh * k));
    canvas.getContext('2d').drawImage(img, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
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

  // The photo, decoded off the main thread (a failure keeps the flat colour).
  async function decodePhoto(key) {
    if (window.createImageBitmap && window.fetch) {
      const response = await fetch(Photos.url(key));
      if (!response.ok) throw new Error(response.status);
      return createImageBitmap(await response.blob());
    }
    const img = new Image();
    img.src = Photos.url(key);
    await img.decode();
    return img;
  }

  async function showPhoto(key) {
    const img = await decodePhoto(key);
    await nextFrame();
    const t = photoTexture(key, img);
    if (img.close) img.close();
    if (Photos.PHOTOS[key].kind === 'tile') {
      const canvas = t.image, w = canvas.width, h = canvas.height, ctx = canvas.getContext('2d');
      const data = await painters.run('seamless', [ctx.getImageData(0, 0, w, h).data, w, h]);
      await nextFrame();
      ctx.putImageData(new ImageData(data, w, h), 0, 0);
    }
    if (upload) {
      await nextFrame();
      upload(t);
    }
    await nextFrame();
    photoTextures.set(key, t);
    (photoUsers.get(key) || []).forEach(m => applyPhoto(m, key));
    if (onChange) onChange();
  }

  async function pump() {
    if (current) return;
    while (queue.length) {
      current = queue.shift();
      try { await showPhoto(current); } catch (e) { /* keep the flat stone colour */ }
      done(current).resolve();
      current = null;
    }
    // Every photo in: the workers have nothing left to do.
    if (photoTextures.size === photoUsers.size) painters.dispose();
  }

  // Queue the photos of these stones (every photo in use when omitted), in
  // the stones' order; `first` puts them ahead of whatever is waiting.
  // Resolves once they are all shown (or given up on).
  function loadPhotos(stones, { first = false } = {}) {
    const rank = key => (stones ? stones.indexOf(Photos.PHOTOS[key].stone) : 0);
    const keys = Array.from(photoUsers.keys()).filter(key => rank(key) >= 0).sort((a, b) => rank(a) - rank(b));
    const waiting = keys.filter(key => !photoTextures.has(key) && key !== current);
    if (first) {
      waiting.forEach(key => { const i = queue.indexOf(key); if (i >= 0) queue.splice(i, 1); });
      queue.unshift(...waiting);
    } else {
      waiting.forEach(key => { if (!queue.includes(key)) queue.push(key); });
    }
    pump();
    return Promise.all(keys.map(key => done(key).promise));
  }

  function usePhoto(material, key) {
    material.userData.photoKey = key;
    if (!photoUsers.has(key)) photoUsers.set(key, new Set());
    photoUsers.get(key).add(material);
    if (photoTextures.has(key)) applyPhoto(material, key);
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
    if (extra.limestone) { params.map = limestone; params.bumpMap = limestoneRelief; params.bumpScale = 0.9; params.roughnessMap = grain; }
    if (extra.oak) { params.map = oak; params.bumpMap = oak; params.bumpScale = 0.25; }
    if (extra.detail) params.map = detail(extra.detail);
    if (extra.emissive) { params.emissive = extra.emissive; params.emissiveIntensity = extra.emissiveIntensity; }
    const key = photoKey || extra.tile;
    const withPhoto = extra.photo && key && Photos && Photos.PHOTOS[key];
    if (withPhoto) {
      params.map = blank;
      if (extra.bump) { params.bumpMap = blank; params.bumpScale = extra.bump; }
    }
    const material = new THREE.MeshPhysicalMaterial(params);
    material.userData.roleExtra = extra;
    if (withPhoto) {
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
    queue.length = 0;
    painters.dispose();
    cache.forEach(m => m.dispose());
    clones.forEach(m => m.dispose());
    Object.values(joints).forEach(m => m.dispose());
    details.forEach(t => t.dispose());
    photoTextures.forEach(t => t.dispose());
    blank.dispose();
    grain.dispose();
    leaf.dispose();
    limestone.dispose();
    limestoneRelief.dispose();
    oak.dispose();
  }

  return { get, forObject, objectMaterials, joints, loadPhotos, ready, dispose };
}

export { LIMESTONE_SIZE };
