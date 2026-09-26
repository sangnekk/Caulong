import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import * as THREE from 'three';
import { addRacketStrings } from '../resources/js/lib/racket-strings.ts';

const source = new URL('../public/models/hyper-core.glb', import.meta.url);
const bytes = readFileSync(source);
const hash = (buffer) => createHash('sha256').update(buffer).digest('hex');
assert.equal(bytes.readUInt32LE(0), 0x46546c67);
const jsonLength = bytes.readUInt32LE(12);
const gltf = JSON.parse(bytes.toString('utf8', 20, 20 + jsonLength));
const binaryStart = 28 + jsonLength;
// Real binary accessors and complete hierarchy; no browser textures needed.
function attribute(index) {
    const accessor = gltf.accessors[index],
        view = gltf.bufferViews[accessor.bufferView];
    assert.equal(view.byteStride, undefined);
    const Constructor = {
        5126: Float32Array,
        5125: Uint32Array,
        5123: Uint16Array,
    }[accessor.componentType];
    assert.ok(Constructor);
    const size = { SCALAR: 1, VEC3: 3 }[accessor.type];
    const start =
        bytes.byteOffset +
        binaryStart +
        (view.byteOffset ?? 0) +
        (accessor.byteOffset ?? 0);
    return new THREE.BufferAttribute(
        new Constructor(
            bytes.buffer.slice(
                start,
                start + accessor.count * size * Constructor.BYTES_PER_ELEMENT,
            ),
        ),
        size,
    );
}
const nodes = gltf.nodes.map((node) => {
    let object = new THREE.Object3D();
    if (node.mesh !== undefined) {
        const primitive = gltf.meshes[node.mesh].primitives[0],
            geometry = new THREE.BufferGeometry();
        geometry.setAttribute(
            'position',
            attribute(primitive.attributes.POSITION),
        );
        geometry.setIndex(attribute(primitive.indices));
        object = new THREE.Mesh(
            geometry,
            new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }),
        );
    }
    object.name = node.name;
    if (node.matrix)
        new THREE.Matrix4()
            .fromArray(node.matrix)
            .decompose(object.position, object.quaternion, object.scale);
    if (node.translation) object.position.fromArray(node.translation);
    if (node.rotation) object.quaternion.fromArray(node.rotation);
    if (node.scale) object.scale.fromArray(node.scale);
    return object;
});
gltf.nodes.forEach((node, index) =>
    node.children?.forEach((child) => nodes[index].add(nodes[child])),
);
const root = new THREE.Group();
gltf.scenes[gltf.scene ?? 0].nodes.forEach((index) => root.add(nodes[index]));
const frame = root.getObjectByName('Object_16');
assert.ok(frame instanceof THREE.Mesh);
const originalVertices = frame.geometry.attributes.position.array.slice();
const sourceBounds = new THREE.Box3().setFromObject(root);
const strings = addRacketStrings(root);
root.updateMatrixWorld(true);
assert.ok(strings instanceof THREE.Mesh);
assert.equal(strings.parent, frame.parent);
assert.deepEqual(strings.matrixWorld.elements, frame.matrixWorld.elements);
assert.equal(strings.userData.part, 'strings');
assert.equal(strings.userData.illustrative, true);
assert.equal(strings.userData.mainCount, 20);
assert.equal(strings.userData.crossCount, 24);
assert.equal(strings.userData.stringCount, 44);
assert.equal(strings.geometry.groups.length, 0);
assert.ok(!Array.isArray(strings.material));
const triangles = strings.geometry.index.count / 3;
assert.equal(triangles, strings.userData.triangleCount);
assert.equal(triangles, strings.userData.segmentCount * 8);
assert.ok(triangles <= 4000, 'String triangle budget exceeded');
assert.ok(
    Array.from(strings.geometry.attributes.position.array).every(
        Number.isFinite,
    ),
);
assert.deepEqual(frame.geometry.attributes.position.array, originalVertices);
assert.ok(
    new THREE.Box3().setFromObject(strings).min.z <
        sourceBounds.getCenter(new THREE.Vector3()).z,
);
assert.ok(sourceBounds.containsBox(new THREE.Box3().setFromObject(strings)));
const diameterMeters =
    2 * strings.userData.radius * strings.getWorldScale(new THREE.Vector3()).x;
assert.ok(Math.abs(diameterMeters - 0.00065) < 1e-9);
// Independently verify every endpoint penetrates the inner surface, never exits the outer rim.
const probe = new THREE.Mesh(
    frame.geometry,
    new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }),
);
const ray = new THREE.Raycaster();
for (const { axis, start, end } of strings.userData.endpoints) {
    assert.ok([...start, ...end].every(Number.isFinite));
    assert.equal(start[1], 0);
    assert.equal(end[1], 0);
    const origin =
        axis === 'main'
            ? new THREE.Vector3(start[0], 0, -21)
            : new THREE.Vector3(0, 0, start[2]);
    for (const endpoint of [start, end]) {
        const point = new THREE.Vector3(...endpoint);
        ray.set(origin, point.clone().sub(origin).normalize());
        const hits = ray.intersectObject(probe, false);
        assert.ok(hits.length >= 2);
        const distance = origin.distanceTo(point);
        assert.ok(Math.abs(distance - hits[0].distance - 0.12) < 1e-6);
        assert.ok(
            distance <
                hits.find((hit) => hit.distance > hits[0].distance + 0.13)
                    .distance,
        );
    }
}
// Recover centerlines: ten vertices per open cylinder, two seam-duplicated rings.
const positions = strings.geometry.attributes.position;
const centers = [];
for (let offset = 0; offset < positions.count; offset += 5) {
    const center = new THREE.Vector3();
    for (let i = 0; i < 4; i++)
        center.add(
            new THREE.Vector3().fromBufferAttribute(positions, offset + i),
        );
    centers.push(center.multiplyScalar(0.25));
}
let crossings = 0;
const mains = strings.userData.endpoints.filter(({ axis }) => axis === 'main');
const crosses = strings.userData.endpoints.filter(
    ({ axis }) => axis === 'cross',
);
mains.forEach(({ start, end }, mainIndex) => {
    crosses.forEach(({ start: crossStart, end: crossEnd }, crossIndex) => {
        const z = crossStart[2];
        if (
            start[0] <= crossStart[0] + 0.12 ||
            start[0] >= crossEnd[0] - 0.12 ||
            z <= start[2] + 0.12 ||
            z >= end[2] - 0.12
        )
            return;
        const center = centers.find(
            (point) =>
                Math.abs(point.x - start[0]) < 1e-5 &&
                Math.abs(point.z - z) < 1e-5,
        );
        assert.ok(center, 'Every crossing has a woven main vertex');
        const expected = (mainIndex + crossIndex) % 2 ? 0.07 : -0.07;
        assert.ok(Math.abs(center.y - expected) < 1e-6);
        assert.ok(
            Math.abs(center.y) > 2 * strings.userData.radius,
            'Crossing cylinders do not intersect',
        );
        crossings++;
    });
});
assert.ok(crossings > 300);
assert.throws(() => addRacketStrings(new THREE.Group()), /Object_16/);
assert.equal(
    hash(readFileSync(source)),
    hash(bytes),
    'Source GLB stays untouched',
);
console.log(
    JSON.stringify({
        strings: 44,
        crossings,
        triangles,
        localBounds: strings.geometry.boundingBox,
        diameterMeters,
    }),
);
root.traverse((object) => {
    if (object instanceof THREE.Mesh) {
        object.geometry.dispose();
        object.material.dispose();
    }
});
probe.material.dispose();
