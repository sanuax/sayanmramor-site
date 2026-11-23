"""The finished pieces as stone-dressed web models (2026-11-23, the owner).

The owner's STL files (millimetres, real size, no colour) become, per piece,
assets/products/<id>/model.glb (the site's 3D view, Android Scene Viewer) and
model.usdz (iPhone / iPad AR Quick Look):

  STL -> fewer triangles -> Z up to Y up, mm to m, base on the floor, centred ->
  normals creased at sharp edges -> a UV atlas (xatlas) -> the stone baked into
  one JPEG: the slab photo projected from three sides, blended by the normal
  (no seams, the slab's own scale: the photo is the whole slab).

Needs Python 3.13 with: trimesh fast-simplification xatlas usd-core numpy pillow
(a venv outside the repo). Run:

  python scripts/build_product_models.py --stl-dir "D:/photo_marble/Stl модели готовых изделий" \
      --stones-dir D:/calculator/.worktrees/rate-catalog-subcategories/data/images \
      --out assets/products [--only stol-01]

It prints one JSON line per piece; its size_mm goes into data/products.json.
"""
import argparse
import io
import json
import os
import shutil
import struct
import tempfile

import numpy as np
from PIL import Image, ImageDraw

# id: (STL file, stone photo, target triangles, texture size, roughness[, spot])
# spot: where on the slab a small piece is cut from, mm from the slab's middle (x right, y down),
# chosen to look like the piece's photo: the vase from the light cream part of the onyx, the shell
# from black crossed by thin white veins (2026-11-23). Larger pieces stand in the middle.
PIECES = {
    'rakushka-01': ('Ракушка.stl', 'negro-marquina', 50000, 1024, 0.18, (-1067, -753)),
    'vaza-01': ('Ваза настольная.stl', 'onice-orange', 50000, 1024, 0.15, (1231, 689)),
    'vanna-oniks-01': ('Ванная из оникса.stl', 'onice-orange', 48367, 2048, 0.15),
    'art-stol-belyy-01': ('Арт-стол (белый).stl', 'bianco-carrara', 80000, 2048, 0.18),
    'art-stol-chernyy-01': ('Арт-стол (чёрный).stl', 'negro-marquina', 80000, 2048, 0.18),
    'statuya-01': ('Статуя.stl', 'bianco-carrara', 120000, 2048, 0.2),
    'stol-01': ('Стол.stl', 'bianco-carrara', 80000, 2048, 0.18),
}
SLAB_MM = 2930.0       # the catalogue's slab photos show a whole slab, about 2.9 m wide
CREASE_DEG = 35.0      # sharper than this between two faces: an edge, not a curve
PADDING = 8            # texels the colour runs past each chart (no dark seams in mip levels)


# ---- mesh ---------------------------------------------------------------------------------

def load_piece(path, target):
    import trimesh
    import fast_simplification
    mesh = trimesh.load(path, force='mesh')
    v, f = np.asarray(mesh.vertices, dtype=np.float64), np.asarray(mesh.faces, dtype=np.int64)
    if len(f) > target * 1.05:
        v, f = fast_simplification.simplify(v, f, target_reduction=1.0 - target / len(f))
    # Z up (STL) -> Y up (glTF, USD); millimetres stay until the end (the stone's scale is in mm).
    v = np.stack([v[:, 0], v[:, 2], -v[:, 1]], axis=1)
    lo, hi = v.min(0), v.max(0)
    v = v - np.array([(lo[0] + hi[0]) / 2, lo[1], (lo[2] + hi[2]) / 2])
    mesh = trimesh.Trimesh(v, f, process=True)
    mesh.remove_unreferenced_vertices()
    if mesh.is_watertight and mesh.volume < 0:
        mesh.invert()
    return mesh


def crease(mesh):
    """Split vertices where faces meet at more than CREASE_DEG: flat tops stay flat, curves smooth."""
    import trimesh
    shaded = trimesh.graph.smooth_shade(mesh, angle=np.radians(CREASE_DEG))
    return np.asarray(shaded.vertices), np.asarray(shaded.faces), np.asarray(shaded.vertex_normals)


def unwrap(v, f, n, size):
    import xatlas
    atlas = xatlas.Atlas()
    atlas.add_mesh(v.astype(np.float32), f.astype(np.uint32), n.astype(np.float32))
    co, po = xatlas.ChartOptions(), xatlas.PackOptions()
    po.resolution = size
    po.padding = PADDING // 2
    po.bilinear = True
    atlas.generate(co, po)
    vmap, idx, uv = atlas[0]
    return v[vmap], n[vmap], idx.astype(np.int64), uv.astype(np.float64)


# ---- the stone ----------------------------------------------------------------------------

def stone_sampler(photo):
    """Bilinear lookup of the slab photo by millimetres, (0, 0) = the slab's middle; mirrored
    only past its edges (a piece larger than the slab)."""
    img = np.asarray(Image.open(photo).convert('RGB'), dtype=np.float32)
    h, w = img.shape[:2]
    mm_per_px = SLAB_MM / w

    def mirror(i, n):
        i = np.mod(i, 2 * n)
        return np.where(i >= n, 2 * n - 1 - i, i)

    def sample(a, b):
        x, y = a / mm_per_px + w / 2, b / mm_per_px + h / 2
        x0, y0 = np.floor(x).astype(np.int64), np.floor(y).astype(np.int64)
        fx, fy = (x - x0)[:, None], (y - y0)[:, None]
        xa, xb, ya, yb = mirror(x0, w), mirror(x0 + 1, w), mirror(y0, h), mirror(y0 + 1, h)
        top = img[ya, xa] * (1 - fx) + img[ya, xb] * fx
        bot = img[yb, xa] * (1 - fx) + img[yb, xb] * fx
        return top * (1 - fy) + bot * fy

    return sample


def bake(v, n, f, uv, size, photo, spot=(0, 0)):
    """Rasterise each triangle in UV space, find the surface point under each texel, take the
    stone from three sides weighted by the normal."""
    px = uv * size
    ids = Image.new('RGB', (size, size), (0, 0, 0))
    draw = ImageDraw.Draw(ids)
    for k, tri in enumerate(f):
        code = k + 1
        col = (code & 255, (code >> 8) & 255, (code >> 16) & 255)
        pts = [tuple(px[i]) for i in tri]
        draw.polygon(pts, fill=col, outline=col)
    a = np.asarray(ids, dtype=np.int64)
    tri_id = a[..., 0] + (a[..., 1] << 8) + (a[..., 2] << 16) - 1
    ys, xs = np.nonzero(tri_id >= 0)
    t = tri_id[ys, xs]
    p = np.stack([xs + 0.5, ys + 0.5], 1)
    A, B, C = px[f[t, 0]], px[f[t, 1]], px[f[t, 2]]
    v0, v1, v2 = B - A, C - A, p - A
    d00, d01, d11 = (v0 * v0).sum(1), (v0 * v1).sum(1), (v1 * v1).sum(1)
    d20, d21 = (v2 * v0).sum(1), (v2 * v1).sum(1)
    den = d00 * d11 - d01 * d01
    den[np.abs(den) < 1e-12] = 1e-12
    bv = (d11 * d20 - d01 * d21) / den
    bw = (d00 * d21 - d01 * d20) / den
    bary = np.clip(np.stack([1 - bv - bw, bv, bw], 1), 0, 1)
    bary /= bary.sum(1, keepdims=True)
    pos = sum(bary[:, i:i + 1] * v[f[t, i]] for i in range(3))
    nor = sum(bary[:, i:i + 1] * n[f[t, i]] for i in range(3))
    nor /= np.linalg.norm(nor, axis=1, keepdims=True) + 1e-12
    wgt = np.abs(nor) ** 4
    wgt /= wgt.sum(1, keepdims=True)
    whole = stone_sampler(photo)
    sample = lambda a, b: whole(a + spot[0], b + spot[1])
    # the piece stands in the middle of the slab (its height centred too); each side a little
    # apart, so the three projections never repeat each other where they meet
    mid = (pos[:, 1].max() + pos[:, 1].min()) / 2
    col = (sample(-pos[:, 2] + 90, mid - pos[:, 1] - 60) * wgt[:, 0:1]
           + sample(pos[:, 0] - 70, pos[:, 2] + 50) * wgt[:, 1:2]
           + sample(pos[:, 0] + 40, mid - pos[:, 1] + 80) * wgt[:, 2:3])
    out = np.zeros((size, size, 3), np.float32)
    filled = np.zeros((size, size), bool)
    out[ys, xs] = col
    filled[ys, xs] = True
    for _ in range(PADDING):
        acc = np.zeros_like(out)
        cnt = np.zeros((size, size), np.float32)
        for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1), (1, 1), (1, -1), (-1, 1), (-1, -1)):
            s_out = np.roll(out, (dy, dx), (0, 1))
            s_f = np.roll(filled, (dy, dx), (0, 1))
            acc += s_out * s_f[..., None]
            cnt += s_f
        grow = (~filled) & (cnt > 0)
        out[grow] = acc[grow] / cnt[grow][:, None]
        filled |= grow
    if (~filled).any():
        out[~filled] = out[filled].mean(0)
    buf = io.BytesIO()
    Image.fromarray(np.clip(out, 0, 255).astype(np.uint8)).save(buf, 'JPEG', quality=88, optimize=True)
    return buf.getvalue()


# ---- files --------------------------------------------------------------------------------

def write_glb(path, v_m, n, idx, uv, jpeg, roughness, name):
    pos = v_m.astype(np.float32)
    nor = n.astype(np.float32)
    tex = uv.astype(np.float32)
    ind = idx.astype(np.uint16 if len(pos) < 65536 else np.uint32).ravel()
    chunks, views, off = [], [], 0

    def add(data, target=None):
        nonlocal off
        b = data.tobytes() if isinstance(data, np.ndarray) else data
        views.append({'buffer': 0, 'byteOffset': off, 'byteLength': len(b), **({'target': target} if target else {})})
        pad = (-len(b)) % 4
        chunks.append(b + b'\0' * pad)
        off += len(b) + pad
        return len(views) - 1

    vp, vn, vt = add(pos, 34962), add(nor, 34962), add(tex, 34962)
    vi = add(ind, 34963)
    vimg = add(jpeg)
    gltf = {
        'asset': {'version': '2.0', 'generator': 'sayanmramor build_product_models.py'},
        'scene': 0, 'scenes': [{'nodes': [0]}],
        'nodes': [{'mesh': 0, 'name': name}],
        'meshes': [{'name': name, 'primitives': [{
            'attributes': {'POSITION': 0, 'NORMAL': 1, 'TEXCOORD_0': 2}, 'indices': 3, 'material': 0}]}],
        'materials': [{'name': 'stone', 'pbrMetallicRoughness': {
            'baseColorTexture': {'index': 0}, 'metallicFactor': 0.0, 'roughnessFactor': roughness}}],
        'textures': [{'source': 0, 'sampler': 0}],
        'samplers': [{'magFilter': 9729, 'minFilter': 9987, 'wrapS': 33071, 'wrapT': 33071}],
        'images': [{'bufferView': vimg, 'mimeType': 'image/jpeg'}],
        'accessors': [
            {'bufferView': vp, 'componentType': 5126, 'count': len(pos), 'type': 'VEC3',
             'min': pos.min(0).tolist(), 'max': pos.max(0).tolist()},
            {'bufferView': vn, 'componentType': 5126, 'count': len(nor), 'type': 'VEC3'},
            {'bufferView': vt, 'componentType': 5126, 'count': len(tex), 'type': 'VEC2'},
            {'bufferView': vi, 'componentType': 5123 if ind.dtype == np.uint16 else 5125,
             'count': len(ind), 'type': 'SCALAR'},
        ],
        'bufferViews': views,
        'buffers': [{'byteLength': off}],
    }
    js = json.dumps(gltf, separators=(',', ':')).encode()
    js += b' ' * ((-len(js)) % 4)
    binary = b''.join(chunks)
    total = 12 + 8 + len(js) + 8 + len(binary)
    with open(path, 'wb') as fh:
        fh.write(struct.pack('<4sII', b'glTF', 2, total))
        fh.write(struct.pack('<I4s', len(js), b'JSON') + js)
        fh.write(struct.pack('<I4s', len(binary), b'BIN\0') + binary)


def write_usdz(path, v_m, n, idx, uv, jpeg, roughness):
    from pxr import Gf, Sdf, Usd, UsdGeom, UsdShade, UsdUtils, Vt
    tmp = tempfile.mkdtemp()
    try:
        with open(os.path.join(tmp, 'stone.jpg'), 'wb') as fh:
            fh.write(jpeg)
        usda = os.path.join(tmp, 'model.usdc')
        stage = Usd.Stage.CreateNew(usda)
        UsdGeom.SetStageUpAxis(stage, UsdGeom.Tokens.y)
        UsdGeom.SetStageMetersPerUnit(stage, 1.0)
        root = UsdGeom.Xform.Define(stage, '/Piece')
        stage.SetDefaultPrim(root.GetPrim())
        mesh = UsdGeom.Mesh.Define(stage, '/Piece/Stone')
        mesh.CreateSubdivisionSchemeAttr('none')
        mesh.CreatePointsAttr(Vt.Vec3fArray.FromNumpy(v_m.astype(np.float32)))
        mesh.CreateFaceVertexCountsAttr(Vt.IntArray.FromNumpy(np.full(len(idx), 3, np.int32)))
        mesh.CreateFaceVertexIndicesAttr(Vt.IntArray.FromNumpy(idx.astype(np.int32).ravel()))
        mesh.CreateNormalsAttr(Vt.Vec3fArray.FromNumpy(n.astype(np.float32)))
        mesh.SetNormalsInterpolation(UsdGeom.Tokens.vertex)
        lo, hi = v_m.min(0), v_m.max(0)
        mesh.CreateExtentAttr([Gf.Vec3f(*map(float, lo)), Gf.Vec3f(*map(float, hi))])
        st = UsdGeom.PrimvarsAPI(mesh).CreatePrimvar('st', Sdf.ValueTypeNames.TexCoord2fArray, UsdGeom.Tokens.vertex)
        st.Set(Vt.Vec2fArray.FromNumpy(np.stack([uv[:, 0], 1.0 - uv[:, 1]], 1).astype(np.float32)))
        mat = UsdShade.Material.Define(stage, '/Piece/Stone_material')
        pbr = UsdShade.Shader.Define(stage, '/Piece/Stone_material/Surface')
        pbr.CreateIdAttr('UsdPreviewSurface')
        pbr.CreateInput('metallic', Sdf.ValueTypeNames.Float).Set(0.0)
        pbr.CreateInput('roughness', Sdf.ValueTypeNames.Float).Set(float(roughness))
        pbr.CreateInput('clearcoat', Sdf.ValueTypeNames.Float).Set(1.0)
        pbr.CreateInput('clearcoatRoughness', Sdf.ValueTypeNames.Float).Set(0.05)
        reader = UsdShade.Shader.Define(stage, '/Piece/Stone_material/st')
        reader.CreateIdAttr('UsdPrimvarReader_float2')
        reader.CreateInput('varname', Sdf.ValueTypeNames.String).Set('st')
        reader.CreateOutput('result', Sdf.ValueTypeNames.Float2)
        tex = UsdShade.Shader.Define(stage, '/Piece/Stone_material/stone')
        tex.CreateIdAttr('UsdUVTexture')
        tex.CreateInput('file', Sdf.ValueTypeNames.Asset).Set('stone.jpg')
        tex.CreateInput('sourceColorSpace', Sdf.ValueTypeNames.Token).Set('sRGB')
        tex.CreateInput('wrapS', Sdf.ValueTypeNames.Token).Set('clamp')
        tex.CreateInput('wrapT', Sdf.ValueTypeNames.Token).Set('clamp')
        tex.CreateInput('st', Sdf.ValueTypeNames.Float2).ConnectToSource(reader.ConnectableAPI(), 'result')
        tex.CreateOutput('rgb', Sdf.ValueTypeNames.Float3)
        pbr.CreateInput('diffuseColor', Sdf.ValueTypeNames.Color3f).ConnectToSource(tex.ConnectableAPI(), 'rgb')
        mat.CreateSurfaceOutput().ConnectToSource(pbr.ConnectableAPI(), 'surface')
        UsdShade.MaterialBindingAPI.Apply(mesh.GetPrim()).Bind(mat)
        stage.GetRootLayer().Save()
        if os.path.exists(path):
            os.remove(path)
        if not UsdUtils.CreateNewARKitUsdzPackage(Sdf.AssetPath(usda), path):
            raise RuntimeError('usdz package failed: ' + path)
    finally:
        shutil.rmtree(tmp, ignore_errors=True)


def build(pid, stl_dir, stones_dir, out):
    stl, stone, target, size, rough = PIECES[pid][:5]
    spot = PIECES[pid][5] if len(PIECES[pid]) > 5 else (0, 0)
    mesh = load_piece(os.path.join(stl_dir, stl), target)
    v, f, n = crease(mesh)
    v, n, idx, uv = unwrap(v, f, n, size)
    jpeg = bake(v, n, idx, uv, size, os.path.join(stones_dir, stone + '.webp'), spot)
    v_m = v / 1000.0
    folder = os.path.join(out, pid)
    os.makedirs(folder, exist_ok=True)
    glb, usdz = os.path.join(folder, 'model.glb'), os.path.join(folder, 'model.usdz')
    write_glb(glb, v_m, n, idx, uv, jpeg, rough, pid)
    write_usdz(usdz, v_m, n, idx, uv, jpeg, rough)
    ext = v.max(0) - v.min(0)   # x = width, y = height, z = depth (mm)
    return {'id': pid, 'size_mm': [round(ext[0]), round(ext[2]), round(ext[1])], 'tris': int(len(idx)),
            'glb_bytes': os.path.getsize(glb), 'usdz_bytes': os.path.getsize(usdz)}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--stl-dir', required=True)
    ap.add_argument('--stones-dir', required=True)
    ap.add_argument('--out', default='assets/products')
    ap.add_argument('--only', action='append')
    ap.add_argument('--target', type=int, help='triangles, instead of the table above (a check against the STL)')
    a = ap.parse_args()
    if a.target:
        for k in PIECES:
            PIECES[k] = (PIECES[k][0], PIECES[k][1], a.target) + PIECES[k][3:]
    for pid in a.only or list(PIECES):
        print(json.dumps(build(pid, a.stl_dir, a.stones_dir, a.out), ensure_ascii=False), flush=True)


if __name__ == '__main__':
    main()
