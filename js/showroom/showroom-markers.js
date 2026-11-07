// js/showroom/showroom-markers.js
//
// Interactive points pinned to real objects in the house. Only the current
// zone's markers exist in the DOM (a handful of <button>s, keyboard- and
// screen-reader-reachable), repositioned from their 3D anchors whenever
// the scene renders. A marker behind a wall dims instead of floating on top
// of it; one outside the view disappears.
import * as THREE from '../../vendor/three/three.module.js';

export function createMarkers(layer, { onSelect }) {
  let items = [];
  const v = new THREE.Vector3();

  function setMarkers(markers) {
    layer.replaceChildren();
    items = markers.map(m => {
      const el = document.createElement('button');
      el.type = 'button';
      el.className = 'sr-marker' + (m.selected ? ' is-selected' : '');
      el.setAttribute('aria-label', m.title + ' — ' + m.productLabel);
      el.dataset.objectId = m.id;
      const dot = document.createElement('span');
      dot.className = 'sr-marker-dot';
      const label = document.createElement('span');
      label.className = 'sr-marker-label';
      label.textContent = m.title;
      el.append(dot, label);
      el.addEventListener('click', () => onSelect(m.id));
      layer.appendChild(el);
      return { el, marker: m, occluded: false };
    });
  }

  function setSelected(id) {
    items.forEach(it => it.el.classList.toggle('is-selected', it.marker.id === id));
  }

  // occlusion: (anchor, id) -> boolean. Checked only when asked (the camera
  // has settled), not on every frame of a transition.
  function update(camera, width, height, occlusion) {
    items.forEach(it => {
      v.set(...it.marker.anchor).project(camera);
      const offscreen = v.z > 1 || v.x < -1.05 || v.x > 1.05 || v.y < -1.05 || v.y > 1.05;
      const x = (v.x * 0.5 + 0.5) * width;
      const y = (-v.y * 0.5 + 0.5) * height;
      it.el.style.transform = 'translate(' + x.toFixed(1) + 'px,' + y.toFixed(1) + 'px)';
      it.el.classList.toggle('is-offscreen', offscreen);
      it.el.tabIndex = offscreen ? -1 : 0;
      if (occlusion) it.occluded = occlusion(it.marker.anchor, it.marker.id);
      it.el.classList.toggle('is-occluded', it.occluded);
    });
  }

  return { setMarkers, setSelected, update };
}
