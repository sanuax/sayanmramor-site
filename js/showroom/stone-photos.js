// js/showroom/stone-photos.js
//
// The real stone photographs the showroom uses -- all from Venezia Stone
// (the supplier of Sayan Mramor's collection), downloaded once as
// optimised WebP into assets/showroom/stone/ (see SOURCES.md there). The
// facade limestone is NOT here: it is our own procedural texture
// (showroom-materials.js).
//
// Two kinds:
//   tile -- the material's main photo, made seamless in the browser and
//           repeated at `tile` metres per image (Steel Grey outside, small
//           Viscont White / Calacatta Nova pieces);
//   slab -- one photographed slab or strip (party + bundle); `slab` is its
//           real size in metres, `detected` the stone's outline in the photo
//           (the rest is the dark studio background). Surfaces take a
//           region of it at true scale (house-model.js `photo`/`photos`).
// `mean` is the photo's measured average colour (sRGB), `target` the tone
// it is balanced to, so photos of one stone taken in different light match.
(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = factory();
  } else {
    root.ShowroomStonePhotos = factory();
  }
})(typeof window !== 'undefined' ? window : globalThis, function () {

  const BASE = '/sayanmramor-site/assets/showroom/stone/';
  const STORAGE = 'https://storage.yandexcloud.net/venezia-photo/';
  // How far inside the detected outline the usable crop starts (a fraction
  // of the photo): clear of chipped edges and the background.
  const INSET = 0.008;

  const PHOTOS = {
    'steel-grey-00933': {
      stone: 'steel-grey', kind: 'tile', page: 'https://veneziastone.com/granite/steel-grey/', source: STORAGE + 'textures1710/00933.JPG',
      tile: [0.9, 0.53], mean: [59, 63, 61], target: [64, 68, 67],
    },
    'viscont-white-01050': {
      stone: 'viscont-white', kind: 'tile', page: 'https://veneziastone.com/granite/viscont-white/', source: STORAGE + 'textures1710/01050.JPG',
      tile: [0.9, 0.53], mean: [159, 164, 156], target: [168, 172, 166],
    },
    'viscont-white-K0534518': {
      stone: 'viscont-white', kind: 'slab', page: 'https://veneziastone.com/granite/viscont-white/', source: STORAGE + 'K0534518.JPG',
      party: '14182', bundle: 'BLK10421', form: 'полоса', slab: [3.3, 0.95],
      detected: [0.0117, 0.0366, 0.9883, 0.997], mean: [131, 135, 123], target: [168, 172, 166],
    },
    'viscont-white-K0534519': {
      stone: 'viscont-white', kind: 'slab', page: 'https://veneziastone.com/granite/viscont-white/', source: STORAGE + 'K0534519.JPG',
      party: '14182', bundle: 'BLK10421', form: 'полоса', slab: [3.3, 0.95],
      detected: [0.0098, 0.0306, 0.9902, 0.9969], mean: [141, 145, 134], target: [168, 172, 166],
    },
    'calacatta-nova-01940': {
      stone: 'calacatta-nova', kind: 'tile', page: 'https://veneziastone.com/marble/calacatta-nova/', source: STORAGE + 'textures1710/01940.JPG',
      tile: [1.2, 0.706], mean: [214, 214, 215], target: [214, 213, 208],
    },
    'calacatta-nova-P0585309': {
      stone: 'calacatta-nova', kind: 'slab', page: 'https://veneziastone.com/marble/calacatta-nova/', source: STORAGE + 'P0585309.JPG',
      party: '14671', bundle: 'BLP03755', form: 'слэб', slab: [2.84, 1.66],
      detected: [0.0391, 0.023, 0.9834, 0.9754], mean: [215, 215, 194], target: [214, 213, 206],
    },
    'calacatta-nova-P0585310': {
      stone: 'calacatta-nova', kind: 'slab', page: 'https://veneziastone.com/marble/calacatta-nova/', source: STORAGE + 'P0585310.JPG',
      party: '14671', bundle: 'BLP03755', form: 'слэб', slab: [2.84, 1.66],
      detected: [0.0391, 0.023, 0.9834, 0.977], mean: [215, 215, 194], target: [214, 213, 206],
    },
    'majestic-M0491372': {
      stone: 'majestic', kind: 'slab', page: 'https://veneziastone.com/marble/majestic/', source: STORAGE + 'M0491372.JPG',
      party: '13747', bundle: 'BLM17290', form: 'слэб', slab: [3.05, 1.88],
      detected: [0.0244, 0.0204, 0.9727, 0.9765], mean: [220, 220, 208], target: [217, 215, 207],
    },
    'majestic-M0491373': {
      stone: 'majestic', kind: 'slab', page: 'https://veneziastone.com/marble/majestic/', source: STORAGE + 'M0491373.JPG',
      party: '13747', bundle: 'BLM17290', form: 'слэб', slab: [3.05, 1.9],
      detected: [0.0264, 0.0361, 0.9619, 0.9843], mean: [221, 221, 209], target: [217, 215, 207],
    },
  };

  // The usable crop of a slab photo ([u0, v0, u1, v1], fractions of the
  // image, v from the top) and its real size in metres.
  function crop(key) {
    const p = PHOTOS[key];
    if (p.kind !== 'slab') return { rect: [0, 0, 1, 1], size: p.tile.slice() };
    const [l, t, r, b] = p.detected;
    const rect = [l + INSET, t + INSET, r - INSET, b - INSET];
    return {
      rect,
      size: [p.slab[0] * (rect[2] - rect[0]) / (r - l), p.slab[1] * (rect[3] - rect[1]) / (b - t)],
    };
  }

  // Linear-light gain that brings the photo's average colour to `target`.
  function gain(key) {
    const p = PHOTOS[key];
    return p.mean.map((m, i) => Math.pow(p.target[i] / m, 2.2));
  }

  function url(key) {
    return BASE + key + '.webp';
  }

  // Lays a w x h metre surface region onto a photo. (u, v): the point on
  // the surface, u to the viewer's right, v up. spec: { src, rotate
  // (the photo's clockwise turn on the surface), mirror (flip u first),
  // offset: [x, y] metres from the crop's top-left ('end' = flush with the
  // far edge), scale (photo metres per surface metre) }. Returns the UV
  // mapping into the cropped photo texture and the region it covers (in
  // photo metres), so tests can check it stays on the stone.
  function photoMap(spec, w, h) {
    const size = crop(spec.src).size;
    const r = spec.rotate || 0, s = spec.scale || 1;
    const ext = r === 90 || r === 270 ? [h, w] : [w, h];
    const off = [0, 1].map(i => (spec.offset && spec.offset[i] === 'end' ? size[i] - ext[i] * s : (spec.offset ? spec.offset[i] : 0)));
    const local = (u, v) => {
      if (spec.mirror) u = w - u;
      if (r === 90) return [h - v, w - u];
      if (r === 180) return [w - u, v];
      if (r === 270) return [v, u];
      return [u, h - v];
    };
    return {
      uv(u, v) {
        const [px, py] = local(u, v);
        return [(off[0] + px * s) / size[0], 1 - (off[1] + py * s) / size[1]];
      },
      region: [off[0], off[1], off[0] + ext[0] * s, off[1] + ext[1] * s],
      size,
    };
  }

  return { PHOTOS, crop, gain, url, photoMap, BASE };
});
