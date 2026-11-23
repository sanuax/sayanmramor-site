# «Готовые изделия»: 3D и AR — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** names with the stone, stone-dressed web models of the 7 pieces, a «3D» button per card opening a turnable viewer with AR (Quick Look / Scene Viewer / QR on desktop).

**Architecture:** an offline Python build turns the owner's STL into `model.glb` + `model.usdz` per piece (decimated, xatlas UVs, triplanar stone baked into one JPEG). `data/products.json` lists them under `model`. `js/catalog.js` adds the button; `js/model-view.js` (ES module, loaded on the first press) draws the GLB with the vendored three.js and builds the AR links.

**Tech Stack:** Python 3.13 venv (trimesh, fast-simplification, xatlas, usd-core, Pillow, numpy); three.js 0.160 (vendor/three) + OrbitControls; qrcode (copied from the calculator's vendor/qrcode); node:test.

**Spec:** `docs/superpowers/specs/2026-11-23-catalog-3d-ar-design.md`

## Global Constraints

- No long dash « — » in new copy, only « - ».
- Card look unchanged apart from the small «3D» chip on the photo (37b1597 / c110f7b).
- After editing css/ or js/: `node scripts/stamp_assets.js`.
- Files written from Python: bytes / `newline=''` (LF stays LF).
- Nothing pushed without the owner's word.
- Models load only on a press; the catalogue page weight stays the same.
- Real size: glTF metres, Y up, base on y=0, centred in x/z; USDZ `metersPerUnit = 1`, Quick Look scaling off (`#allowsContentScaling=0`), Scene Viewer `resizable=false`.

## Review Focus

- A piece without `model` (the console): no chip, nothing breaks (test in Task 2).
- A piece sold (`available: false`) keeps its 3D chip (it is still a thing to look at) (Task 2 test).
- No WebGL: the viewer says so in one line instead of a blank window (Task 3, checked in the browser with WebGL off).
- Telegram / in-app browsers: the AR link is still an ordinary link (no JS-only launch) (Task 3 markup).
- Esc / the cross / a click on the veil close the viewer and free the renderer (Task 3, browser check: `renderer.dispose` called, no rAF left).

---

### Task 1: Model build script + the 7 models

**Files:**
- Create: `scripts/build_product_models.py`
- Create: `assets/products/<id>/model.glb`, `model.usdz` (7 pieces)
- Modify: `assets/products/SOURCES.md` (section «3D-модели»)

**Interfaces:**
- Produces: `assets/products/<id>/model.glb` (one mesh, one material: baseColorTexture JPEG, metallic 0, roughness per stone; positions in metres, Y up, base y=0), `model.usdz` (same mesh, UsdPreviewSurface, ARKit-valid), and a printed JSON line per piece `{"id", "size_mm":[w,d,h], "tris", "glb_bytes", "usdz_bytes"}` that Task 2 copies into products.json.

- [ ] Script CLI: `python scripts/build_product_models.py --stl-dir <dir> --stones-dir <calculator data/images> --out assets/products [--only <id>]`; table PIECES inside: id → (stl file name, stone file, target triangles, roughness). Stones: negro-marquina / bianco-carrara / onice-orange; slab photo = 2930 mm wide.
- [ ] Steps per piece: load STL (mm) → `fast_simplification.simplify` to the target (small pieces 40k, tables 60-80k, statue 120k) → Z-up to Y-up, mm → m, base on 0, centred → normals with crease at 35° → xatlas → bake: rasterise triangle ids in UV space (PIL polygons), barycentric → world position + normal → triplanar sample (weights |n|^4) of the stone (mirror-tiled) → 2048² (big) / 1024² (small) JPEG q 88, 8 px padding by dilation.
- [ ] GLB writer (own, minimal glTF 2.0: POSITION, NORMAL, TEXCOORD_0, uint16/uint32 indices, image/jpeg); USDZ via pxr (`UsdUtils.CreateNewARKitUsdzPackage` from a temp .usda + texture).
- [ ] Run for all 7; look at each in the viewer (Task 3) against the card photo; sizes ≤ ~3 MB GLB.
- [ ] Commit: `feat(catalog): stone-dressed 3D models of the finished pieces`.

### Task 2: Data + names + the «3D» chip

**Files:**
- Modify: `data/products.json`, `js/catalog.js`, `css/site.css`, `katalog.html` (meta descriptions), `tests/catalog.test.js`

**Interfaces:**
- Consumes: Task 1 files and printed `size_mm`.
- Produces: `product.model = { glb, usdz, size_mm }`; card markup: `<button class="stock-3d" type="button" data-model="<id>">3D</button>` inside `.stock-shot`; `Catalog.renderCatalog(..., parts.onModel(product))` called on its press; `Catalog.modelSize(product) -> '1670 × 815 × 550 мм'`.

- [ ] Tests first (tests/catalog.test.js): names list = the spec's 8 names; every product with `model` has existing glb+usdz under its own folder and `size_mm` of 3 positive numbers; the console has no `model`; render: a card with `model` has one `.stock-3d` button (also when `available: false`), the console card none; pressing it calls `parts.onModel` with that product; `modelSize` formats with thin non-breaking separators as above.
- [ ] Implement; chip styled like `.stock-count` (same plate), placed top-left; `katalog.html` loads `model-view.js` lazily via `import()` from catalog page script on the first press; `?3d=<id>` opens that piece's viewer on load (used by the desktop QR).
- [ ] `node --test tests/*.test.js` all pass; stamp assets; commit.

### Task 3: The viewer and AR

**Files:**
- Create: `js/model-view.js`, `css/model-view.css` (linked from katalog.html and podborka.html if it renders catalogue cards), `vendor/qrcode/` (copy from the calculator), `tests/model-view.test.js`

**Interfaces:**
- Consumes: `product.model`, `product.name`, `Catalog.modelSize`.
- Produces: `export function open(product, opener)`, `export function parseGlb(arrayBuffer) -> { positions, normals, uvs, indices, image: Blob, material: {roughness} }`, `export function arLinks(product, pageUrl, ua) -> { kind: 'ios'|'android'|'qr', href }`.

- [ ] Tests first: `parseGlb` on a GLB built by the script returns arrays of matching lengths; `arLinks` for an iPhone UA → `.usdz#allowsContentScaling=0`; Android UA → `intent://arvr.google.com/scene-viewer/1.0?file=<absolute glb>&mode=ar_preferred&resizable=false&title=<name>#Intent;scheme=https;package=com.google.ar.core;action=android.intent.action.VIEW;S.browser_fallback_url=<page>;end;`; desktop → `qr` with `katalog.html?3d=<id>`.
- [ ] Viewer: dialog over the page like the photo viewer (veil, cross, Esc), light studio background, PMREM RoomEnvironment-like light built from scene boxes (as showroom-scene buildEnvironment), MeshPhysicalMaterial (clearcoat 1, clearcoat roughness 0.08) from the GLB texture, OrbitControls (damping, no pan, min/max distance from the model size), slow auto-turn until the first touch, caption = name + size; AR button: iOS `<a rel="ar">` with an `<img>` child; Android the intent link; desktop opens a QR plate. No WebGL → one line «3D не поддерживается этим браузером».
- [ ] Browser checks: desktop 1440, phone 375; close frees renderer; console card no chip.
- [ ] Tests pass; stamp; commit `feat(catalog): 3D viewer and AR for the finished pieces`.
