// js/showroom/showroom-camera.js
//
// Guided architectural camera. The client orbits and zooms freely WITHIN a
// zone's limits (so a cut-away room is never seen from the side where its
// walls still stand, and nobody ends up underground or lost in the sky);
// moving between zones/objects is an eased transition, not a jump.
import * as THREE from '../../vendor/three/three.module.js';
import { OrbitControls } from '../../vendor/three/OrbitControls.js';

const ease = t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

export function createCameraRig(canvas, { reducedMotion }) {
  const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 400);
  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.dampingFactor = 0.09;
  controls.enablePan = false;
  controls.rotateSpeed = 0.55;
  controls.zoomSpeed = 0.8;

  let transition = null;
  let insets = { left: 0, right: 0, bottom: 0 };
  let size = { width: 1, height: 1 };

  function azimuthOf(position, target) {
    return Math.atan2(position[0] - target[0], position[2] - target[2]);
  }

  function applyLimits(view, orbit) {
    const dist = Math.hypot(...[0, 1, 2].map(i => view.position[i] - view.target[i]));
    controls.minDistance = Math.min(orbit.minDistance, dist * 0.65);
    controls.maxDistance = Math.max(orbit.maxDistance, dist * 1.2);
    controls.minPolarAngle = orbit.minPolar;
    controls.maxPolarAngle = orbit.maxPolar;
    if (orbit.azimuthRange) {
      const az = azimuthOf(view.position, view.target);
      controls.minAzimuthAngle = az - orbit.azimuthRange;
      controls.maxAzimuthAngle = az + orbit.azimuthRange;
    } else {
      controls.minAzimuthAngle = -Infinity;
      controls.maxAzimuthAngle = Infinity;
    }
  }

  function jumpTo(view, orbit) {
    transition = null;
    // Limits first: OrbitControls clamps the camera into them on update().
    controls.minAzimuthAngle = -Infinity; controls.maxAzimuthAngle = Infinity;
    camera.position.set(...view.position);
    controls.target.set(...view.target);
    applyLimits(view, orbit);
    controls.update();
  }

  // Eased move to `view`. onMidpoint fires halfway (the moment cut-away
  // walls change, so they switch while the camera is still travelling).
  function goTo(view, orbit, { onMidpoint, duration } = {}) {
    if (reducedMotion) {
      if (onMidpoint) onMidpoint();
      jumpTo(view, orbit);
      return;
    }
    controls.enabled = false;
    controls.minAzimuthAngle = -Infinity; controls.maxAzimuthAngle = Infinity;
    controls.minDistance = 0; controls.maxDistance = Infinity;
    controls.minPolarAngle = 0; controls.maxPolarAngle = Math.PI;
    transition = {
      from: { position: camera.position.clone(), target: controls.target.clone() },
      to: { position: new THREE.Vector3(...view.position), target: new THREE.Vector3(...view.target) },
      start: performance.now(),
      duration: duration || 1150,
      midpointDone: !onMidpoint,
      onMidpoint, view, orbit,
    };
  }

  // Advances a transition; returns true while the camera is still moving.
  function update(now) {
    if (transition) {
      const t = Math.min(1, (now - transition.start) / transition.duration);
      const k = ease(t);
      camera.position.lerpVectors(transition.from.position, transition.to.position, k);
      // Lift the path a little in the middle: an architectural sweep, not a
      // straight dolly through walls.
      camera.position.y += Math.sin(Math.PI * t) * 1.2;
      controls.target.lerpVectors(transition.from.target, transition.to.target, k);
      camera.lookAt(controls.target);
      if (!transition.midpointDone && t >= 0.5) {
        transition.midpointDone = true;
        transition.onMidpoint();
      }
      if (t >= 1) {
        const { view, orbit } = transition;
        transition = null;
        controls.enabled = true;
        applyLimits(view, orbit);
        controls.update();
      }
      return true;
    }
    return controls.update();
  }

  // Keep the house / focused object centred in the part of the canvas the
  // caption, card or sheet does not cover.
  function applyViewOffset() {
    const { width, height } = size;
    const dx = ((insets.right || 0) - (insets.left || 0)) / 2;
    const dy = (insets.bottom || 0) / 2;
    if (dx || dy) {
      camera.setViewOffset(width, height, dx, dy, width, height);
    } else {
      camera.clearViewOffset();
    }
    camera.updateProjectionMatrix();
  }

  function setInsets(next) {
    insets = next;
    applyViewOffset();
  }

  function resize(width, height) {
    size = { width, height };
    camera.aspect = width / height;
    // Narrow screens: pull the field of view out a little so the house fits.
    camera.fov = width / height < 0.8 ? 48 : 38;
    applyViewOffset();
  }

  return { camera, controls, goTo, jumpTo, update, setInsets, resize, isMoving: () => !!transition, dispose: () => controls.dispose() };
}
