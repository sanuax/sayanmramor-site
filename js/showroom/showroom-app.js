// js/showroom/showroom-app.js
//
// Entry point: decides between the 3D showroom and the static fallback,
// then wires the pure state (ShowroomState) to the scene, camera, markers
// and DOM. Renders only while something moves (camera transition, damping,
// resize) -- an idle showroom costs nothing.
import { createShowroomScene } from './showroom-scene.js';
import { createCameraRig } from './showroom-camera.js';
import { createMarkers } from './showroom-markers.js';
import { createUI } from './showroom-ui.js';

const Data = window.ShowroomData;
const State = window.ShowroomState;
const House = window.HouseModel;
const doc = document;

function showFallback(reason) {
  doc.getElementById('srFallback').hidden = false;
  ['srStage', 'srCaption', 'srZones', 'srBack', 'srCard', 'srPanel', 'srHint'].forEach(id => { doc.getElementById(id).hidden = true; });
  doc.getElementById('srPanelBtn').hidden = true;
  if (reason === 'error') {
    doc.getElementById('srFallbackText').textContent = 'Не удалось загрузить 3D-дом. Все направления — ниже: выберите изделие и создайте своё.';
  }
}

function start() {
  const canvas = doc.getElementById('srCanvas');
  const stage = doc.getElementById('srStage');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const view3d = createShowroomScene(canvas, { House });
  const rig = createCameraRig(canvas, { reducedMotion });
  let state = State.initialStateFromLocation(location.search, location.hash);
  let size = { width: 1, height: 1 };
  let frame = null;
  let occlusionDue = true;

  const markers = createMarkers(doc.getElementById('srMarkers'), { onSelect: id => dispatch({ type: 'selectObject', id }) });
  const ui = createUI(doc, { Data, dispatch });

  function renderFrame(now) {
    frame = null;
    const moving = rig.update(now);
    view3d.render(rig.camera);
    // Occlusion rays only once the camera settles -- not every frame.
    const check = !moving && occlusionDue;
    markers.update(rig.camera, size.width, size.height, check ? (anchor, id) => view3d.isOccluded(rig.camera, anchor, id) : null);
    if (check) occlusionDue = false;
    if (moving) { occlusionDue = true; requestRender(); }
  }
  function requestRender() {
    if (frame === null) frame = requestAnimationFrame(renderFrame);
  }

  // A composed view, pulled back as needed for this screen's shape.
  function fit(view) {
    return State.scaleView(view, State.distanceScale(size.width / size.height, rig.camera.fov));
  }

  function layoutInsets() {
    const described = State.describe(state);
    return State.viewInsets(State.layoutMode(size.width), { cardOpen: !!described.card, panelOpen: described.panelOpen }, size);
  }

  function resize() {
    size = { width: stage.clientWidth, height: stage.clientHeight };
    view3d.resize(size.width, size.height);
    rig.resize(size.width, size.height);
    rig.setInsets(layoutInsets());
    occlusionDue = true;
    requestRender();
  }

  function dispatch(action) {
    const prev = state;
    state = State.reduce(state, action);
    if (state === prev) return;
    const described = State.describe(state);
    const zoneChanged = state.zone !== prev.zone;
    const focusChanged = state.selectedObjectId !== prev.selectedObjectId;

    ui.render(described);
    if (zoneChanged) markers.setMarkers(described.markers);
    markers.setSelected(state.selectedObjectId);
    view3d.setHighlight(state.selectedObjectId);
    rig.setInsets(layoutInsets());

    // Move the camera when the client went somewhere: a new zone, or a new
    // object to look at. Closing a card leaves the camera where it is.
    if (zoneChanged || (focusChanged && state.selectedObjectId)) {
      const hide = described.zone.hide;
      rig.goTo(fit(described.cameraView), described.zone.orbit, {
        onMidpoint: zoneChanged ? () => view3d.setHiddenGroups(hide) : null,
        duration: zoneChanged ? 1300 : 900,
      });
    }
    if (zoneChanged) history.replaceState(null, '', location.pathname + State.locationFor(state));
    occlusionDue = true;
    requestRender();
  }

  // Wiring.
  rig.controls.addEventListener('change', requestRender);
  rig.controls.addEventListener('start', () => { ui.hideHint(); requestRender(); });
  window.addEventListener('resize', resize);
  doc.addEventListener('keydown', e => {
    if (e.key !== 'Escape') return;
    if (state.panelOpen) dispatch({ type: 'closePanel' });
    else if (state.selectedObjectId) dispatch({ type: 'closeCard' });
  });
  window.addEventListener('hashchange', () => {
    const zone = State.zoneFromHash(location.hash);
    if (zone && zone !== state.zone) dispatch({ type: 'goToZone', zone });
  });

  // First frame: the arrival zone -- or, entering from the configurator,
  // the product's object with its card open -- then a gentle approach
  // from further out.
  const initial = State.describe(state);
  view3d.setHiddenGroups(initial.zone.hide);
  resize();
  const arrival = fit(initial.cameraView);
  const intro = {
    position: arrival.position.map((p, i) => arrival.target[i] + (p - arrival.target[i]) * 1.35),
    target: arrival.target,
  };
  rig.jumpTo(reducedMotion ? arrival : intro, initial.zone.orbit);
  ui.render(initial);
  markers.setMarkers(initial.markers);
  markers.setSelected(state.selectedObjectId);
  view3d.setHighlight(state.selectedObjectId);
  requestRender();
  requestAnimationFrame(() => {
    doc.getElementById('srLoading').classList.add('is-done');
    if (!reducedMotion) rig.goTo(arrival, initial.zone.orbit, { duration: 1800 });
    ui.showHint();
    requestRender();
  });
}

if (!Data || !State || !House || !State.canUseWebGL(doc)) {
  showFallback('no-webgl');
} else {
  try {
    start();
  } catch (e) {
    showFallback('error');
  }
}
