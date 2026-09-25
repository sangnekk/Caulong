import { mkdir, writeFile } from 'node:fs/promises';
import * as THREE from 'three';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// Original, unbranded illustration; dimensions and finishes are not product specifications.
globalThis.FileReader = class {
    readAsArrayBuffer(blob) {
        blob.arrayBuffer().then((result) => { this.result = result; this.onloadend?.(); });
    }
};
const model = new THREE.Group();
model.name = 'Illustrative badminton racket';
model.userData = { illustrative: true, attribution: 'Original generic model; no brand affiliation or material claims.' };
const materials = {
    silver: new THREE.MeshStandardMaterial({ color: '#eee9d5', metalness: 0.58, roughness: 0.28 }),
    lime: new THREE.MeshStandardMaterial({ color: '#d9ef72', metalness: 0.25, roughness: 0.34 }),
    dark: new THREE.MeshStandardMaterial({ color: '#172336', metalness: 0.08, roughness: 0.85 }),
    wrap: new THREE.MeshStandardMaterial({ color: '#374458', metalness: 0.03, roughness: 0.95 }),
    string: new THREE.MeshStandardMaterial({ color: '#f9f1d5', metalness: 0.1, roughness: 0.66 }),
};
const groups = Object.fromEntries(['frame', 'shaft', 'strings', 'grip'].map((name) => {
    const group = new THREE.Group(); group.name = name; group.userData.part = name; model.add(group); return [name, group];
}));
const buckets = new Map();
function add(part, material, geometry) {
    const key = part + ':' + material;
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push(geometry);
}
function rod(part, material, a, b, radius, segments = 8) {
    const start = new THREE.Vector3(...a), end = new THREE.Vector3(...b);
    const geometry = new THREE.CylinderGeometry(radius, radius, start.distanceTo(end), segments);
    geometry.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), end.clone().sub(start).normalize()));
    geometry.translate(...start.add(end).multiplyScalar(0.5).toArray()); add(part, material, geometry);
}
const exponent = 2.18, rx = 0.94, ry = 1.19, cy = 1.38;
function headPoint(t, z = 0) {
    const c = Math.cos(t), s = Math.sin(t);
    return new THREE.Vector3(rx * Math.sign(c) * Math.abs(c) ** (2 / exponent), cy + ry * Math.sign(s) * Math.abs(s) ** (2 / exponent), z);
}
function arc(start, end, radius, material) {
    const points = Array.from({ length: 65 }, (_, i) => headPoint(start + (end - start) * i / 64));
    add('frame', material, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), 96, radius, 8, false));
}
arc(0, Math.PI * 2, 0.049, 'silver');
arc(0.3, 1.22, 0.051, 'lime'); arc(1.92, 2.84, 0.051, 'lime');
arc(4.08, 4.45, 0.051, 'lime'); arc(4.97, 5.34, 0.051, 'lime');
for (let i = -10; i <= 10; i++) {
    const x = i * 0.081, dy = ry * (1 - Math.abs(x / rx) ** exponent) ** (1 / exponent);
    rod('strings', 'string', [x, cy - dy, 0.004], [x, cy + dy, 0.004], 0.0042, 4);
}
for (let i = -13; i <= 13; i++) {
    const y = i * 0.081, dx = rx * (1 - Math.abs(y / ry) ** exponent) ** (1 / exponent);
    rod('strings', 'string', [-dx, cy + y, -0.004], [dx, cy + y, -0.004], 0.0042, 4);
}
for (let i = 0; i < 64; i++) {
    const point = headPoint(i * Math.PI / 32), geometry = new THREE.SphereGeometry(0.022, 6, 4);
    geometry.scale(0.8, 0.8, 1.4); geometry.translate(...point.toArray()); add('frame', 'dark', geometry);
}
rod('shaft', 'silver', [0, -1.5, 0], [0, 0.25, 0], 0.029, 12);
rod('shaft', 'lime', [0, -1.42, 0], [0, -0.95, 0], 0.031, 12);
rod('frame', 'silver', [-0.17, 0.21, 0], [0.17, 0.21, 0], 0.036, 10);
const cone = new THREE.CylinderGeometry(0.035, 0.092, 0.19, 8);
cone.translate(0, -1.53, 0); add('grip', 'lime', cone);
const grip = new THREE.CylinderGeometry(0.086, 0.105, 0.96, 8);
grip.translate(0, -2.1, 0); add('grip', 'dark', grip);
const spiral = Array.from({ length: 240 }, (_, i) => {
    const t = i / 239, angle = t * Math.PI * 2 * 11, r = 0.088 + t * 0.019;
    return new THREE.Vector3(Math.cos(angle) * r, -1.64 - t * 0.92, Math.sin(angle) * r);
});
add('grip', 'wrap', new THREE.TubeGeometry(new THREE.CatmullRomCurve3(spiral), 220, 0.009, 4, false));
const cap = new THREE.CylinderGeometry(0.113, 0.113, 0.058, 8);
cap.translate(0, -2.6, 0); add('grip', 'lime', cap);
for (const [key, geometries] of buckets) {
    const [part, material] = key.split(':');
    const mesh = new THREE.Mesh(mergeGeometries(geometries), materials[material]);
    mesh.name = key; mesh.userData.part = part; groups[part].add(mesh);
    geometries.forEach((geometry) => geometry.dispose());
}
const output = new URL('../public/models/', import.meta.url);
await mkdir(output, { recursive: true });
const glb = await new GLTFExporter().parseAsync(model, { binary: true });
await writeFile(new URL('racket.glb', output), Buffer.from(glb));
const outline = Array.from({ length: 129 }, (_, i) => {
    const p = headPoint(i * Math.PI * 2 / 128); return (i ? 'L' : 'M') + p.x.toFixed(4) + ' ' + p.y.toFixed(4);
}).join(' ') + 'Z';
let strings = '';
for (let i = -10; i <= 10; i++) {
    const x = i * 0.081, dy = ry * (1 - Math.abs(x / rx) ** exponent) ** (1 / exponent);
    strings += '<path d="M' + x + ' ' + (cy - dy) + 'V' + (cy + dy) + '"/>';
}
for (let i = -13; i <= 13; i++) {
    const y = i * 0.081, dx = rx * (1 - Math.abs(y / ry) ** exponent) ** (1 / exponent);
    strings += '<path d="M' + (-dx) + ' ' + (cy + y) + 'H' + dx + '"/>';
}
let wraps = '';
for (let i = 0; i < 11; i++) wraps += '<path d="M-.09 ' + (-1.66 - i * .08) + 'l.19 -.065"/>';
const poster = '<svg xmlns="http://www.w3.org/2000/svg" width="700" height="700" viewBox="0 0 700 700" fill="none"><title>Vợt cầu lông minh họa, không thương hiệu</title><defs><linearGradient id="metal" x1="-1" y1="0" x2="1" y2="1" gradientUnits="userSpaceOnUse"><stop stop-color="#8f9d97"/><stop offset=".25" stop-color="#fff8df"/><stop offset=".5" stop-color="#d7dfc9"/><stop offset=".78" stop-color="#fffbe9"/><stop offset="1" stop-color="#99a698"/></linearGradient></defs><g transform="translate(350 350) scale(112 -112) rotate(-32)"><g stroke="#24324a" stroke-width=".028" opacity=".2">' + strings + '</g><g stroke="#e4e5c9" stroke-width=".007">' + strings + '</g><path d="M0 -1.6V.24" stroke="#71817e" stroke-width=".07"/><path d="M0 -1.6V.24" stroke="url(#metal)" stroke-width=".05"/><path d="M0 -1.42V-.95" stroke="#d7ed73" stroke-width=".06"/><path d="' + outline + '" stroke="#6d7f80" stroke-width=".12"/><path d="' + outline + '" stroke="url(#metal)" stroke-width=".093"/><path d="' + outline + '" stroke="#d5ed6d" stroke-width=".098" stroke-dasharray=".8 1.1 .8 4.8"/><path d="M-.16 .21H.16" stroke="url(#metal)" stroke-width=".07"/><path d="M-.033 -1.43H.033L.09 -1.65H-.09Z" fill="#d7ed73"/><path d="M-.086 -1.63H.086L.105 -2.59H-.105Z" fill="#172336" stroke="#526073" stroke-width=".012"/><g stroke="#526073" stroke-width=".015">' + wraps + '</g><path d="M-.11 -2.6H.11" stroke="#d7ed73" stroke-width=".058"/></g></svg>';
await writeFile(new URL('racket-poster.svg', output), poster);
console.log('Generated racket.glb: ' + glb.byteLength + ' bytes; racket-poster.svg: ' + Buffer.byteLength(poster) + ' bytes.');
