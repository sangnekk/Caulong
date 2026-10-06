import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { Box3, Mesh, Vector3 } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const bytes = await readFile(
    new URL('../public/models/racket.glb', import.meta.url),
);
assert.equal(bytes.readUInt32LE(0), 0x46546c67, 'real GLB signature');
assert.equal(bytes.readUInt32LE(4), 2, 'glTF 2.0');
assert.equal(bytes.readUInt32LE(8), bytes.length, 'complete binary');
assert.ok(bytes.length < 500_000, 'model budget: under 500 kB');
const document = JSON.parse(
    bytes.subarray(20, 20 + bytes.readUInt32LE(12)).toString(),
);
assert.ok(!document.images?.length, 'no external textures');
assert.ok(
    document.buffers.every((buffer) => !buffer.uri),
    'self-contained binary',
);
const { scene } = await new GLTFLoader().parseAsync(
    bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
    '',
);
const root = scene.children[0];
assert.equal(root.userData.illustrative, true);
for (const name of ['frame', 'shaft', 'strings', 'grip']) {
    assert.ok(
        root.getObjectByName(name)?.children.length > 0,
        name + ' is modeled',
    );
}
const size = new Box3().setFromObject(scene).getSize(new Vector3());
assert.ok(
    size.y > size.x * 2.5 && size.y < size.x * 3,
    'badminton racket proportions',
);
let triangles = 0,
    meshes = 0;
scene.traverse((object) => {
    if (!(object instanceof Mesh)) return;
    meshes++;
    const positions = object.geometry.getAttribute('position');
    for (const value of positions.array)
        assert.ok(Number.isFinite(value), 'finite geometry');
    triangles += (object.geometry.index?.count ?? positions.count) / 3;
    object.geometry.dispose();
    object.material.dispose();
});
assert.ok(meshes <= 12, 'merged material groups keep draw calls bounded');
assert.ok(triangles < 15_000, 'triangle budget');
const poster = await readFile(
    new URL('../public/models/racket-poster.svg', import.meta.url),
    'utf8',
);
assert.ok(poster.includes('viewBox="0 0 700 700"'));
assert.ok(poster.includes('minh họa'));
assert.ok(
    !poster.includes('<script') && !poster.includes('<image'),
    'self-contained vector poster',
);
console.log(
    'PASS: GLB loads; four modeled parts; ' +
        meshes +
        ' meshes; ' +
        triangles +
        ' triangles; ' +
        bytes.length +
        ' bytes; poster present.',
);
