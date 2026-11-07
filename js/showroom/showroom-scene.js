// js/showroom/showroom-scene.js
//
// One WebGL renderer and one scene for the whole house. Builds meshes from
// HouseModel parts (batched: one mesh per group + material + object, see
// showroom-geometry.js), lays real stone photographs on the pieces cut
// from them (stone-photos.js), and lights the house as an architectural
// model photographed in the evening (the owner's choice, 2026-11-08,
// «Б. Вечер»): a warm dark room round the model, a large soft light above,
// a warm key with soft shadows, the rooms' own lamps, soft contact shadows
// on the floors. It exposes what the app needs: hide/show cut-away groups,
// highlight an object, test whether a marker is hidden behind something,
// render.
import * as THREE from '../../vendor/three/three.module.js';
import { createMaterials, roleTint } from './showroom-materials.js';
import { hash3, createBatch, pushBox, pushSlab, pushCylinder, pushBeam, toGeometry, pushRoundedBox, pushLathe } from './showroom-geometry.js';

// The room round the model, and its light.
const LOOK = {
  bg: { inner: '#2a221c', outer: '#0b0907' },                                   // backdrop: lighter behind the model
  env: { top: [1.5, 1.3, 1.05], mid: '#4a3f34', low: '#100d0b', fill: 0.7 },   // reflections and fill: a softbox overhead
  hemi: ['#f3e3ca', '#2a221b', 0.22],
  key: { color: '#ffdcb0', intensity: 1.55, position: [-8, 22, 10], soft: 9 },
  exposure: 1.0,
  lamps: 2.4,                                                                   // the rooms' lamps, brighter than by day
};
const WHITE = [1, 1, 1];

// The model's room: a soft radial backdrop.
function lookBackground() {
  const c = document.createElement('canvas');
  c.width = c.height = 512;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(256, 230, 20, 256, 256, 400);
  grad.addColorStop(0, LOOK.bg.inner);
  grad.addColorStop(1, LOOK.bg.outer);
  g.fillStyle = grad;
  g.fillRect(0, 0, 512, 512);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// A studio for reflections and fill: a large soft light overhead, softer
// walls, a dark floor -- no sky, no sun disc.
function buildEnvironment(renderer) {
  const pmrem = new THREE.PMREMGenerator(renderer);
  const env = new THREE.Scene();
  const c = document.createElement('canvas');
  c.width = 2; c.height = 256;
  const g = c.getContext('2d');
  const grad = g.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0, LOOK.env.mid);
  grad.addColorStop(0.5, LOOK.env.mid);
  grad.addColorStop(1, LOOK.env.low);
  g.fillStyle = grad;
  g.fillRect(0, 0, 2, 256);
  const map = new THREE.CanvasTexture(c);
  map.colorSpace = THREE.SRGBColorSpace;
  const f = LOOK.env.fill;
  env.add(new THREE.Mesh(new THREE.SphereGeometry(50, 32, 16), new THREE.MeshBasicMaterial({ side: THREE.BackSide, map, color: new THREE.Color(f, f, f) })));
  const box = new THREE.Mesh(new THREE.PlaneGeometry(46, 30), new THREE.MeshBasicMaterial({ color: new THREE.Color(...LOOK.env.top), side: THREE.DoubleSide }));
  box.rotation.x = Math.PI / 2;
  box.position.set(-6, 40, 8);
  env.add(box);
  const texture = pmrem.fromScene(env, 0.06).texture;
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
  renderer.toneMappingExposure = LOOK.exposure;
  renderer.shadowMap.enabled = true;
  // Soft, blurred shadows (VSM). The house is static: shadows -- and their
  // blur -- are recomputed only when the cut-away changes.
  renderer.shadowMap.type = THREE.VSMShadowMap;
  renderer.shadowMap.autoUpdate = false;
  renderer.shadowMap.needsUpdate = true;

  const scene = new THREE.Scene();
  const background = lookBackground();
  scene.background = background;
  scene.environment = buildEnvironment(renderer);

  const materials = createMaterials({
    Photos, anisotropy: renderer.capabilities.getMaxAnisotropy(), onChange,
    upload: texture => renderer.initTexture(texture),
  });

  // Light: a soft fill, a warm key high over the model's front left (short,
  // soft shadows), and the rooms' own warm lamps.
  scene.add(new THREE.HemisphereLight(...LOOK.hemi));
  const sun = new THREE.DirectionalLight(LOOK.key.color, LOOK.key.intensity);
  sun.position.set(...LOOK.key.position);
  sun.target.position.set(0, 1, 0);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -17, right: 17, top: 16, bottom: -16, near: 1, far: 70 });
  sun.shadow.bias = -0.0002;
  sun.shadow.normalBias = 0.03;
  sun.shadow.radius = LOOK.key.soft;
  sun.shadow.blurSamples = 16;
  scene.add(sun, sun.target);
  (House.LIGHTS || []).forEach(l => {
    const light = new THREE.PointLight(l.color, l.intensity * LOOK.lamps, l.distance, 2);
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

  const parts = House.buildHouse();
  parts.forEach(part => {
    if (part.kind === 'rbox') {
      pushRoundedBox(batchFor(part), part.min, part.max, part.radius, { color: WHITE, uvOffset: [0, 0] });
    } else if (part.kind === 'lathe') {
      pushLathe(batchFor(part), part.base, part.profile, part.segments || 40, { color: WHITE, uvOffset: [0, 0] });
    } else if (part.kind === 'box') {
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

  // ---- soft contact shadows -------------------------------------------------------
  // What a soft sky does in a photograph of a model: the floor darkens
  // gently under furniture and along the walls. Baked once (the house is
  // static): an orthographic camera looks up from just above each floor,
  // records how close anything above is (within `reach`), the result is
  // blurred, and a transparent layer lies on the floor. No cost per frame.
  function bakeContactShadows() {
    const LEVELS = [
      { y: 0.004, area: [House.BASE.x0, House.BASE.x1, House.BASE.z0, House.BASE.z1], reach: 0.7, group: 'site', strength: 0.55 },
      { y: 3.77 + 0.003, area: [3.5, 7, -5, 5], reach: 0.55, group: 'gf-roof', strength: 0.55 },
      { y: 0.47 + 0.013, area: [-7, 7, -5, 5], reach: 0.55, group: 'gf-floors', strength: 0.62 },
      { y: 3.77 + 0.013, area: [-8.5, 3.5, -5, 6.5], reach: 0.55, group: 'uf-interior', strength: 0.55 },
    ];
    const SIZE = 1024;
    const depthMat = new THREE.ShaderMaterial({
      side: THREE.DoubleSide,
      vertexShader: 'void main() { gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: 'void main() { float a = 1.0 - gl_FragCoord.z; gl_FragColor = vec4(a * a, 0.0, 0.0, 1.0); }',
    });
    const blurMat = new THREE.ShaderMaterial({
      uniforms: { map: { value: null }, dir: { value: new THREE.Vector2() } },
      vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
      fragmentShader: `uniform sampler2D map; uniform vec2 dir; varying vec2 vUv;
        void main() {
          float w[7]; w[0] = 0.1995; w[1] = 0.1760; w[2] = 0.1210; w[3] = 0.0648; w[4] = 0.0270; w[5] = 0.0088; w[6] = 0.0022;
          float s = texture2D(map, vUv).r * w[0];
          for (int i = 1; i < 7; i++) { s += texture2D(map, vUv + dir * float(i)).r * w[i]; s += texture2D(map, vUv - dir * float(i)).r * w[i]; }
          gl_FragColor = vec4(s, 0.0, 0.0, 1.0);
        }`,
      depthTest: false, depthWrite: false,
    });
    const quadScene = new THREE.Scene();
    const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), blurMat);
    quad.frustumCulled = false;
    quadScene.add(quad);
    const quadCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const opts = { type: THREE.HalfFloatType, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, depthBuffer: true };
    const hiddenLines = [];
    scene.traverse(o => { if (o.isLineSegments && o.visible) { o.visible = false; hiddenLines.push(o); } });
    const oldBg = scene.background, oldTarget = renderer.getRenderTarget();
    const clear = new THREE.Color(); renderer.getClearColor(clear); const clearA = renderer.getClearAlpha();
    const shadowAuto = renderer.shadowMap.enabled;
    renderer.shadowMap.enabled = false;
    scene.background = null;
    scene.overrideMaterial = depthMat;
    renderer.setClearColor(0x000000, 1);
    const layers = [];
    LEVELS.forEach(L => {
      const [x0, x1, z0, z1] = L.area, w = x1 - x0, d = z1 - z0;
      const cam = new THREE.OrthographicCamera(-w / 2, w / 2, d / 2, -d / 2, 0, L.reach);
      cam.position.set((x0 + x1) / 2, L.y, (z0 + z1) / 2);
      cam.up.set(0, 0, 1);
      cam.lookAt(cam.position.x, L.y + 1, cam.position.z);
      cam.updateMatrixWorld();
      const a = new THREE.WebGLRenderTarget(SIZE, Math.round(SIZE * d / w), opts), b = a.clone();
      // Seen from below, a wall standing on the floor is edge-on and leaves no
      // trace: whatever stands on (or through) this floor is drawn as its
      // footprint, touching it.
      const foot = [];
      parts.forEach(part => {
        if (part.kind !== 'box' && part.kind !== 'rbox' && part.kind !== 'cladding') return;
        if (part.mat === 'glass' || part.mat === 'glass-smoke' || part.mat === 'lamp') return;
        const bb = part.kind === 'rbox' ? part : House.partBounds(part);
        if (!bb) return;
        if (!(bb.min[1] < L.y + 0.02 && bb.max[1] > L.y + 0.03)) return;
        const fx0 = bb.min[0], fx1 = bb.max[0], fz0 = bb.min[2], fz1 = bb.max[2], fy = L.y + 0.0005;
        if (fx1 - fx0 < 1e-4 || fz1 - fz0 < 1e-4) return;
        foot.push(fx0, fy, fz0, fx1, fy, fz0, fx1, fy, fz1, fx0, fy, fz0, fx1, fy, fz1, fx0, fy, fz1);
      });
      const footGeo = new THREE.BufferGeometry();
      footGeo.setAttribute('position', new THREE.Float32BufferAttribute(foot, 3));
      const footMesh = new THREE.Mesh(footGeo, depthMat);
      footMesh.frustumCulled = false;
      scene.add(footMesh);
      renderer.setRenderTarget(a);
      renderer.clear();
      renderer.render(scene, cam);
      scene.remove(footMesh);
      footGeo.dispose();
      scene.overrideMaterial = null;
      // Two passes each way: a wide soft one, then a finer one.
      [[3.2, 3.2], [1.2, 1.2]].forEach(([sx]) => {
        blurMat.uniforms.map.value = a.texture; blurMat.uniforms.dir.value.set(sx / a.width, 0);
        renderer.setRenderTarget(b); renderer.render(quadScene, quadCam);
        blurMat.uniforms.map.value = b.texture; blurMat.uniforms.dir.value.set(0, sx / a.height);
        renderer.setRenderTarget(a); renderer.render(quadScene, quadCam);
      });
      scene.overrideMaterial = depthMat;
      b.dispose();
      const viewProj = new THREE.Matrix4().multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse);
      const layer = new THREE.Mesh(new THREE.PlaneGeometry(w, d).rotateX(-Math.PI / 2), new THREE.ShaderMaterial({
        transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
        uniforms: { map: { value: a.texture }, viewProj: { value: viewProj }, color: { value: new THREE.Color('#2a2118') }, strength: { value: L.strength } },
        vertexShader: 'uniform mat4 viewProj; varying vec2 vUv; void main() { vec4 w = modelMatrix * vec4(position, 1.0); vec4 p = viewProj * w; vUv = p.xy / p.w * 0.5 + 0.5; gl_Position = projectionMatrix * viewMatrix * w; }',
        fragmentShader: 'uniform sampler2D map; uniform vec3 color; uniform float strength; varying vec2 vUv; void main() { float a = texture2D(map, vUv).r; gl_FragColor = vec4(color, clamp(a * strength * 1.6, 0.0, strength)); }',
      }));
      layer.position.set((x0 + x1) / 2, L.y + 0.001, (z0 + z1) / 2);
      layer.renderOrder = 1;
      layer.userData.role = 'contact';
      groupOf(L.group).add(layer);
      layers.push(layer);
    });
    scene.overrideMaterial = null;
    scene.background = oldBg;
    renderer.setRenderTarget(oldTarget);
    renderer.setClearColor(clear, clearA);
    renderer.shadowMap.enabled = shadowAuto;
    renderer.shadowMap.needsUpdate = true;
    hiddenLines.forEach(o => { o.visible = true; });
    depthMat.dispose(); blurMat.dispose(); quad.geometry.dispose();
    return layers;
  }
  bakeContactShadows();

  // ---- visibility, highlight, occlusion ----------------------------------------------
  let occluders = [];
  function refreshOccluders() {
    occluders = [];
    groups.forEach(g => {
      if (!g.visible) return;
      g.children.forEach(o => {
        if (o.isMesh && !['glass', 'glass-smoke', 'lamp', 'contact'].includes(o.userData.role)) occluders.push(o);
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
  // -- the shadow pass and the backdrop -- and renders the shadow map.
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
    if (!isReady) return;
    renderer.render(scene, camera);
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
