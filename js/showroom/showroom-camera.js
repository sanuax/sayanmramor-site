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
  let release = null;   // a flight the client took over: its limits closing in on the arrival's
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
    release = null;
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
    release = null;
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

  // The client takes the house in hand mid-flight (2026-10-24, the owner): the flight stops
  // where the camera is and the controls are theirs at once. The cut-away walls switch now if
  // they had not yet. The arrival's limits do not snap the camera into them: they start wide
  // enough to hold it where it stands and close in over about a second, and the point it turns
  // round glides on to the arrival's -- so the view settles into the zone, never jumps.
  function interrupt() {
    if (!transition) return;
    const { view, orbit, to } = transition;
    if (!transition.midpointDone) { transition.midpointDone = true; transition.onMidpoint(); }
    transition = null;
    controls.enabled = true;
    applyLimits(view, orbit);
    const goal = {
      minDistance: controls.minDistance, maxDistance: controls.maxDistance,
      minPolarAngle: controls.minPolarAngle, maxPolarAngle: controls.maxPolarAngle,
      minAzimuthAngle: controls.minAzimuthAngle, maxAzimuthAngle: controls.maxAzimuthAngle,
    };
    const offset = camera.position.clone().sub(controls.target);
    const dist = offset.length();
    const polar = Math.acos(Math.min(1, Math.max(-1, offset.y / dist)));
    controls.minDistance = Math.min(goal.minDistance, dist); controls.maxDistance = Math.max(goal.maxDistance, dist);
    controls.minPolarAngle = Math.min(goal.minPolarAngle, polar); controls.maxPolarAngle = Math.max(goal.maxPolarAngle, polar);
    if (Number.isFinite(goal.minAzimuthAngle)) {
      // The camera's azimuth on the same turn as the range's middle, so the range widens the short way.
      const mid = (goal.minAzimuthAngle + goal.maxAzimuthAngle) / 2;
      const az = mid + Math.atan2(Math.sin(Math.atan2(offset.x, offset.z) - mid), Math.cos(Math.atan2(offset.x, offset.z) - mid));
      controls.minAzimuthAngle = Math.min(goal.minAzimuthAngle, az); controls.maxAzimuthAngle = Math.max(goal.maxAzimuthAngle, az);
    }
    release = { goal, target: to.target.clone(), last: performance.now() };
  }

  // One step of a released flight closing in; false once it is done.
  function settleRelease(now) {
    const k = 1 - Math.exp(-Math.max(0, now - release.last) / 250);   // about a second to settle
    release.last = now;
    let done = true;
    Object.keys(release.goal).forEach(key => {
      const want = release.goal[key], have = controls[key];
      if (!Number.isFinite(want) || !Number.isFinite(have)) { controls[key] = want; return; }
      const next = have + (want - have) * k;
      if (Math.abs(want - next) > 1e-3) { controls[key] = next; done = false; } else controls[key] = want;
    });
    controls.target.lerp(release.target, k);
    if (controls.target.distanceTo(release.target) > 1e-3) done = false; else controls.target.copy(release.target);
    if (done) release = null;
    return !done;
  }

  // Advances a transition; returns true while the camera is still moving.
  function update(now) {
    if (release) {
      const settling = settleRelease(now);
      return controls.update() || settling;
    }
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

  return { camera, controls, goTo, jumpTo, interrupt, update, setInsets, resize, isMoving: () => !!transition, dispose: () => controls.dispose() };
}
