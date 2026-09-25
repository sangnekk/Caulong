import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { accessorBytes, outputPath, prepare, readGlb, sourcePath } from '../scripts/prepare-hyper-core.mjs';

const sourceBytes = await readFile(sourcePath), bytes = await readFile(outputPath);
const source = readGlb(sourceBytes), output = readGlb(bytes), s = source.json, d = output.json;
assert.deepEqual(bytes, prepare(sourceBytes), 'Committed GLB must reproduce byte-for-byte');
assert(bytes.length < 6_000_000, 'Unexpected size regression; never reduce fidelity to satisfy this check');
assert.equal(d.nodes.length, 17);
assert.equal(d.meshes.length, 4);
assert.equal(d.materials.length, 3);
assert.equal(d.images.length, 9);
assert.equal(d.textures.length, 9);
assert.equal(d.accessors.length, 20);
assert.equal(d.bufferViews.length, 29);
assert.equal(d.nodes[4].name, 'group7_1');
assert(!d.nodes.some(n => n.name === 'group8_12'));
assert.deepEqual(d.nodes[3].children, [4]);
for (let i = 0; i < d.nodes.length; i++) {
  const original = structuredClone(s.nodes[i]);
  if (i === 3) original.children = [4];
  assert.deepEqual(d.nodes[i], original, 'All retained names, transforms and hierarchy must survive');
}
for (const [key, value] of Object.entries(s.asset.extras)) assert.deepEqual(d.asset.extras[key], value);
assert.match(d.asset.extras.attribution, /ghks1120.*CC BY 4.0/);

function imageBytes(doc, texture) {
  const image = doc.json.images[doc.json.textures[texture].source];
  assert.equal(image.mimeType, 'image/png');
  const v = doc.json.bufferViews[image.bufferView];
  const png = doc.bin.subarray(v.byteOffset ?? 0, (v.byteOffset ?? 0) + v.byteLength);
  assert.equal(png.readUInt32BE(16), 1024);
  assert.equal(png.readUInt32BE(20), 1024);
  return png;
}
function compareMaterial(original, result) {
  assert.deepEqual(Object.keys(original), Object.keys(result));
  for (const [key, value] of Object.entries(original)) {
    if (key.endsWith('Texture')) {
      assert.deepEqual({ ...value, index: 0 }, { ...result[key], index: 0 });
      assert.deepEqual(imageBytes(source, value.index), imageBytes(output, result[key].index));
      const a = s.textures[value.index], b = d.textures[result[key].index];
      assert.deepEqual(s.samplers[a.sampler], d.samplers[b.sampler]);
    } else if (value && typeof value === 'object') compareMaterial(value, result[key]);
    else assert.deepEqual(result[key], value);
  }
}
s.materials.slice(0, 3).forEach((m, i) => compareMaterial(m, d.materials[i]));
const referenced = { nodes: new Set(), meshes: new Set(), materials: new Set(), accessors: new Set(), textures: new Set(), images: new Set(), samplers: new Set(), bufferViews: new Set() };
function nodeVisit(i) {
  assert(d.nodes[i]);
  referenced.nodes.add(i);
  const n = d.nodes[i];
  if (n.mesh !== undefined) referenced.meshes.add(n.mesh);
  (n.children ?? []).forEach(nodeVisit);
}
d.scenes[d.scene].nodes.forEach(nodeVisit);
function textureVisit(obj) {
  for (const [key, value] of Object.entries(obj)) {
    if (!value || typeof value !== 'object') continue;
    if (key.endsWith('Texture')) referenced.textures.add(value.index);
    else textureVisit(value);
  }
}
d.materials.forEach(textureVisit);
d.textures.forEach(t => { referenced.images.add(t.source); referenced.samplers.add(t.sampler); });
d.images.forEach(i => referenced.bufferViews.add(i.bufferView));
let triangles = 0;
for (const [i, mesh] of d.meshes.entries()) {
  assert.equal(mesh.primitives.length, 1);
  const p = mesh.primitives[0], original = s.meshes[i].primitives[0];
  assert.equal(p.mode, 4);
  triangles += d.accessors[p.indices].count / 3;
  referenced.materials.add(p.material);
  for (const [semantic, id] of Object.entries({ ...p.attributes, indices: p.indices })) {
    referenced.accessors.add(id);
    const sourceId = semantic === 'indices' ? original.indices : original.attributes[semantic];
    assert.deepEqual(accessorBytes(output, id), accessorBytes(source, sourceId), semantic + ' changed');
    const clean = a => { const { bufferView, byteOffset, ...rest } = a; return rest; };
    assert.deepEqual(clean(d.accessors[id]), clean(s.accessors[sourceId]));
  }
  const indices = accessorBytes(output, p.indices), count = d.accessors[p.attributes.POSITION].count;
  for (let j = 0; j < indices.length; j += 4) assert(indices.readUInt32LE(j) < count);
}
assert.equal(triangles, 60_923);
d.accessors.forEach(a => referenced.bufferViews.add(a.bufferView));
for (const [key, set] of Object.entries(referenced)) assert.equal(set.size, d[key].length, 'Unreachable ' + key);
let end = 0;
for (const view of d.bufferViews) {
  assert.equal(view.buffer, 0);
  assert.equal(view.byteOffset % 4, 0);
  assert.equal(view.byteOffset, Math.ceil(end / 4) * 4);
  end = view.byteOffset + view.byteLength;
  assert(end <= d.buffers[0].byteLength);
}

const identity = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
function multiply(a, b) {
  return a.map((_, i) => [0, 1, 2, 3].reduce((sum, k) => sum + a[k * 4 + i % 4] * b[Math.floor(i / 4) * 4 + k], 0));
}
const emptyBounds = () => ({ min: [Infinity, Infinity, Infinity], max: [-Infinity, -Infinity, -Infinity] });
function include(bounds, p) {
  p.forEach((v, k) => { bounds.min[k] = Math.min(bounds.min[k], v); bounds.max[k] = Math.max(bounds.max[k], v); });
}
const worldBounds = emptyBounds(), parts = [];
function boundsVisit(i, parent) {
  const node = d.nodes[i], world = multiply(parent, node.matrix ?? identity);
  assert(!node.translation && !node.rotation && !node.scale, 'Extend test for TRS if source changes');
  if (node.mesh !== undefined) {
    const p = d.meshes[node.mesh].primitives[0], data = accessorBytes(output, p.attributes.POSITION);
    const local = emptyBounds(), global = emptyBounds();
    for (let j = 0; j < data.length; j += 12) {
      const point = [0, 4, 8].map(k => data.readFloatLE(j + k));
      include(local, point);
      const transformed = [0, 1, 2].map(k => world[k] * point[0] + world[4 + k] * point[1] + world[8 + k] * point[2] + world[12 + k]);
      include(global, transformed);
      include(worldBounds, transformed);
    }
    assert.deepEqual(local.min, d.accessors[p.attributes.POSITION].min);
    assert.deepEqual(local.max, d.accessors[p.attributes.POSITION].max);
    parts.push({ node: node.name, mesh: d.meshes[node.mesh].name, material: d.materials[p.material].name, local, world: global });
  }
  (node.children ?? []).forEach(child => boundsVisit(child, world));
}
d.scenes[d.scene].nodes.forEach(i => boundsVisit(i, identity));
// No triangle even overlaps the central head aperture rectangle: no modeled string bed.
let apertureTriangles = 0;
for (const mesh of d.meshes) {
  const p = mesh.primitives[0], positions = accessorBytes(output, p.attributes.POSITION), indices = accessorBytes(output, p.indices);
  for (let i = 0; i < indices.length; i += 12) {
    const vertices = [0, 4, 8].map(k => indices.readUInt32LE(i + k) * 12);
    const x = vertices.map(v => positions.readFloatLE(v)), z = vertices.map(v => positions.readFloatLE(v + 8));
    if (Math.max(...x) > -5 && Math.min(...x) < 5 && Math.max(...z) > -28 && Math.min(...z) < -14) apertureTriangles++;
  }
}
assert.equal(apertureTriangles, 0, 'Unexpected geometry in open head aperture');
assert(Math.abs((worldBounds.max[2] - worldBounds.min[2]) - 0.675106949) < 1e-8);
console.log(JSON.stringify({ ok: true, bytes: bytes.length, triangles, parts, worldBounds, apertureTriangles }, null, 2));
