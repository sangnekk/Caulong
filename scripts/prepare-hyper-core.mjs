import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const sourcePath = new URL('../glb/hyper_core8000_-_badminton_racket_3d_modeling.glb', import.meta.url);
export const outputPath = new URL('../public/models/hyper-core.glb', import.meta.url);
export const sourceHash = '20c664bc243e3352f4f1c221289078cd615742b8acce7f90257abf5f4982226c';
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const align = n => Math.ceil(n / 4) * 4;

export function readGlb(bytes) {
  assert.equal(bytes.readUInt32LE(0), 0x46546c67);
  assert.equal(bytes.readUInt32LE(4), 2);
  assert.equal(bytes.readUInt32LE(8), bytes.length);
  const size = bytes.readUInt32LE(12);
  assert.equal(bytes.readUInt32LE(16), 0x4e4f534a);
  assert.equal(bytes.readUInt32LE(24 + size), 0x004e4942);
  const json = JSON.parse(bytes.subarray(20, 20 + size).toString());
  const bin = bytes.subarray(28 + size);
  assert.equal(bytes.readUInt32LE(20 + size), bin.length);
  assert.equal(json.buffers.length, 1);
  assert(!json.buffers[0].uri);
  assert(json.buffers[0].byteLength <= bin.length);
  return { json, bin };
}

export function accessorBytes({ json, bin }, index) {
  const a = json.accessors[index], v = json.bufferViews[a.bufferView];
  assert(!a.sparse, 'Sparse accessors need explicit repacking support');
  const size = ({ SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 }[a.type]) *
    ({ 5121: 1, 5123: 2, 5125: 4, 5126: 4 }[a.componentType]);
  assert(size, 'Unsupported accessor format');
  const stride = v.byteStride ?? size, offset = a.byteOffset ?? 0;
  assert.equal(v.buffer, 0);
  assert(offset + (a.count - 1) * stride + size <= v.byteLength);
  assert((v.byteOffset ?? 0) + v.byteLength <= bin.length);
  const result = Buffer.alloc(a.count * size);
  for (let i = 0; i < a.count; i++) {
    const start = (v.byteOffset ?? 0) + offset + i * stride;
    bin.copy(result, i * size, start, start + size);
  }
  return result;
}

export function prepare(bytes) {
  // ponytail: pinned static Sketchfab asset only; extend remapping before accepting other models.
  assert.equal(hash(bytes), sourceHash, 'Source changed; inspect before updating the pinned hash');
  const source = readGlb(bytes), s = source.json, d = structuredClone(s);
  const keep = new Set();
  function visit(i) {
    if (i === 17) return;
    keep.add(i);
    for (const child of s.nodes[i].children ?? []) visit(child);
  }
  assert.equal(s.nodes[4].name, 'group7_1');
  assert.equal(s.nodes[17].name, 'group8_12');
  s.scenes[s.scene].nodes.forEach(visit);
  const nodeIds = [...keep], nodeMap = new Map(nodeIds.map((id, i) => [id, i]));
  d.nodes = nodeIds.map(id => {
    const node = structuredClone(s.nodes[id]);
    if (node.children) node.children = node.children.filter(i => keep.has(i)).map(i => nodeMap.get(i));
    return node;
  });
  d.scenes = [structuredClone(s.scenes[s.scene])];
  d.scenes[0].nodes = d.scenes[0].nodes.map(i => nodeMap.get(i));
  d.scene = 0;
  const meshIds = [...new Set(d.nodes.flatMap(n => n.mesh === undefined ? [] : [n.mesh]))];
  d.meshes = meshIds.map(i => structuredClone(s.meshes[i]));
  for (const node of d.nodes) if (node.mesh !== undefined) node.mesh = meshIds.indexOf(node.mesh);
  const materialIds = [...new Set(d.meshes.flatMap(m => m.primitives.map(p => p.material)))];
  d.materials = materialIds.map(i => structuredClone(s.materials[i]));
  for (const mesh of d.meshes) for (const p of mesh.primitives) p.material = materialIds.indexOf(p.material);
  const textureIds = [];
  function remapTextures(obj) {
    for (const [key, value] of Object.entries(obj)) {
      if (!value || typeof value !== 'object') continue;
      if (key.endsWith('Texture')) {
        if (!textureIds.includes(value.index)) textureIds.push(value.index);
        value.index = textureIds.indexOf(value.index);
      } else remapTextures(value);
    }
  }
  d.materials.forEach(remapTextures);
  d.textures = textureIds.map(i => structuredClone(s.textures[i]));
  const imageIds = [...new Set(d.textures.map(t => t.source))];
  const samplerIds = [...new Set(d.textures.map(t => t.sampler))];
  d.images = imageIds.map(i => structuredClone(s.images[i]));
  d.samplers = samplerIds.map(i => structuredClone(s.samplers[i]));
  for (const t of d.textures) {
    t.source = imageIds.indexOf(t.source);
    t.sampler = samplerIds.indexOf(t.sampler);
  }
  d.accessors = [];
  d.bufferViews = [];
  const chunks = [], accessorMap = new Map(), identical = new Map();
  let length = 0;
  function addView(data, properties = {}) {
    const index = d.bufferViews.length;
    d.bufferViews.push({ ...properties, buffer: 0, byteOffset: length, byteLength: data.length });
    chunks.push(data, Buffer.alloc(align(data.length) - data.length));
    length += align(data.length);
    return index;
  }
  function remapAccessor(id) {
    if (accessorMap.has(id)) return accessorMap.get(id);
    const a = structuredClone(s.accessors[id]), data = accessorBytes(source, id);
    const target = s.bufferViews[a.bufferView].target;
    delete a.bufferView;
    delete a.byteOffset;
    const key = JSON.stringify([a, target, hash(data)]);
    let index = identical.get(key);
    if (index === undefined) {
      index = d.accessors.length;
      a.bufferView = addView(data, target === undefined ? {} : { target });
      d.accessors.push(a);
      identical.set(key, index);
    }
    accessorMap.set(id, index);
    return index;
  }
  for (const mesh of d.meshes) for (const p of mesh.primitives) {
    p.indices = remapAccessor(p.indices);
    for (const key of Object.keys(p.attributes)) p.attributes[key] = remapAccessor(p.attributes[key]);
  }
  for (const image of d.images) {
    const view = s.bufferViews[image.bufferView], offset = view.byteOffset ?? 0;
    image.bufferView = addView(source.bin.subarray(offset, offset + view.byteLength), view.name ? { name: view.name } : {});
  }
  d.buffers = [{ byteLength: length }];
  d.asset.extras = {
    ...s.asset.extras,
    attribution: 'Hyper Core8000 - badminton racket 3D modeling by ghks1120 (https://sketchfab.com/ghks1120), licensed CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/).',
    modifications: 'Kept group7_1; removed group8_12 and unreachable resources; compacted accessor bytes; shared byte-identical accessors. Original geometry, PNG bytes, materials, UV semantics and transforms preserved. No strings added.',
    sourceSha256: sourceHash,
    retainedGroup: 'group7_1',
    removedGroup: 'group8_12',
  };
  const json = Buffer.from(JSON.stringify(d)), jsonChunk = Buffer.alloc(align(json.length), 0x20);
  json.copy(jsonChunk);
  const header = Buffer.alloc(20), binHeader = Buffer.alloc(8);
  header.writeUInt32LE(0x46546c67, 0);
  header.writeUInt32LE(2, 4);
  header.writeUInt32LE(28 + jsonChunk.length + length, 8);
  header.writeUInt32LE(jsonChunk.length, 12);
  header.writeUInt32LE(0x4e4f534a, 16);
  binHeader.writeUInt32LE(length, 0);
  binHeader.writeUInt32LE(0x004e4942, 4);
  return Buffer.concat([header, jsonChunk, binHeader, ...chunks]);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const bytes = prepare(await readFile(sourcePath));
  await mkdir(new URL('.', outputPath), { recursive: true });
  await writeFile(outputPath, bytes);
  const { json } = readGlb(bytes);
  console.log(JSON.stringify({ output: fileURLToPath(outputPath), bytes: bytes.length,
    meshes: json.meshes.length, materials: json.materials.length, images: json.images.length,
    triangles: json.meshes.reduce((sum, m) => sum + m.primitives.reduce((n, p) => n + json.accessors[p.indices].count / 3, 0), 0),
    orientation: 'Original transforms retained: long axis Z, head -Z, grip +Z. Rotate X +PI/2 for head-up Y.' }, null, 2));
}
