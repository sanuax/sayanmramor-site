// js/showroom/showroom-scene.js
//
// One WebGL renderer and one scene for the whole house. Builds meshes from
// HouseModel parts (batched: one mesh per group + material + object, see
// showroom-geometry.js), lights them like an architectural photograph (a
// warm low sun with soft shadows, a sky-dome environment for reflections,
// a few warm interior lights), renders the pond as calm water with a real
// planar reflection, and exposes what the app needs: hide/show cut-away
// groups, highlight an object, test whether a marker is hidden behind
// something, render.
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

// Calm dark water: a mirror image of the world above it (rendered from a
// camera mirrored in the water plane, clipped at the surface), darkened and
// faintly rippled, stronger at grazing angles.
const WATER_VERTEX = `
uniform mat4 textureMatrix;
varying vec4 vUvR;
varying vec3 vWorld;
#include <fog_pars_vertex>
void main() {
  vec4 world = modelMatrix * vec4(position, 1.0);
  vWorld = world.xyz;
  vUvR = textureMatrix * world;
  vec4 mvPosition = viewMatrix * world;
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}`;
const WATER_FRAGMENT = `
uniform sampler2D tReflect;
uniform vec3 deep;
uniform vec3 tint;
varying vec4 vUvR;
varying vec3 vWorld;
#include <common>
#include <fog_pars_fragment>
void main() {
  vec2 ripple = vec2(
    sin(vWorld.x * 3.7 + vWorld.z * 1.3) + 0.5 * sin(vWorld.z * 7.1 - vWorld.x * 2.3),
    cos(vWorld.z * 3.3 - vWorld.x * 1.1) + 0.5 * cos(vWorld.x * 6.9 + vWorld.z * 2.7)) * 0.0007;
  vec4 uv = vUvR;
  uv.xy += ripple * uv.w;
  vec3 reflected = texture2DProj(tReflect, uv).rgb;
  vec3 view = normalize(cameraPosition - vWorld);
  float fresnel = 0.04 + 0.96 * pow(1.0 - max(view.y, 0.0), 5.0);
  gl_FragColor = vec4(deep + reflected * tint * mix(0.5, 1.0, fresnel), 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
  #include <fog_fragment>
}`;

function createWater(part, renderer, scene) {
  const y = part.max[1];
  const w = part.max[0] - part.min[0], d = part.max[2] - part.min[2];
  const geometry = new THREE.PlaneGeometry(w, d);
  geometry.rotateX(-Math.PI / 2);
  const target = new THREE.WebGLRenderTarget(256, 256, { type: THREE.HalfFloatType });
  const textureMatrix = new THREE.Matrix4();
  const material = new THREE.ShaderMaterial({
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, {
      tReflect: { value: null }, textureMatrix: { value: null },
      deep: { value: new THREE.Color('#0f1618') }, tint: { value: new THREE.Color('#a9b6b4') },
    }]),
    vertexShader: WATER_VERTEX, fragmentShader: WATER_FRAGMENT, fog: true,
  });
  material.uniforms.tReflect.value = target.texture;
  material.uniforms.textureMatrix.value = textureMatrix;
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set((part.min[0] + part.max[0]) / 2, y, (part.min[2] + part.max[2]) / 2);
  mesh.receiveShadow = false;
  scene.add(mesh);

  const bounds = new THREE.Box3(new THREE.Vector3(part.min[0], y, part.min[2]), new THREE.Vector3(part.max[0], y, part.max[2]));
  const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -y);
  const mirror = new THREE.PerspectiveCamera();
  const frustum = new THREE.Frustum(), pv = new THREE.Matrix4();
  const dir = new THREE.Vector3(), up = new THREE.Vector3(), look = new THREE.Vector3();
  const bias = new THREE.Matrix4().set(0.5, 0, 0, 0.5, 0, 0.5, 0, 0.5, 0, 0, 0.5, 0.5, 0, 0, 0, 1);

  function update(camera) {
    pv.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    frustum.setFromProjectionMatrix(pv);
    if (!frustum.intersectsBox(bounds) || camera.position.y <= y) return;
    const p = camera.position;
    camera.getWorldDirection(dir);
    up.set(0, 1, 0).applyQuaternion(camera.quaternion);
    mirror.position.set(p.x, 2 * y - p.y, p.z);
    look.set(p.x + dir.x, 2 * y - (p.y + dir.y), p.z + dir.z);
    mirror.up.set(up.x, -up.y, up.z);
    mirror.lookAt(look);
    mirror.projectionMatrix.copy(camera.projectionMatrix);
    mirror.projectionMatrixInverse.copy(camera.projectionMatrixInverse);
    mirror.updateMatrixWorld();
    textureMatrix.copy(bias).multiply(mirror.projectionMatrix).multiply(mirror.matrixWorldInverse);
    mesh.visible = false;
    renderer.clippingPlanes = [plane];
    renderer.setRenderTarget(target);
    renderer.clear();
    renderer.render(scene, mirror);
    renderer.setRenderTarget(null);
    renderer.clippingPlanes = [];
    mesh.visible = true;
  }

  function resize(width, height) {
    // Three quarters of the screen's resolution: crisp enough for calm water,
    // cheaper than a second full-size pass.
    target.setSize(Math.max(1, Math.round(width * 0.75)), Math.max(1, Math.round(height * 0.75)));
  }

  function dispose() {
    geometry.dispose();
    material.dispose();
    target.dispose();
  }

  return { mesh, update, resize, dispose };
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

export function createShowroomScene(canvas, { House }) {
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

  const materials = createMaterials();

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
  const batchFor = part => {
    const key = part.group + '|' + part.mat + '|' + (part.object || '');
    if (!batches.has(key)) batches.set(key, Object.assign(createBatch(), { group: part.group, mat: part.mat, object: part.object || null }));
    return batches.get(key);
  };
  const jointBuckets = new Map();
  const blobs = { foliage: [] };
  const trunks = [];
  let water = null;

  function boxStyle(part) {
    const c = [0, 1, 2].map(i => (part.min[i] + part.max[i]) / 2);
    const style = { bevel: part.bevel || 0, color: tint(roleTint(part.mat) * 0.6, c[0], c[1], c[2]), uvOffset: uvOffset(c[0], c[1], c[2]) };
    if (part.mat === 'onyx') {
      // The bookmatched panno maps once across each face, not by the metre.
      const size = [0, 1, 2].map(i => part.max[i] - part.min[i]);
      style.uvOffset = [0, 0];
      style.uvOf = (p, n) => {
        const ax = Math.abs(n[0]), ay = Math.abs(n[1]);
        const [a, b] = ax > 0.5 ? [2, 1] : ay > 0.5 ? [0, 2] : [0, 1];
        return [(p[a] - part.min[a]) / size[a], (p[b] - part.min[b]) / size[b]];
      };
    }
    return style;
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
      if (part.mat === 'water') { water = createWater(part, renderer, scene); return; }
      pushBox(batchFor(part), part.min, part.max, boxStyle(part));
    } else if (part.kind === 'cladding') {
      const b = batchFor(part);
      const amount = roleTint(part.mat);
      const n0 = part.at, n1 = part.at + part.normal * part.depth, g = part.gap / 2;
      House.claddingSlabs(part).forEach(s => {
        const ca = (s.a0 + s.a1) / 2, cb = (s.b0 + s.b1) / 2;
        const style = { color: tint(amount, ca, cb, n1), uvOffset: uvOffset(ca, cb, n0) };
        // Joints: half a gap off each slab edge, except at the surface's own border.
        const a0 = s.a0 + (s.a0 > part.a[0] + 1e-6 ? g : 0), a1 = s.a1 - (s.a1 < part.a[1] - 1e-6 ? g : 0);
        const b0 = s.b0 + (s.b0 > part.b[0] + 1e-6 ? g : 0), b1 = s.b1 - (s.b1 < part.b[1] - 1e-6 ? g : 0);
        pushSlab(b, part.plane, a0, a1, b0, b1, n0, n1, part.chamfer, style);
      });
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
    const material = b.object ? materials.forObject(b.mat, b.object) : materials.get(b.mat);
    const mesh = new THREE.Mesh(toGeometry(b), material);
    const isGlass = b.mat === 'glass', isLamp = b.mat === 'lamp';
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
        if (o.isMesh && !o.isInstancedMesh && o.userData.role !== 'glass' && o.userData.role !== 'lamp') occluders.push(o);
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
    const pr = renderer.getPixelRatio();
    if (water) water.resize(width * pr, height * pr);
  }

  function render(camera) {
    camera.updateMatrixWorld();
    if (water) water.update(camera);
    renderer.render(scene, camera);
  }

  function dispose() {
    scene.traverse(o => { if (o.geometry) o.geometry.dispose(); });
    materials.dispose();
    if (water) water.dispose();
    background.dispose();
    scene.environment.dispose();
    renderer.dispose();
  }

  refreshOccluders();
  return { renderer, scene, setHiddenGroups, setHighlight, isOccluded, resize, render, dispose, groupNames: () => Array.from(groups.keys()) };
}
