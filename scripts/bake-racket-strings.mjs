import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import * as THREE from 'three';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { addRacketStrings } from '../resources/js/lib/racket-strings.ts';

const source = new URL('../public/models/hyper-core.glb', import.meta.url);
const output = new URL(
    '../public/models/hyper-core-strings.glb',
    import.meta.url,
);
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');

// ponytail: only this source's packed geometry is needed; use GLTFLoader for broader asset support.
export function readSourceGeometry() {
    const bytes = readFileSync(source);
    assert.equal(bytes.readUInt32LE(0), 0x46546c67);
    assert.equal(bytes.readUInt32LE(4), 2);
    assert.equal(bytes.readUInt32LE(8), bytes.length);
    const jsonLength = bytes.readUInt32LE(12);
    assert.equal(bytes.readUInt32LE(16), 0x4e4f534a);
    const gltf = JSON.parse(bytes.toString('utf8', 20, 20 + jsonLength));
    const binaryStart = 28 + jsonLength;
    assert.equal(bytes.readUInt32LE(binaryStart - 4), 0x004e4942);
    function attribute(index) {
        const accessor = gltf.accessors[index],
            view = gltf.bufferViews[accessor.bufferView];
        assert.equal(view.byteStride, undefined);
        assert.equal(accessor.sparse, undefined);
        assert.equal(view.buffer, 0);
        const Constructor = {
            5126: Float32Array,
            5125: Uint32Array,
            5123: Uint16Array,
        }[accessor.componentType];
        const size = { SCALAR: 1, VEC3: 3 }[accessor.type];
        assert.ok(Constructor && size);
        const start =
            binaryStart + (view.byteOffset ?? 0) + (accessor.byteOffset ?? 0);
        const end =
            start + accessor.count * size * Constructor.BYTES_PER_ELEMENT;
        assert.ok(start >= binaryStart && end <= bytes.length);
        return new THREE.BufferAttribute(
            new Constructor(
                bytes.buffer.slice(
                    bytes.byteOffset + start,
                    bytes.byteOffset + end,
                ),
            ),
            size,
        );
    }
    const nodes = gltf.nodes.map((node) => {
        let object = new THREE.Object3D();
        if (node.mesh !== undefined) {
            const primitives = gltf.meshes[node.mesh].primitives;
            assert.equal(primitives.length, 1);
            assert.equal(primitives[0].mode ?? 4, 4);
            const geometry = new THREE.BufferGeometry();
            geometry.setAttribute(
                'position',
                attribute(primitives[0].attributes.POSITION),
            );
            geometry.setIndex(attribute(primitives[0].indices));
            object = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial());
        }
        object.name = node.name ?? '';
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
    gltf.scenes[gltf.scene ?? 0].nodes.forEach((index) =>
        root.add(nodes[index]),
    );
    return { root, asset: gltf.asset, bytes };
}

async function bake() {
    const { root, asset, bytes } = readSourceGeometry();
    const strings = addRacketStrings(root);
    root.updateMatrixWorld(true);
    const baked = strings.clone();
    baked.geometry = strings.geometry.clone().applyMatrix4(strings.matrixWorld);
    baked.geometry.deleteAttribute('uv'); // No textures; no unused UV payload.
    baked.position.set(0, 0, 0);
    baked.quaternion.identity();
    baked.scale.set(1, 1, 1);
    baked.updateMatrix();
    const { mainCount, crossCount, stringCount, segmentCount, triangleCount } =
        strings.userData;
    baked.userData = {
        part: 'strings',
        illustrative: true,
        mainCount,
        crossCount,
        stringCount,
        segmentCount,
        triangleCount,
        coordinateSpace:
            'Original gltf.scene world coordinates, before X rotation or normalization',
        baseModel: {
            title: asset.extras.title,
            author: asset.extras.author,
            source: asset.extras.source,
            license: asset.extras.license,
            sha256: hash(bytes),
        },
        strings: {
            author: 'Shop Cầu Lông — original illustrative addition',
            modifications:
                'Only the illustrative string bed is included; fitted to the base model by racket-strings.ts. Not manufacturer specifications or certified stringing instructions.',
        },
    };
    assert.equal(stringCount, 44);
    assert.equal(baked.geometry.index.count / 3, 3616);
    assert.ok(
        Array.from(baked.geometry.attributes.position.array).every(
            Number.isFinite,
        ),
    );
    // GLTFExporter needs only this FileReader method for a textureless binary export.
    globalThis.FileReader ??= class {
        readAsArrayBuffer(blob) {
            blob.arrayBuffer().then((result) => {
                this.result = result;
                this.onloadend?.();
            });
        }
    };
    const glb = Buffer.from(
        await new GLTFExporter().parseAsync(baked, { binary: true }),
    );
    assert.ok(glb.length < 500_000, 'Baked strings exceed 500 KB');
    assert.equal(
        hash(readFileSync(source)),
        hash(bytes),
        'Source GLB must stay untouched',
    );
    writeFileSync(output, glb);
    console.log(
        JSON.stringify({
            output: output.pathname,
            bytes: glb.length,
            strings: stringCount,
            triangles: triangleCount,
        }),
    );
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
    await bake();
