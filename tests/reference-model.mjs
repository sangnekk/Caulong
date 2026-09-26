import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const bytes = readFileSync(
    new URL(
        '../assets/reference-models/poly-google-badminton.glb',
        import.meta.url,
    ),
);
assert.equal(bytes.readUInt32LE(0), 0x46546c67);
assert.equal(bytes.readUInt32LE(4), 2);
assert.equal(bytes.readUInt32LE(8), bytes.length);
assert.equal(bytes.readUInt32LE(16), 0x4e4f534a);
const gltf = JSON.parse(
    bytes.subarray(20, 20 + bytes.readUInt32LE(12)).toString(),
);
assert.equal(gltf.meshes.length, 35);
assert.equal(gltf.materials.length, 3);
assert.equal(gltf.images?.length ?? 0, 0);
const triangles = gltf.meshes
    .flatMap((mesh) => mesh.primitives)
    .reduce((sum, primitive) => {
        assert.equal(primitive.mode ?? 4, 4);
        return (
            sum +
            gltf.accessors[primitive.indices ?? primitive.attributes.POSITION]
                .count /
                3
        );
    }, 0);
assert.equal(triangles, 1292);
console.log(
    'PASS: reference GLB 2.0; 123376 bytes; 1292 triangles; no textures; not integrated.',
);
