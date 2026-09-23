// js/showroom/showroom-scene.js
//
// One WebGL renderer and one scene for the whole house. Builds meshes from
// HouseModel parts, lights them like an architectural photograph (warm low
// sun with soft shadows, a sky-dome environment for reflections), and
// exposes what the app needs: hide/show cut-away groups, highlight an
// object, test whether a marker is hidden behind something, render.
import * as THREE from '../../vendor/three/three.module.js';
import { createMaterials } from './showroom-materials.js';

const SKY_TOP = '#8c969c';
const SKY_HORIZON = '#e4d9c6';
const FOG_COLOR = '#d9d0c1';

function skyTexture() {
  const c = document.createElement('canvas');
  c.width = 2; c.height = 512;
  const g = c.getContext('2d');
  const grad = g.createLinearGradient(0, 0, 0, 512);
  grad.addColorStop(0, SKY_TOP);
  grad.addColorStop(0.62, SKY_HORIZON);
  grad.addColorStop(1, '#cfc4b2');
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
  const ground = new THREE.Mesh(new THREE.CircleGeometry(49, 32), new THREE.MeshBasicMaterial({ color: '#5b5a4c' }));
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -2;
  env.add(ground);
  const sun = new THREE.Mesh(new THREE.SphereGeometry(4, 16, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color(6, 5.4, 4.4) }));
  sun.position.set(26, 28, 22);
  env.add(sun);
  const texture = pmrem.fromScene(env, 0.02).texture;
  env.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material) { if (o.material.map) o.material.map.dispose(); o.material.dispose(); } });
  pmrem.dispose();
  return texture;
}

export function createShowroomScene(canvas, { House }) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.95;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  const background = skyTexture();
  scene.background = background;
  scene.fog = new THREE.Fog(FOG_COLOR, 55, 150);
  scene.environment = buildEnvironment(renderer);

  const materials = createMaterials();

  // Light: a warm late-afternoon sun from the south-east, sky fill.
  scene.add(new THREE.HemisphereLight('#f4ecdf', '#5a5546', 0.4));
  const sun = new THREE.DirectionalLight('#ffe6c8', 2.9);
  sun.position.set(14, 20, 15);
  sun.target.position.set(-1, 1, 0);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -17, right: 17, top: 15, bottom: -15, near: 1, far: 70 });
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.03;
  scene.add(sun, sun.target);

  const ground = new THREE.Mesh(new THREE.CircleGeometry(90, 72), materials.get('lawn'));
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  // ---- house -----------------------------------------------------------
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
  const jointBuckets = new Map();

  function addMesh(part, geometry, position) {
    const material = part.object ? materials.forObject(part.mat, part.object) : materials.get(part.mat);
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.copy(position);
    const isGlass = part.mat === 'glass';
    mesh.castShadow = !isGlass;
    mesh.receiveShadow = !isGlass;
    mesh.userData.part = part;
    groupOf(part.group).add(mesh);
    if (part.object) {
      if (!objectMeshes.has(part.object)) objectMeshes.set(part.object, []);
      objectMeshes.get(part.object).push(mesh);
    }
    return mesh;
  }

  House.buildHouse().forEach(part => {
    if (part.kind === 'box') {
      const size = [0, 1, 2].map(i => part.max[i] - part.min[i]);
      const center = new THREE.Vector3(...[0, 1, 2].map(i => (part.min[i] + part.max[i]) / 2));
      addMesh(part, new THREE.BoxGeometry(...size), center);
    } else if (part.kind === 'beam') {
      const from = new THREE.Vector3(...part.from), to = new THREE.Vector3(...part.to);
      const len = from.distanceTo(to);
      const geometry = new THREE.BoxGeometry(part.width, part.height, len);
      const mesh = addMesh(part, geometry, from.clone().add(to).multiplyScalar(0.5));
      mesh.lookAt(to);
    } else if (part.kind === 'slats') {
      const along = part.axis === 'x' ? 0 : 2;
      const across = part.axis === 'x' ? 2 : 0;
      const length = part.max[along] - part.min[along];
      const count = Math.max(1, Math.floor(length / part.pitch));
      const size = [0, 0, 0];
      size[along] = part.width;
      size[1] = part.max[1] - part.min[1];
      size[across] = part.max[across] - part.min[across];
      const mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(...size), materials.get(part.mat), count);
      const m = new THREE.Matrix4();
      const start = part.min[along] + (length - (count - 1) * part.pitch) / 2;
      for (let i = 0; i < count; i++) {
        const p = [0, 0, 0];
        p[along] = start + i * part.pitch;
        p[1] = (part.min[1] + part.max[1]) / 2;
        p[across] = (part.min[across] + part.max[across]) / 2;
        m.makeTranslation(p[0], p[1], p[2]);
        mesh.setMatrixAt(i, m);
      }
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      groupOf(part.group).add(mesh);
    } else if (part.kind === 'joints') {
      const key = part.group + '|' + part.tone;
      if (!jointBuckets.has(key)) jointBuckets.set(key, { group: part.group, tone: part.tone, segs: [] });
      House.jointSegments(part).forEach(s => jointBuckets.get(key).segs.push(...s));
    } else if (part.kind === 'tree') {
      const [x, , z] = part.position;
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.13, part.trunk, 8), materials.get('bark'));
      trunk.position.set(x, part.trunk / 2, z);
      trunk.castShadow = true;
      groupOf(part.group).add(trunk);
      const crown = new THREE.Mesh(new THREE.IcosahedronGeometry(part.crown, 2), materials.get('foliage'));
      crown.scale.set(1, 1.35, 1);
      crown.position.set(x, part.trunk + part.crown * 0.9, z);
      crown.castShadow = true;
      crown.receiveShadow = true;
      groupOf(part.group).add(crown);
    }
  });
  jointBuckets.forEach(({ group, tone, segs }) => {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(segs, 3));
    groupOf(group).add(new THREE.LineSegments(geometry, materials.joints[tone]));
  });

  // ---- visibility, highlight, occlusion ------------------------------------
  let occluders = [];
  function refreshOccluders() {
    occluders = [];
    groups.forEach(g => {
      if (!g.visible) return;
      g.children.forEach(o => {
        if (o.isMesh && !o.isInstancedMesh && o.material !== materials.get('glass')) occluders.push(o);
      });
    });
  }

  function setHiddenGroups(hidden) {
    groups.forEach((g, name) => { g.visible = !hidden.includes(name); });
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

  function render(camera) {
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
  return { renderer, scene, setHiddenGroups, setHighlight, isOccluded, resize, render, dispose, groupNames: () => Array.from(groups.keys()) };
}
