import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

/** Add illustrative strings before rotating/normalizing the original GLTF scene. */
export function addRacketStrings(root: THREE.Object3D): THREE.Object3D {
    const frame = root.getObjectByName("Object_16");
    if (!(frame instanceof THREE.Mesh) || !frame.parent) {
        throw new Error("Hyper Core8000 frame Object_16 is missing");
    }

    // ponytail: this grid fits the measured Hyper Core8000 aperture; other assets need their own grid.
    // Local units are cm (ancestor scale .01); triangle rays find the actual inner rim, not an ellipse.
    const mains = Array.from({ length: 20 }, (_, i) => (i - 9.5) * 0.86);
    const crosses = Array.from({ length: 24 }, (_, i) => -32.55 + i * 0.96);
    const radius = 0.0325; // 0.65 mm string diameter on a 67.5 cm racket.
    const weave = 0.07;
    const embed = 0.12;
    const probeMaterial = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide });
    const probe = new THREE.Mesh(frame.geometry, probeMaterial);
    const raycaster = new THREE.Raycaster();
    const pieces: THREE.BufferGeometry[] = [];
    const endpoints: { axis: "main" | "cross"; start: number[]; end: number[] }[] = [];
    const up = new THREE.Vector3(0, 1, 0);

    function rim(origin: THREE.Vector3, direction: THREE.Vector3) {
        raycaster.set(origin, direction);
        const hit = raycaster.intersectObject(probe, false)[0];
        if (!hit || !Number.isFinite(hit.distance) || hit.distance <= embed || hit.distance > 30) {
            throw new Error("Hyper Core8000 string aperture is invalid");
        }
        return hit.point.clone().addScaledVector(direction, embed);
    }

    function strand(axis: "main" | "cross", points: THREE.Vector3[]) {
        endpoints.push({ axis, start: points[0].toArray(), end: points[points.length - 1].toArray() });
        for (let i = 1; i < points.length; i++) {
            const a = points[i - 1];
            const b = points[i];
            const direction = b.clone().sub(a);
            const length = direction.length();
            if (!Number.isFinite(length) || length <= 0) throw new Error("Invalid string segment");
            // Uncapped four-sided cylinders: eight triangles per segment, ends hidden inside the rim.
            const cylinder = new THREE.CylinderGeometry(radius, radius, length, 4, 1, true);
            cylinder.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(up, direction.normalize()));
            cylinder.translate((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2);
            pieces.push(cylinder);
        }
    }

    let geometry: THREE.BufferGeometry | null = null;
    try {
        mains.forEach((x, mainIndex) => {
            const origin = new THREE.Vector3(x, 0, -21);
            const start = rim(origin, new THREE.Vector3(0, 0, -1));
            const end = rim(origin, new THREE.Vector3(0, 0, 1));
            const points = [start];
            crosses.forEach((z, crossIndex) => {
                if (z > start.z + embed && z < end.z - embed) {
                    points.push(new THREE.Vector3(x, (mainIndex + crossIndex) % 2 ? weave : -weave, z));
                }
            });
            strand("main", [...points, end]);
        });
        crosses.forEach((z) => {
            const origin = new THREE.Vector3(0, 0, z);
            strand("cross", [rim(origin, new THREE.Vector3(-1, 0, 0)), rim(origin, new THREE.Vector3(1, 0, 0))]);
        });
        geometry = mergeGeometries(pieces, false);
        if (!geometry) throw new Error("Cannot merge racket strings");
    } finally {
        probeMaterial.dispose();
        pieces.forEach((piece) => piece.dispose());
    }

    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();
    const strings = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({
        color: 0xeee9d9,
        roughness: 0.68,
        metalness: 0,
    }));
    strings.name = "IllustrativeRacketStrings";
    strings.userData = {
        part: "strings",
        illustrative: true,
        mainCount: mains.length,
        crossCount: crosses.length,
        stringCount: endpoints.length,
        segmentCount: pieces.length,
        triangleCount: geometry.index!.count / 3,
        radius,
        weaveOffset: weave,
        rimEmbedding: embed,
        endpoints,
    };
    // Sibling, not frame child: frame visibility can change independently of strings.
    frame.updateMatrix();
    strings.matrix.copy(frame.matrix);
    strings.matrix.decompose(strings.position, strings.quaternion, strings.scale);
    frame.parent.add(strings);
    return strings;
}
