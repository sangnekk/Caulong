import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

export type RacketPart = 'all' | 'frame' | 'shaft' | 'strings' | 'grip';
export type RacketScene = {
    rotate: (direction: number) => void;
    zoom: (direction: number) => void;
    reset: () => void;
    setPart: (part: RacketPart) => void;
    setProgress: (progress: number) => void;
    getAnnotation: () => { x: number; y: number; label: string } | null;
    dispose: () => void;
};

function disposeModel(root: THREE.Object3D) {
    const materials = new Set<THREE.Material>();
    root.traverse((object) => {
        if (!(object instanceof THREE.Mesh)) return;
        object.geometry.dispose();
        (Array.isArray(object.material)
            ? object.material
            : [object.material]
        ).forEach((material) => materials.add(material));
    });
    const textures = new Set<THREE.Texture>();
    materials.forEach((material) => {
        for (const value of Object.values(material)) {
            if (value instanceof THREE.Texture) textures.add(value);
        }
        material.dispose();
    });
    textures.forEach((texture) => {
        if (
            typeof ImageBitmap !== 'undefined' &&
            texture.image instanceof ImageBitmap
        )
            texture.image.close();
        texture.dispose();
    });
}

export async function createRacketScene(
    host: HTMLElement,
    signal: AbortSignal,
    onError: () => void,
): Promise<RacketScene> {
    const requestSignal = AbortSignal.any([signal, AbortSignal.timeout(30000)]);
    const buffers = await Promise.all(
        ['hyper-core.glb', 'hyper-core-strings.glb'].map(async (name) => {
            const response = await fetch('/models/' + name, {
                signal: requestSignal,
            });
            if (!response.ok) throw new Error('Racket model unavailable');
            return response.arrayBuffer();
        }),
    );
    const loader = new GLTFLoader();
    const gltf = await loader.parseAsync(buffers[0], '/models/');
    try {
        const strings = await loader.parseAsync(buffers[1], '/models/');
        gltf.scene.add(strings.scene);
    } catch (error) {
        disposeModel(gltf.scene);
        throw error;
    }
    const model = new THREE.Group();
    model.add(gltf.scene);
    // Source head points toward -Z; orient it upward without altering source meshes.
    gltf.scene.rotation.x += Math.PI / 2;
    gltf.scene.updateMatrixWorld(true);
    const sourceBounds = new THREE.Box3().setFromObject(gltf.scene);
    const sourceHeight = sourceBounds.getSize(new THREE.Vector3()).y;
    if (!Number.isFinite(sourceHeight) || sourceHeight <= 0) {
        disposeModel(model);
        throw new Error('Invalid racket dimensions');
    }
    model.scale.setScalar(6 / sourceHeight);
    if (signal.aborted) {
        disposeModel(model);
        throw new DOMException('Viewer unmounted', 'AbortError');
    }

    let renderer: THREE.WebGLRenderer;
    try {
        renderer = new THREE.WebGLRenderer({
            alpha: true,
            antialias: true,
            powerPreference: 'high-performance',
        });
    } catch (error) {
        disposeModel(model);
        throw error;
    }
    const canvas = renderer.domElement;
    canvas.setAttribute('aria-hidden', 'true');
    canvas.style.cssText =
        'display:block;width:100%;height:100%;touch-action:pan-y;';
    renderer.setClearColor(0x000000, 0);
    // Bound fill-rate: a full-screen DPR 1.75 buffer draws >3x CSS pixels.
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.25));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.4;
    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-3, 3, 3, -3, 0.1, 40);
    camera.position.set(0, 0, 10);
    scene.add(new THREE.HemisphereLight(0xf6f6e8, 0x879bcc, 2.5));
    const key = new THREE.DirectionalLight(0xfff4d7, 3.6);
    key.position.set(-3, 5, 7);
    scene.add(key);
    const rim = new THREE.DirectionalLight(0xd4e7ff, 2.6);
    rim.position.set(4, -1, -3);
    scene.add(rim);
    const presentation = new THREE.Group();
    presentation.rotation.set(0.08, 0, -0.56);
    const pivot = new THREE.Group();
    pivot.rotation.y = -0.2;
    const center = new THREE.Box3()
        .setFromObject(model)
        .getCenter(new THREE.Vector3());
    model.position.sub(center);
    const modelBounds = new THREE.Box3().setFromObject(model);
    pivot.add(model);
    presentation.add(pivot);
    scene.add(presentation);
    const bounds = new THREE.Box3()
        .setFromObject(presentation)
        .getSize(new THREE.Vector3());
    const meshes: { mesh: THREE.Mesh; color: THREE.Color; part: string }[] = [];
    const originals = new Set<THREE.Material>();
    model.traverse((object) => {
        if (
            !(object instanceof THREE.Mesh) ||
            !(object.material instanceof THREE.MeshStandardMaterial)
        )
            return;
        originals.add(object.material);
        object.material = object.material.clone();
        meshes.push({
            mesh: object,
            color: object.material.color.clone(),
            part: object.userData.part,
        });
    });
    originals.forEach((material) => material.dispose());
    // ponytail: anchors describe this model, not manufacturer-certified internal layers.
    const poses = [
        { focus: 0, zoom: 1, z: -0.28, y: -0.16, x: 0.48, top: 0 },
        { focus: 1.95, zoom: 1.8, z: -0.18, y: 0.2, x: 0.48, top: 0 },
        { focus: -0.45, zoom: 2.5, z: -0.28, y: -0.16, x: 0.48, top: 0 },
        { focus: -2.25, zoom: 2.5, z: -0.18, y: 0.25, x: 0.48, top: 0 },
        { focus: 1.72, zoom: 1.65, z: -0.1, y: 0.05, x: 0.48, top: 0 },
        { focus: 0, zoom: 1, z: -0.28, y: -0.16, x: 0.48, top: 0 },
    ];
    const annotations = [
        null,
        { x: 0.66, y: 1.95, label: 'Khung và lỗ luồn dây' },
        { x: 0, y: -0.45, label: 'Thân vợt' },
        { x: 0, y: -2.25, label: 'Lớp quấn cán' },
        { x: 0, y: 1.72, label: 'Mặt dây đan bổ sung' },
        null,
    ];
    const marker = new THREE.Vector3();
    let annotation: { x: number; y: number; label: string } | null = null;
    let poseSignature = '';
    const storyBounds = new THREE.Box3();
    const storySize = new THREE.Vector3();
    const focus = new THREE.Vector3();
    const transform = new THREE.Matrix4();
    let storyProgress: number | null = null;
    let viewportWidth = 0,
        viewportHeight = 0;
    let disposed = false,
        failed = false,
        visible = true,
        magnification = 1;
    let pointer: {
        id: number;
        x: number;
        y: number;
        last: number;
        dragging: boolean;
    } | null = null;
    let observer: IntersectionObserver | undefined;
    let resizeObserver: ResizeObserver | undefined;

    // ponytail: render only on interaction; add a cancellable frame loop only for opt-in animation.
    function draw() {
        if (disposed || failed || !visible || document.hidden) return;
        try {
            renderer.render(scene, camera);
        } catch {
            fail();
        }
    }
    function project(half: number, aspect: number, zoom: number) {
        if (
            camera.top === half &&
            camera.right === half * aspect &&
            camera.zoom === zoom
        )
            return;
        camera.left = -half * aspect;
        camera.right = half * aspect;
        camera.top = half;
        camera.bottom = -half;
        camera.zoom = zoom;
        camera.updateProjectionMatrix();
    }
    function presentStory() {
        if (storyProgress === null) return;
        const segment = storyProgress * 5;
        const index = Math.min(Math.floor(segment), 4);
        // Hold each view around its chapter center; scroll alone controls both directions.
        const t = THREE.MathUtils.smoothstep(segment - index, 0.15, 0.85);
        const from = poses[index],
            to = poses[index + 1];
        const mix = (key: keyof typeof from) =>
            THREE.MathUtils.lerp(from[key], to[key], t);
        const aspect = viewportWidth / viewportHeight;
        const mobile = viewportWidth < 768;
        const signature =
            index + ':' + t + ':' + viewportWidth + ':' + viewportHeight;
        if (signature === poseSignature) {
            canvas.dataset.storyProgress = String(storyProgress);
            return false;
        }
        poseSignature = signature;
        const screenX = mobile ? 0 : mix('x');
        const screenY = mobile ? 0.38 : mix('top');
        presentation.position.set(0, 0, 0);
        presentation.rotation.set(0.08, 0, mix('z'));
        pivot.rotation.y = mix('y');
        presentation.updateMatrix();
        pivot.updateMatrix();
        transform.multiplyMatrices(presentation.matrix, pivot.matrix);
        storyBounds
            .copy(modelBounds)
            .applyMatrix4(transform)
            .getSize(storySize);
        const half =
            Math.max(
                storySize.y / (mobile ? 0.7 : 1.58),
                storySize.x / ((mobile ? 1.64 : 0.82) * aspect),
            ) * 1.06;
        const zoom = mix('zoom');
        project(half, aspect, zoom);
        // Anchors live before pivot/presentation rotation, not in untransformed world space.
        focus.set(0, mix('focus'), 0).applyMatrix4(transform);
        presentation.position.set(
            (screenX * half * aspect) / zoom - focus.x,
            (screenY * half) / zoom - focus.y,
            -focus.z,
        );
        if (import.meta.env.DEV) {
            // Runnable focus check: scrub every chapter/rescale viewport in development.
            camera.updateMatrixWorld();
            focus.add(presentation.position).project(camera);
            console.assert(
                Math.abs(focus.x - screenX) < 1e-6 &&
                    Math.abs(focus.y - screenY) < 1e-6,
                'Story focus must remain on screen',
            );
        }
        const point = annotations[Math.round(segment)];
        annotation = null;
        if (point) {
            camera.updateMatrixWorld();
            marker
                .set(point.x, point.y, 0)
                .applyMatrix4(transform)
                .add(presentation.position)
                .project(camera);
            if (Math.abs(marker.x) < 0.96 && Math.abs(marker.y) < 0.82) {
                annotation = {
                    x: (marker.x + 1) * 50,
                    y: (1 - marker.y) * 50,
                    label: point.label,
                };
            }
        }
        canvas.dataset.storyProgress = String(storyProgress);
        canvas.dataset.storyPose = String(Math.round(segment));
        canvas.dataset.strings = 'illustrative';
        return true;
    }
    function resize() {
        if (disposed) return;
        const width = Math.max(host.clientWidth, 1),
            height = Math.max(host.clientHeight, 1);
        if (width !== viewportWidth || height !== viewportHeight) {
            viewportWidth = width;
            viewportHeight = height;
            renderer.setSize(width, height, false);
        }
        if (storyProgress === null) {
            const aspect = width / height;
            project(
                Math.max(bounds.y / 2, bounds.x / (2 * aspect)) * 1.16,
                aspect,
                magnification,
            );
        } else presentStory();
        draw();
    }
    function release() {
        if (pointer && canvas.hasPointerCapture(pointer.id))
            canvas.releasePointerCapture(pointer.id);
        pointer = null;
        canvas.style.cursor = storyProgress === null ? 'grab' : 'default';
    }
    function down(event: PointerEvent) {
        if (storyProgress !== null || !event.isPrimary || event.button !== 0)
            return;
        pointer = {
            id: event.pointerId,
            x: event.clientX,
            y: event.clientY,
            last: event.clientX,
            dragging: false,
        };
    }
    function move(event: PointerEvent) {
        if (!pointer || pointer.id !== event.pointerId) return;
        const dx = event.clientX - pointer.x,
            dy = event.clientY - pointer.y;
        if (!pointer.dragging) {
            if (Math.abs(dy) > Math.abs(dx) && Math.abs(dy) > 6) {
                release();
                return;
            }
            if (Math.abs(dx) < 6) return;
            pointer.dragging = true;
            canvas.setPointerCapture(event.pointerId);
            canvas.style.cursor = 'grabbing';
        }
        pivot.rotation.y += (event.clientX - pointer.last) * 0.012;
        pointer.last = event.clientX;
        draw();
    }
    function visibility() {
        release();
        draw();
    }
    function contextLost(event: Event) {
        event.preventDefault();
        fail();
    }
    function fail() {
        if (disposed || failed) return;
        failed = true;
        dispose();
        onError();
    }
    function dispose() {
        if (disposed) return;
        disposed = true;
        release();
        observer?.disconnect();
        resizeObserver?.disconnect();
        window.removeEventListener('resize', resize);
        document.removeEventListener('visibilitychange', visibility);
        canvas.removeEventListener('webglcontextlost', contextLost);
        canvas.removeEventListener('pointerdown', down);
        canvas.removeEventListener('pointermove', move);
        canvas.removeEventListener('pointerup', release);
        canvas.removeEventListener('pointerleave', release);
        canvas.removeEventListener('pointercancel', release);
        canvas.removeEventListener('lostpointercapture', release);
        signal.removeEventListener('abort', dispose);
        disposeModel(model);
        renderer.dispose();
        renderer.forceContextLoss();
        canvas.remove();
    }
    try {
        // Prepare shaders and upload maps before exposing the canvas; yield between uploads.
        await renderer.compileAsync(scene, camera);
        const maps = new Set<THREE.Texture>();
        model.traverse((object) => {
            if (!(object instanceof THREE.Mesh)) return;
            const materials = Array.isArray(object.material)
                ? object.material
                : [object.material];
            for (const material of materials)
                for (const value of Object.values(material)) {
                    if (value instanceof THREE.Texture) maps.add(value);
                }
        });
        for (const map of maps) {
            if (signal.aborted)
                throw new DOMException('Viewer unmounted', 'AbortError');
            renderer.initTexture(map);
            await new Promise((resolve) => setTimeout(resolve, 0));
        }
        if (signal.aborted)
            throw new DOMException('Viewer unmounted', 'AbortError');
        host.appendChild(canvas);
        canvas.style.cursor = 'grab';
        canvas.addEventListener('webglcontextlost', contextLost);
        canvas.addEventListener('pointerdown', down);
        canvas.addEventListener('pointermove', move);
        canvas.addEventListener('pointerup', release);
        canvas.addEventListener('pointerleave', release);
        canvas.addEventListener('pointercancel', release);
        canvas.addEventListener('lostpointercapture', release);
        document.addEventListener('visibilitychange', visibility);
        signal.addEventListener('abort', dispose, { once: true });
        if (typeof ResizeObserver !== 'undefined') {
            resizeObserver = new ResizeObserver(resize);
            resizeObserver.observe(host);
        } else window.addEventListener('resize', resize);
        if ('IntersectionObserver' in window) {
            observer = new IntersectionObserver(([entry]) => {
                visible = entry.isIntersecting;
                if (!visible) release();
                draw();
            });
            observer.observe(host);
        }
        resize();
        if (failed) throw new Error('WebGL rendering unavailable');
    } catch (error) {
        dispose();
        throw error;
    }
    return {
        getAnnotation() {
            return annotation;
        },
        setProgress(progress) {
            if (disposed || !Number.isFinite(progress)) return;
            const next = THREE.MathUtils.clamp(progress, 0, 1);
            if (storyProgress === next) return;
            storyProgress = next;
            release();
            if (presentStory()) draw();
        },
        rotate(direction) {
            if (!disposed) {
                pivot.rotation.y += direction * 0.26;
                draw();
            }
        },
        zoom(direction) {
            if (!disposed) {
                magnification = THREE.MathUtils.clamp(
                    magnification + direction * 0.12,
                    0.76,
                    1.6,
                );
                resize();
            }
        },
        reset() {
            if (!disposed) {
                pivot.rotation.y = -0.2;
                magnification = 1;
                resize();
            }
        },
        setPart(part) {
            if (disposed) return;
            const available = meshes.some((entry) => entry.part === part);
            meshes.forEach(({ mesh, color, part: name }) => {
                const material = mesh.material as THREE.MeshStandardMaterial;
                const selected = !available || part === 'all' || part === name;
                material.color.copy(color).multiplyScalar(selected ? 1 : 0.42);
                material.emissive.set(
                    available && part !== 'all' && selected
                        ? 0x728530
                        : 0x000000,
                );
                material.emissiveIntensity = 0.3;
            });
            draw();
        },
        dispose,
    };
}
