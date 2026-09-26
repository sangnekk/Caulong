import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { readSourceGeometry } from '../scripts/bake-racket-strings.mjs';
import { addRacketStrings } from '../resources/js/lib/racket-strings.ts';

const bytes = readFileSync(
    new URL('../public/models/hyper-core-strings.glb', import.meta.url),
);
assert.ok(bytes.length < 500_000);
assert.equal(bytes.readUInt32LE(0), 0x46546c67);
assert.equal(bytes.readUInt32LE(8), bytes.length);
const json = JSON.parse(
    bytes.toString('utf8', 20, 20 + bytes.readUInt32LE(12)),
);
assert.equal(json.images, undefined);
assert.equal(json.textures, undefined);
assert.equal(json.meshes.length, 1);
assert.equal(json.materials.length, 1);
assert.equal(json.meshes[0].primitives.length, 1);
assert.equal(json.meshes[0].primitives[0].attributes.TEXCOORD_0, undefined);
assert.equal(typeof document, 'undefined');
const loaded = await new GLTFLoader().parseAsync(
    bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.length),
    '',
);
const baked = loaded.scene.getObjectByName('IllustrativeRacketStrings');
assert.ok(baked instanceof THREE.Mesh);
assert.equal(baked.userData.part, 'strings');
assert.equal(baked.userData.illustrative, true);
assert.equal(baked.userData.mainCount, 20);
assert.equal(baked.userData.crossCount, 24);
assert.equal(baked.userData.stringCount, 44);
assert.equal(baked.userData.triangleCount, 3616);
assert.equal(baked.userData.segmentCount, 452);
assert.equal(baked.geometry.index.count / 3, 3616);
assert.equal(baked.material.map, null);
assert.equal(baked.material.roughness, 0.68);
assert.equal(baked.material.metalness, 0);
loaded.scene.updateMatrixWorld(true);
assert.deepEqual(baked.matrixWorld.elements, new THREE.Matrix4().elements);
for (const attribute of Object.values(baked.geometry.attributes)) {
    assert.ok(Array.from(attribute.array).every(Number.isFinite));
}

const { root, asset, bytes: sourceBytes } = readSourceGeometry();
assert.equal(baked.userData.baseModel.author, asset.extras.author);
assert.equal(baked.userData.baseModel.source, asset.extras.source);
assert.equal(baked.userData.baseModel.license, asset.extras.license);
assert.equal(
    baked.userData.baseModel.sha256,
    createHash('sha256').update(sourceBytes).digest('hex'),
);
assert.match(baked.userData.strings.author, /original illustrative addition/);
const sourceBounds = new THREE.Box3().setFromObject(root, true);
const runtime = addRacketStrings(root);
root.updateMatrixWorld(true);
const actual = baked.geometry.attributes.position;
const expected = runtime.geometry.attributes.position;
assert.equal(actual.count, expected.count);
assert.deepEqual(baked.geometry.index.array, runtime.geometry.index.array);
const tolerance = 1e-7; // Float32 export rounding, in meters.
for (let i = 0; i < actual.count; i++) {
    const world = new THREE.Vector3()
        .fromBufferAttribute(expected, i)
        .applyMatrix4(runtime.matrixWorld);
    assert.ok(
        world.distanceTo(new THREE.Vector3().fromBufferAttribute(actual, i)) <
            tolerance,
        'World vertex mismatch: ' + i,
    );
}
const runtimeBounds = new THREE.Box3().setFromObject(runtime, true);
const bakedBounds = new THREE.Box3().setFromObject(loaded.scene, true);
assert.ok(runtimeBounds.min.distanceTo(bakedBounds.min) < tolerance);
assert.ok(runtimeBounds.max.distanceTo(bakedBounds.max) < tolerance);
assert.ok(
    sourceBounds.containsBox(bakedBounds),
    'Baked strings fit the source racket',
);
// Parent integration: attach before its common rotation, centering and normalization.
root.add(loaded.scene);
root.rotation.x = Math.PI / 2;
root.scale.setScalar(4.2);
root.position.set(0.1, -0.4, 0.2);
root.updateMatrixWorld(true);
const transformedRuntime = new THREE.Box3().setFromObject(runtime, true);
const transformedBaked = new THREE.Box3().setFromObject(loaded.scene, true);
assert.ok(
    transformedRuntime.min.distanceTo(transformedBaked.min) < tolerance * 5,
);
assert.ok(
    transformedRuntime.max.distanceTo(transformedBaked.max) < tolerance * 5,
);
assert.deepEqual(
    readFileSync(new URL('../public/models/hyper-core.glb', import.meta.url)),
    sourceBytes,
);
console.log(
    JSON.stringify({
        bytes: bytes.length,
        strings: 44,
        triangles: 3616,
        worldBounds: bakedBounds,
        textureless: true,
    }),
);
