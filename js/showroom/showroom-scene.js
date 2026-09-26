// js/showroom/showroom-scene.js
//
// One WebGL renderer and one scene for the whole house. Builds meshes from
// HouseModel parts (batched: one mesh per group + material + object, see
// showroom-geometry.js), lays real stone photographs on the pieces cut
// from them (stone-photos.js), lights them like an architectural
// photograph (a warm low sun with soft shadows, a sky-dome environment for
// reflections, a few warm interior lights), and exposes what the app
// needs: hide/show cut-away groups, highlight an object, test whether a
// marker is hidden behind something, render.
import * as THREE from '../../vendor/three/three.module.js';
import { createMaterials, roleTint } from './showroom-materials.js';
import { hash3, createBatch, pushBox, pushSlab, pushCylinder, pushBeam, toGeometry, withWhite, blobGeometry } from './showroom-geometry.js';

const SKY_TOP = '#8d989e';
const SKY_HORIZON = '#e6dccb';
const FOG_COLOR = '#d8d0c2';
const WHITE = [1, 1, 1];

function skyTexture() {
  const c = document.createElement('canvas');
  c.width = 2; c.height = 512;
  const g = c.getContext('2d');
  const grad = g.createLinearGradient(0, 0, 0, 512);
  grad.addColorStop(0, SKY_TOP);
  grad.addColorStop(0.6, SKY_HORIZON);
  grad.addColorStop(1, '#d3c9b8');
  g.fillStyle = grad;
  g.fillRect(0, 0, 2, 512);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// Soft outdoor environment for reflections on glass, polished stone and
// metal: a sky dome with a bright warm sun disc and a darker ground.
function buildEnvironment(renderer) {
  const pmrem = new THREE.PMREMGenerator(renderer);
  const env = new THREE.Scene();
  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(50, 32, 16),
    new THREE.MeshBasicMaterial({ side: THREE.BackSide, map: skyTexture() }),
  );
  env.add(dome);
  const ground = new THREE.Mesh(new THREE.CircleGeometry(49, 32), new THREE.MeshBasicMaterial({ color: '#57584a' }));
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -2;
  env.add(ground);
  const sun = new THREE.Mesh(new THREE.SphereGeometry(4, 16, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color(6, 5.3, 4.2) }));
  sun.position.set(-24, 26, 24);
  env.add(sun);
  const texture = pmrem.fromScene(env, 0.02).texture;
  env.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material) { if (o.material.map) o.material.map.dispose(); o.material.dispose(); } });
  pmrem.dispose();
  return texture;
}

// A slight, deterministic difference in tone between neighbouring stones:
// lightness +-amount, a touch warmer or cooler.
function tint(amount, x, y, z) {
  if (!amount) return WHITE;
  const l = 1 + (hash3(x, y, z) - 0.5) * 2 * amount;
  const w = (hash3(z + 3.1, x - 1.7, y + 0.3) - 0.5) * amount * 0.6;
  return [l * (1 + w), l, l * (1 - w)];
}

function uvOffset(x, y, z) {
  return [hash3(y - 5.3, z, x) * 4, hash3(x + 2.9, y, z - 7.1) * 4];
}

export function createShowroomScene(canvas, { House, Photos, onChange }) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.95;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  // The house is static: shadows are recomputed only when the cut-away changes.
  renderer.shadowMap.autoUpdate = false;
  renderer.shadowMap.needsUpdate = true;

  const scene = new THREE.Scene();
  const background = skyTexture();
  scene.background = background;
  scene.fog = new THREE.Fog(FOG_COLOR, 60, 160);
  scene.environment = buildEnvironment(renderer);

  const materials = createMaterials({
    Photos, anisotropy: renderer.capabilities.getMaxAnisotropy(), onChange,
    upload: texture => renderer.initTexture(texture),
  });

  // Light: a warm late-afternoon sun from the south-west, raking across the
  // street facade (so piers, frames and joints model), sky fill, and a few
  // warm interior lights.
  scene.add(new THREE.HemisphereLight('#f2eadc', '#5a5646', 0.45));
  const sun = new THREE.DirectionalLight('#ffe2c0', 2.7);
  sun.position.set(-13, 17, 16);
  sun.target.position.set(0, 1, 0);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -17, right: 17, top: 16, bottom: -16, near: 1, far: 70 });
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.03;
  scene.add(sun, sun.target);
  (House.LIGHTS || []).forEach(l => {
    const light = new THREE.PointLight(l.color, l.intensity, l.distance, 2);
    light.position.set(...l.position);
    scene.add(light);
  });

  // ---- house -----------------------------------------------------------------
  const groups = new Map();
  const objectMeshes = new Map();
  const groupOf = name => {
    if (!groups.has(name)) {
      const g = new THREE.Group();
      g.name = name;
      groups.set(name, g);
      scene.add(g);
    }
    return groups.get(name);
  };
  const batches = new Map();
  // One batch per group + material + object + the slab photo it is cut from.
  const batchFor = (part, src) => {
    const key = part.group + '|' + part.mat + '|' + (part.object || '') + '|' + (src || '');
    if (!batches.has(key)) batches.set(key, Object.assign(createBatch(), { group: part.group, mat: part.mat, object: part.object || null, src: src || null }));
    return batches.get(key);
  };
  const clampTo = (x, lo, hi) => Math.max(lo, Math.min(hi, x));
  const jointBuckets = new Map();
  const blobs = { foliage: [] };
  const trunks = [];

  function boxStyle(part) {
    const c = [0, 1, 2].map(i => (part.min[i] + part.max[i]) / 2);
    const style = { bevel: part.bevel || 0, color: tint(roleTint(part.mat) * 0.6, c[0], c[1], c[2]), uvOffset: uvOffset(c[0], c[1], c[2]) };
    if (part.photo && Photos) {
      // A piece cut from a real slab: its face shows the slab region at true
      // scale; a face turned away from it (a thin edge) folds the pattern
      // over the arris -- the stone continues round the corner, as on a
      // mitred edge -- instead of smearing one row of the photo.
      // `area`: the whole piece the photo is laid on, when this box is one
      // part of it (a worktop cut round a sink), so the pattern runs on.
      const spec = part.photo, mn = spec.area ? spec.area.min : part.min, mx = spec.area ? spec.area.max : part.max;
      const plane = spec.plane || 'y', normal = spec.normal || 1;
      const d = [0, 1, 2].map(i => mx[i] - mn[i]);
      // u/v directions on the photo face, its normal, its origin, and each
      // point's depth below that face.
      const frame = plane === 'y' ? { w: d[0], h: d[2], U: [1, 0, 0], V: [0, 0, -1], N: [0, 1, 0], o: [mn[0], 0, mx[2]], depth: q => mx[1] - q[1] }
        : plane === 'x' ? { w: d[2], h: d[1], U: [0, 0, -normal], V: [0, 1, 0], N: [normal, 0, 0], o: [0, mn[1], normal > 0 ? mx[2] : mn[2]], depth: q => (normal > 0 ? mx[0] - q[0] : q[0] - mn[0]) }
          : { w: d[0], h: d[1], U: [normal, 0, 0], V: [0, 1, 0], N: [0, 0, normal], o: [normal > 0 ? mn[0] : mx[0], mn[1], 0], depth: q => (normal > 0 ? mx[2] - q[2] : q[2] - mn[2]) };
      const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
      const map = Photos.photoMap(spec, frame.w, frame.h);
      style.color = WHITE;
      style.uvOffset = [0, 0];
      style.uvOf = (q, n) => {
        const rel = [q[0] - frame.o[0], q[1] - frame.o[1], q[2] - frame.o[2]];
        let u = clampTo(dot(rel, frame.U), 0, frame.w), v = clampTo(dot(rel, frame.V), 0, frame.h);
        if (Math.abs(dot(n, frame.N)) < 0.5) {
          const depth = frame.depth(q);
          u += depth * dot(n, frame.U);
          v += depth * dot(n, frame.V);
        }
        return map.uv(u, v);
      };
    }
    return style;
  }

  // The slab photo on one cladding slab (rect in its plane's a/b axes).
  function slabPhotoUV(part, spec, rect) {
    const w = rect.a1 - rect.a0, h = rect.b1 - rect.b0, map = Photos.photoMap(spec, w, h);
    const ab = q => (part.plane === 'z' ? [q[0], q[1]] : part.plane === 'x' ? [q[2], q[1]] : [q[0], q[2]]);
    return q => {
      const [a, b] = ab(q);
      let u = part.plane === 'x' ? (part.normal > 0 ? rect.a1 - a : a - rect.a0) : part.plane === 'z' ? (part.normal > 0 ? a - rect.a0 : rect.a1 - a) : a - rect.a0;
      let v = part.plane === 'y' ? rect.b1 - b : b - rect.b0;
      return map.uv(clampTo(u, 0, w), clampTo(v, 0, h));
    };
  }

  function addTree(part) {
    const [x, , z] = part.position, r = part.crown, t = part.trunk;
    const R = i => hash3(x + i * 1.7, i * 0.37, z - i * 2.3);
    trunks.push({ from: [x, 0, z], to: [x, t + r * 0.7, z], radius: r * 0.07 });
    for (let i = 0; i < 3; i++) {
      const a = R(i) * Math.PI * 2;
      trunks.push({ from: [x, t * 0.75, z], to: [x + Math.cos(a) * r * 0.55, t + r * (0.4 + R(i + 40) * 0.3), z + Math.sin(a) * r * 0.55], radius: r * 0.032 });
    }
    blobs.foliage.push({ p: [x, t + r * 1.0, z], s: [r * 0.78, r * 0.7, r * 0.78], shade: R(9) });
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + R(i + 3) * 0.8;
      const d = r * (0.42 + R(i + 11) * 0.22);
      const s = r * (0.48 + R(i + 17) * 0.2);
      blobs.foliage.push({ p: [x + Math.cos(a) * d, t + r * (0.55 + R(i + 23) * 0.65), z + Math.sin(a) * d], s: [s, s * 0.82, s], shade: R(i + 29) });
    }
  }

  House.buildHouse().forEach(part => {
    if (part.kind === 'box') {
      pushBox(batchFor(part, part.photo && part.photo.src), part.min, part.max, boxStyle(part));
    } else if (part.kind === 'cladding') {
      const amount = roleTint(part.mat);
      const n0 = part.at, n1 = part.at + part.normal * part.depth, g = part.gap / 2;
      House.claddingSlabs(part).forEach((s, i) => {
        const ca = (s.a0 + s.a1) / 2, cb = (s.b0 + s.b1) / 2;
        const spec = part.photos && Photos ? part.photos[i] : null;
        const b = batchFor(part, spec && spec.src);
        const style = spec
          ? { color: WHITE, uvOffset: [0, 0], uvOf: slabPhotoUV(part, spec, s) }
          : { color: tint(amount, ca, cb, n1), uvOffset: uvOffset(ca, cb, n0) };
        // Joints: half a gap off each slab edge, except at the surface's own border.
        const a0 = s.a0 + (s.a0 > part.a[0] + 1e-6 ? g : 0), a1 = s.a1 - (s.a1 < part.a[1] - 1e-6 ? g : 0);
        const b0 = s.b0 + (s.b0 > part.b[0] + 1e-6 ? g : 0), b1 = s.b1 - (s.b1 < part.b[1] - 1e-6 ? g : 0);
        pushSlab(b, part.plane, a0, a1, b0, b1, n0, n1, part.chamfer, style);
      });
    } else if (part.kind === 'slats') {
      // A row of vertical fins: each one a thin box across the run.
      const b = batchFor(part), along = part.axis === 'x' ? 0 : 2;
      const len = part.max[along] - part.min[along];
      const count = Math.max(1, Math.floor((len - part.width) / part.pitch) + 1);
      const start = part.min[along] + (len - (count - 1) * part.pitch - part.width) / 2;
      for (let k = 0; k < count; k++) {
        const min = part.min.slice(), max = part.max.slice();
        min[along] = start + k * part.pitch;
        max[along] = min[along] + part.width;
        pushBox(b, min, max, { color: WHITE, uvOffset: [0, 0] });
      }
    } else if (part.kind === 'beam') {
      pushBeam(batchFor(part), part.from, part.to, part.width, part.height, { color: WHITE, uvOffset: [0, 0] });
    } else if (part.kind === 'cyl') {
      const r = part.radius, rt = part.radiusTop === undefined ? r : part.radiusTop;
      pushCylinder(batchFor(part), part.base, r, rt, part.height, Math.max(rt, r) > 0.1 ? 32 : 16, { color: WHITE, uvOffset: [0, 0] });
    } else if (part.kind === 'joints') {
      const key = part.group + '|' + part.tone;
      if (!jointBuckets.has(key)) jointBuckets.set(key, { group: part.group, tone: part.tone, segs: [] });
      House.jointSegments(part).forEach(s => jointBuckets.get(key).segs.push(...s));
    } else if (part.kind === 'tree') {
      addTree(part);
    }
  });

  batches.forEach(b => {
    const material = b.object ? materials.forObject(b.mat, b.object, b.src) : materials.get(b.mat, b.src);
    const mesh = new THREE.Mesh(toGeometry(b), material);
    const isGlass = b.mat === 'glass' || b.mat === 'glass-smoke', isLamp = b.mat === 'lamp';
    mesh.castShadow = !isGlass && !isLamp;
    mesh.receiveShadow = !isGlass && !isLamp;
    mesh.userData.role = b.mat;
    groupOf(b.group).add(mesh);
    if (b.object) {
      if (!objectMeshes.has(b.object)) objectMeshes.set(b.object, []);
      objectMeshes.get(b.object).push(mesh);
    }
  });
  jointBuckets.forEach(({ group, tone, segs }) => {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(segs, 3));
    groupOf(group).add(new THREE.LineSegments(geometry, materials.joints[tone]));
  });

  // Trees: instanced foliage masses and trunks.
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), v = new THREE.Vector3(), s3 = new THREE.Vector3(), yAxis = new THREE.Vector3(0, 1, 0);
  const blob = blobGeometry();
  Object.entries(blobs).forEach(([role, list]) => {
    if (!list.length) return;
    const mesh = new THREE.InstancedMesh(blob, materials.get(role), list.length);
    const c = new THREE.Color();
    list.forEach((it, i) => {
      q.setFromAxisAngle(yAxis, it.shade * Math.PI * 2);
      m4.compose(v.set(...it.p), q, s3.set(...it.s));
      mesh.setMatrixAt(i, m4);
      const k = 0.86 + it.shade * 0.24;
      mesh.setColorAt(i, c.setRGB(k * (0.97 + it.shade * 0.06), k, k * (1.02 - it.shade * 0.08)));
    });
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    groupOf('site').add(mesh);
  });
  if (trunks.length) {
    const unit = new THREE.CylinderGeometry(0.62, 1, 1, 10);
    unit.translate(0, 0.5, 0);
    const mesh = new THREE.InstancedMesh(withWhite(unit), materials.get('bark'), trunks.length);
    trunks.forEach((t, i) => {
      const from = new THREE.Vector3(...t.from), to = new THREE.Vector3(...t.to);
      const dir = to.clone().sub(from);
      q.setFromUnitVectors(yAxis, dir.clone().normalize());
      m4.compose(from, q, s3.set(t.radius, dir.length(), t.radius));
      mesh.setMatrixAt(i, m4);
    });
    mesh.castShadow = true;
    groupOf('site').add(mesh);
  }

  // ---- visibility, highlight, occlusion ----------------------------------------------
  let occluders = [];
  function refreshOccluders() {
    occluders = [];
    groups.forEach(g => {
      if (!g.visible) return;
      g.children.forEach(o => {
        if (o.isMesh && !o.isInstancedMesh && !['glass', 'glass-smoke', 'lamp'].includes(o.userData.role)) occluders.push(o);
      });
    });
  }

  function setHiddenGroups(hidden) {
    groups.forEach((g, name) => { g.visible = !hidden.includes(name); });
    renderer.shadowMap.needsUpdate = true;
    refreshOccluders();
  }

  let highlighted = null;
  function setHighlight(objectId) {
    if (highlighted) materials.objectMaterials(highlighted).forEach(m => { m.emissive.set('#000000'); });
    highlighted = objectId;
    // A faint warm lift -- enough to say "this one", never enough to change
    // how the stone itself reads.
    if (objectId) materials.objectMaterials(objectId).forEach(m => { m.emissive.set('#2a2016'); m.emissiveIntensity = 0.35; });
  }

  const raycaster = new THREE.Raycaster();
  const tmp = new THREE.Vector3();
  // Is the anchor of `objectId` hidden behind another surface?
  function isOccluded(camera, anchor, objectId) {
    const target = tmp.set(anchor[0], anchor[1], anchor[2]);
    const origin = camera.position;
    const dir = target.clone().sub(origin);
    const dist = dir.length();
    raycaster.set(origin, dir.normalize());
    raycaster.far = dist - 0.12;
    const own = objectMeshes.get(objectId) || [];
    const hit = raycaster.intersectObjects(occluders, false).find(h => !own.includes(h.object));
    return !!hit;
  }

  function resize(width, height) {
    renderer.setSize(width, height, false);
  }

  // Ready for a first frame once the procedural textures are painted and
  // every material's shader is compiled -- both off the main thread where
  // the browser can (workers; KHR_parallel_shader_compile), so the page
  // does not freeze on the first render. Nothing is drawn before that.
  // While the painters finish, one draw into a single pixel of the canvas
  // (still under the loading cover) compiles what compile() cannot reach
  // -- the shadow pass and the sky background -- and renders the shadow map.
  function warmUp() {
    const camera = new THREE.PerspectiveCamera(38, 1.6, 0.1, 400);
    camera.position.set(16, 10, 23);
    camera.lookAt(0, 2, 1);
    renderer.setScissorTest(true);
    renderer.setScissor(0, 0, 1, 1);
    renderer.render(scene, camera);
    renderer.setScissorTest(false);
  }
  let isReady = false;
  const ready = Promise.all([materials.ready, renderer.compileAsync(scene, new THREE.PerspectiveCamera()).then(warmUp)])
    .then(() => { isReady = true; });

  function render(camera) {
    if (isReady) renderer.render(scene, camera);
  }

  function dispose() {
    scene.traverse(o => { if (o.geometry) o.geometry.dispose(); });
    materials.dispose();
    background.dispose();
    scene.environment.dispose();
    renderer.dispose();
  }

  refreshOccluders();
  return {
    renderer, scene, ready, setHiddenGroups, setHighlight, isOccluded, resize, render, dispose,
    loadPhotos: materials.loadPhotos, groupNames: () => Array.from(groups.keys()),
  };
}
